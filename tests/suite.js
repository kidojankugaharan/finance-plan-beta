import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createEngine,project} from '../src/engine/index.js';
import {PROVINCES} from '../src/engine/provinces.js';
import {freshPlan,createStore,backupJSON,parseBackup,STORAGE_KEY} from '../src/state.js';
import {validatePlan,validateExpense,numberValue} from '../src/validation.js';
import {scenario,projectionSummary,expense} from './scenarios.js';
import {readAssumptions} from '../src/ui/setup.js';
import {paydaysInMonth,paydayPlan,saveExtraSeries} from '../src/engine/cashflow.js';
import * as setup from '../src/ui/setup.js';
import * as year from '../src/ui/year.js';
import * as salary from '../src/ui/salary.js';
import * as budget from '../src/ui/budget.js';
import * as invest from '../src/ui/invest.js';
import * as goals from '../src/ui/goals.js';
import * as analysis from '../src/ui/analysis.js';
import * as more from '../src/ui/more.js';
import * as lessons from '../src/ui/lessons.js';
import {monthEnded,pendingMonths,closeMonth,sortedLessons} from '../src/closeout.js';

const golden=JSON.parse(fs.readFileSync(new URL('./fixtures/projection-golden.json',import.meta.url),'utf8'));
const near=(a,b,tol=.01)=>assert.ok(Math.abs(a-b)<=tol,`${a} vs ${b}`);
const memory=()=>{const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),data};};
export function registerSuite(test) {
  for(const kind of ['workingCouple','retiringCouple'])test('golden: '+kind+' matches every reference year',()=>assert.deepEqual(projectionSummary(scenario(kind)),golden[kind]));
  test('reference: finite projections and covered retiring-household deficits through 2040',()=>{
    const e=scenario('retiringCouple');assert.ok(e.resolveDrawdown().windows.length);
    for(const a of e.computeAnnualAggregates())for(const v of Object.values(a))if(typeof v==='number')assert.ok(Number.isFinite(v));
    for(const y of e.computeMonthlySeries().filter(y=>y.year<=2040))assert.ok(y.months.every(m=>m.cash>=-1));
  });
  test('reference: 2026 Ontario payroll and income tax',()=>{
    const e=createEngine(),t=e.personTax({employment:60000,year:2026,age:40});
    near(t.cpp,3361.75);near(t.ei,978);near(t.healthPremium,600);near(t.fedTax,5338,1);near(60000-t.total,47339.75,1);
    const high=e.personTax({employment:150000,year:2026,age:40});near(high.cpp,4646.45);near(high.ei,1123.07);
  });
  test('reference: tax credits, pension credit, and OAS clawback',()=>{
    const e=createEngine(),tax=ctx=>e.personTax({year:2026,...ctx});
    assert.equal(tax({other:12000,age:40}).incomeTax,0);
    assert.ok(tax({other:40000,eligiblePension:40000,age:66}).incomeTax<tax({other:40000,eligiblePension:40000,age:60}).incomeTax-1000);
    near(tax({other:105323,oas:9150,age:70}).oasClawback,1500);near(tax({other:300000,oas:9150,age:70}).oasClawback,9150);
  });
  test('reference: indexed tax and registered-account limits',()=>{
    const e=createEngine({inflationRate:2});
    const now=e.personTax({employment:60000,year:2026,age:40}).incomeTax,later=e.personTax({employment:60000*1.02**10,year:2036,age:40}).incomeTax;
    near(later/1.02**10,now,120);assert.equal(e.projectedTfsaAnnualLimit(2026).value,7000);
    assert.equal(e.projectedTfsaAnnualLimit(2036).value,Math.round(7000*1.02**10/500)*500);
    assert.equal(e.indexedPublishedLimit(e.CRA_RRSP_DOLLAR_LIMITS,2027,10),35390);
  });
  test('reference: gross-ups hit net targets and obey account caps',()=>{
    const e=createEngine();for(const [net,base] of [[1000,0],[20000,50000],[50000,120000],[5000,250000]]){const r=e.grossUpWithdrawal(net,base,0,Infinity);near(r.net,net,.05);assert.ok(r.gross>=net);}
    assert.equal(e.grossUpWithdrawal(50000,60000,0,10000).gross,10000);
  });
  test('reference: RRSP room uses earned income and closes after 71; RRIF minimums',()=>{
    const e=scenario('retiringCouple'),s=e.computeSalaryChain(),i=y=>e.state.years.findIndex(r=>r.year===y);
    assert.ok(e.projectedRrspNewRoom(i(2027),'rrspA',s).value>0);assert.equal(e.projectedRrspNewRoom(i(2030),'rrspA',s).value,0);
    assert.equal(e.rrspClosedFor('A',2035),false);assert.equal(e.rrspClosedFor('A',2036),true);
    assert.equal(e.getPlanRoomCap(e.state.years[i(2036)],'rrspA'),0);
    const series=e.computeMonthlySeries();for(const y of [2036,2040]){const opening=series[i(y)-1].months[11].rrspBalA;const drawn=series[i(y)].months.reduce((t,m)=>t+m.autoWithdrawalRrspA,0);assert.ok(drawn>=opening*e.rrifMinimumFactor(e.personAgeInYear('A',y-1))-1);}
    assert.equal(e.rrifMinimumFactor(71),.0528);assert.equal(e.rrifMinimumFactor(95),.2);near(e.rrifMinimumFactor(65),.04,1e-9);
  });
  test('reference: CPP and OAS start separately and CPP deferral increases benefits',()=>{
    let e=scenario('retiringCouple');const pension=(e,y)=>e.computeSalaryChain()[y-2026].pensionA;
    assert.equal(pension(e,2028).cpp,0);assert.ok(pension(e,2029).oas>0);
    e.state.pensions.A.cppStartAge=70;const p70=pension(createEngine(e.state),2034);
    e.state.pensions.A.cppStartAge=65;const p65=pension(createEngine(e.state),2034);near(p70.cpp/p65.cpp,1.42,.0001);
    e.state.pensions.A.cppPct=50;assert.equal(pension(createEngine(e.state),2034).share,.5);
  });
  test('UX: shared retirement stops salaries automatically and preserves explicit OFF',()=>{
    let e=createEngine({baseYear:2026,ageA:64,ageB:63,singlePerson:false});e.state.years[0].grossA=80000;e.state.years[0].grossB=50000;
    e=createEngine(e.state);assert.equal(e.computeSalaryChain()[1].pensionActive,false);assert.equal(e.computeSalaryChain()[2].pensionActive,true);
    e.state.years[1].pensionModeOverride=false;e=createEngine(e.state);assert.equal(e.computeSalaryChain()[3].grossA,80000);
    e.state.years[4].pensionModeOverride=true;assert.equal(createEngine(e.state).computeSalaryChain()[4].pensionActive,true);
  });
  test('reference: drawdown choices stay attached when retirement moves',()=>{
    let e=scenario('retiringCouple');e.state.drawdownPlans[2028]={strategy:'manual',rrspPct:30};e.state.retirementAge=65;e.state.years[2].pensionModeOverride=null;e.state.years[4].pensionModeOverride=true;
    e=createEngine(e.state);const w=e.resolveDrawdown().windows[0];assert.equal(w.start,2030);assert.equal(w.plan.strategy,'manual');assert.equal(w.plan.rrspPct,30);
    assert.equal(e.getWindowPlan({start:2040,end:2050},2035).saved,false);
  });
  test('reference: recurring budget averages, inflation, one-time dates, and exclusions',()=>{
    const e=createEngine({baseYear:2026,inflationRate:2.5});let item=expense('A','Food',120);
    near(e.budgetAnnual(item,2027),1440*1.025);item={...item,recurrenceType:'once',startDate:'2026-06'};
    assert.equal(e.budgetAmountForMonth(item,2026,4),0);assert.equal(e.budgetAmountForMonth(item,2026,5),120);assert.equal(e.budgetAmountForMonth(item,2027,5),0);
    assert.equal(e.budgetAnnual({...item,owner:'n/a'},2026),0);
  });
  test('reference: annual budgets carry lists and month windows without inflation',()=>{
    const item={...expense('Both','Summer',1000),startDate:'2026-06',endDate:'2026-08'};
    const e=createEngine({baseYear:2026,budgetMode:'year',budgetByYear:{2026:[item],2028:[expense('Both','Living',2000)]}});
    assert.equal(e.budgetTotalAnnual(2027),3000);assert.equal(e.budgetTotalAnnual(2028),24000);assert.equal(e.budgetTotalAnnual(2029),24000);
  });
  test('reference: real dollars deflate money but preserve rates',()=>{
    const e=scenario(),nominal=e.computeAnnualAggregates().at(-1);e.state.ui.analysis={realDollars:true};const real=e.analysisAggregates().at(-1);
    near(real.netWorth,nominal.netWorth/1.025**60,.01);assert.equal(real.savingsRate,nominal.savingsRate);assert.equal(e.computeAnnualAggregates().at(-1).netWorth,nominal.netWorth);
  });
  test('investments: missing room never allocates and single people cannot fund B',()=>{
    let e=createEngine({baseYear:2026,nameA:'Taylor',singlePerson:true,ageA:35,startCashA:50000});e.state.years[0].grossA=100000;
    e=createEngine(e.state);assert.equal(e.state.years[0].months.reduce((s,m)=>s+m.tfsaA+m.rrspA,0),0);
    e.state.years[0].planRoomCaps={tfsaA:5000,rrspA:10000,tfsaB:100000,rrspB:100000};for(const id in e.state.years[0].planRoomCaps)e.state.years[0].planRoomManual[id]=true;
    e=createEngine(e.state);assert.ok(e.state.years[0].months.reduce((s,m)=>s+m.tfsaA+m.rrspA,0)<=15000);assert.deepEqual(e.getInvestmentPriority(),['rrspA','tfsaA']);
    for(const y of e.state.years)for(const m of y.months)assert.equal(m.tfsaB+m.rrspB,0);
  });
  test('all Canadian jurisdictions produce bounded monotonic employment tax',()=>{
    for(const province of Object.keys(PROVINCES)){
      const e=createEngine({province});let last=0;for(let income=0;income<=400000;income+=5000){const t=e.personTax({employment:income,year:2026,age:40});assert.ok(Number.isFinite(t.total)&&t.total>=last-.01&&t.total<=income);last=t.total;}
    }
    const q=createEngine({province:'QC'}).personTax({employment:150000,year:2026,age:40});near(q.cpp,4895.3);near(q.ei,895.7);near(q.qpip,442.9);
  });
  test('setup: pay growth is an explicit choice',()=>{
    const s=freshPlan(),data={payGrowthChoice:'',inflationRate:'2',returnRateA:'5',retirementAge:'65',raiseA:'4'};
    assert.throws(()=>readAssumptions(s,data));readAssumptions(s,{...data,payGrowthChoice:'inflation'});assert.equal(s.raiseA,2);
    readAssumptions(s,{...data,payGrowthChoice:'unsure'});assert.equal(s.raiseA,0);assert.equal(s.payGrowthChoice,'unsure');
  });
  test('goal schedules are separate from spending and projection',()=>{
    let e=scenario();const before=projectionSummary(e);e.state.goals.push({goalKey:'travelFund',goalType:'saving',description:'Trip',targetAmount:12000,targetYear:2026,targetMonth:11,achievementMode:'dedicated',fundingPlan:{enabled:true,amountMode:'auto',startingAmount:0,frequency:'monthly',startYear:2026,startMonth:0,endYear:2026,endMonth:11}});
    e=createEngine(e.state);const r=e.computeGoalResults()[0];near(r.funding.amount,1000);assert.equal(r.funding.count,12);assert.deepEqual(projectionSummary(e),before);
  });
  test('save, reload, export, restore, and revert preserve the plan',()=>{
    const storage=memory(),s=createStore(storage);s.commit('Name',p=>{p.nameA='Taylor';});s.commit('Cash',p=>{p.startCashA=5000;});
    const again=createStore(storage);assert.equal(again.state.startCashA,5000);assert.equal(again.state.nameA,'Taylor');
    const backup=parseBackup(backupJSON(again.state));again.restore({...backup,nameA:'Jordan'});assert.equal(again.state.nameA,'Jordan');again.revert(again.history[0].id);assert.equal(again.state.nameA,'Taylor');
  });
  test('failed validation is atomic and failed storage is visible without losing edits',()=>{
    const storage=memory(),s=createStore(storage),before=JSON.stringify(s.state);
    assert.throws(()=>s.commit('Bad',p=>{p.startCashA=-1;}));assert.equal(JSON.stringify(s.state),before);assert.equal(s.history.length,0);
    storage.setItem=()=>{throw new Error('quota');};s.commit('Cash',p=>{p.startCashA=5000;});assert.match(s.error,/not saved/);assert.equal(s.state.startCashA,5000);assert.equal(parseBackup(backupJSON(s.state)).startCashA,5000);
  });
  test('corrupt saved data is not silently overwritten',()=>{
    const storage=memory();storage.setItem(STORAGE_KEY,'not JSON');const s=createStore(storage);assert.ok(s.loadError);assert.throws(()=>s.commit('Edit',p=>{p.nameA='Taylor';}));assert.equal(storage.getItem(STORAGE_KEY),'not JSON');
    s.restore(freshPlan());assert.equal(storage.getItem(STORAGE_KEY+'.recovery'),'not JSON');assert.equal(s.loadError,'');
  });
  test('import rejects malformed, hostile, nonfinite, and unsupported data',()=>{
    for(const text of ['{}','[]','null','{"format":"finance-plan-beta","version":9}', '{"__proto__":{"polluted":true}}'])assert.throws(()=>parseBackup(text));
    const s=freshPlan();s.years[0].months=[];assert.throws(()=>parseBackup(backupJSON(s)));
    assert.throws(()=>numberValue(Infinity));assert.throws(()=>numberValue(-1));assert.equal(numberValue('12.6',{whole:true}),13);
    assert.throws(()=>validateExpense({...expense('A','Bad',10),startDate:'2026-09',endDate:'2026-08'}));
  });
  test('all tabs and setup steps render without browser globals and escape user text',()=>{
    const e=scenario();e.state.nameA='<img src=x onerror=alert(1)>';const s=e.state;
    const result={annual:e.computeAnnualAggregates(),monthly:e.computeMonthlySeries(),salary:e.computeSalaryChain(),windows:e.resolveDrawdown().windows,goals:e.computeGoalResults()};
    const c={today:()=>new Date(2026,5,15),state:s,engine:e,result,year:2026,store:{history:[],error:'',updatedAt:null,backupAt:null}};
    s.lessons=[{id:'x',year:2026,month:0,at:'2026-02-01T00:00:00.000Z',note:'<img src=x onerror=alert(1)>'}];
    for(const module of [year,salary,budget,invest,goals,analysis,more,lessons]){const html=module.render(c);assert.ok(html.length>100);assert.ok(!html.includes('<img src=x'));}
    s.setup.started=true;for(let i=0;i<7;i++){s.setup.step=i;assert.ok(setup.render(c).includes('setup-form'));}
  });
  test('engine instances do not share state or caches',()=>{
    const a=scenario(),b=createEngine();const before=projectionSummary(a);b.state.startCashA=999999;assert.deepEqual(projectionSummary(a),before);
  });
  test('TFSA withdrawals restore known contribution room in the following year',()=>{
    let e=createEngine({baseYear:2026,nameA:'Taylor',singlePerson:true,ageA:50,investPct:0,returnRateA:0,returnRateB:0,startTFSAA:20000,budgetItems:[expense('A','Living',1000)]});
    e.state.drawdownPlans[2026]={strategy:'fixed',mode:'monthly',month:0,rrspPct:0};
    e.state.years[0].planRoomCaps.tfsaA=7000;e.state.years[0].planRoomManual.tfsaA=true;
    e=createEngine(e.state);
    const drawn=e.computeMonthlySeries()[0].months.reduce((sum,m)=>sum+m.autoWithdrawalTfsaA,0);
    near(drawn,12000);assert.equal(e.state.years[0].planRoomCaps.tfsaA,7000);
    assert.equal(e.state.years[1].planRoomCaps.tfsaA,7000+e.projectedTfsaAnnualLimit(2027).value+Math.round(drawn));
  });
  test('a stale tab cannot overwrite a newer plan by editing or marking a backup',()=>{
    const storage=memory(),first=createStore(storage),second=createStore(storage);
    first.commit('Name',s=>{s.nameA='New name';});
    assert.throws(()=>second.commit('Name',s=>{s.nameA='Old name';}),/Another tab/);
    second.markBackup();assert.match(second.error,/Another tab/);assert.equal(createStore(storage).state.nameA,'New name');
  });
  test('malformed nested backup settings are rejected before replacement',()=>{
    for(const mutate of [s=>{s.budgetMode='weekly';},s=>{s.setup.step='2';},s=>{s.ui.analysis={from:2080,to:2030};},s=>{s.pensions=null;},s=>{s.years[0].year='2026';},s=>{s.drawdownPlans={2026:[]};},s=>{s.years.push(structuredClone(s.years[0]));},s=>{s.years[0].annualReturnPct=-100;}]){
      const s=freshPlan();mutate(s);assert.throws(()=>parseBackup(backupJSON(s)));
    }
  });
  test('payday schedules count calendar occurrences and preserve locked months',()=>{
    assert.equal(paydaysInMonth({freq:'biweekly',start:'2026-01-02'},2026,0),3);
    assert.equal(paydaysInMonth({freq:'monthly',start:'2026-01-31'},2026,1),1);
    assert.throws(()=>paydaysInMonth({freq:'monthly',start:'2026-02-31'},2026,1));
    const e=createEngine({baseYear:2026,singlePerson:true});e.state.years[0].months[1].locked=true;
    const plan=paydayPlan(e.state,2026,{atA:52000},{A:{freq:'biweekly',start:'2026-01-02'}});
    assert.equal(plan[0].amount,6000);assert.equal(plan[1].status,'locked');
  });
  test('recurring extra entries edit their schedule without changing completed history',()=>{
    const e=createEngine({baseYear:2026,singlePerson:true});const input={start:'2026-01',end:'2026-12',frequency:'quarterly',type:'loss',person:'A',amount:500,note:'Quarterly bill'};
    assert.equal(saveExtraSeries(e.state,input),4);const first=e.state.years[0].months[0].extraEntries[0];
    e.state.years[0].months[0].locked=true;
    assert.equal(saveExtraSeries(e.state,{...input,amount:700},first.seriesId),3);
    assert.equal(e.state.years[0].months[0].extraEntries[0].amount,500);assert.equal(e.state.years[0].months[3].extraEntries[0].amount,700);
    assert.equal(e.state.years[0].months[3].extraEntries.length,1);
  });
  test('temporarily hiding a second person preserves their saved manual contributions',()=>{
    let e=scenario();e.state.years[0].months[1].tfsaB=4321;e.state.singlePerson=true;e.state.nameB='';
    e=createEngine(e.state);assert.equal(e.state.years[0].months[1].tfsaB,4321);assert.equal(e.computeMonthlySeries()[0].months[1].tfsaB,0);
  });
  test('month close-out: only ended months close; note saved; future and current blocked',()=>{
    const today=new Date(2026,2,15),e=createEngine({baseYear:2026,singlePerson:true}),st=e.state;
    assert.equal(monthEnded(2026,1,today),true);assert.equal(monthEnded(2026,2,today),false);assert.equal(monthEnded(2026,3,today),false);assert.equal(monthEnded(2025,11,new Date(2026,0,1)),true);
    assert.deepEqual(pendingMonths(st,today),[{year:2026,month:0},{year:2026,month:1}]);
    assert.throws(()=>closeMonth(st,2026,2,'x',today),/after it ends/);assert.throws(()=>closeMonth(st,2026,8,'x',today),/after it ends/);
    closeMonth(st,2026,0,'  Groceries ran high  ',today);closeMonth(st,2026,1,'   ',today);
    assert.equal(st.years[0].months[0].locked,true);assert.equal(st.years[0].months[1].locked,true);
    assert.equal(st.lessons.length,1);assert.equal(st.lessons[0].note,'Groceries ran high');assert.equal(st.lessons[0].month,0);
    assert.deepEqual(pendingMonths(st,today),[]);assert.throws(()=>closeMonth(st,2026,0,'again',today),/already closed/);
    assert.throws(()=>closeMonth(st,2026,0,'x'.repeat(1001),new Date(2027,0,1)),/already closed|under/);
  });
  test('closed months stay in projections and lessons list newest first',()=>{
    const open=createEngine({baseYear:2026,singlePerson:true,startCashA:5000}),shut=createEngine(structuredClone(open.state));
    closeMonth(shut.state,2026,0,'a',new Date(2026,1,2));
    const a=createEngine(shut.state),b=a.computeAnnualAggregates();assert.equal(b.length,open.computeAnnualAggregates().length);
    for(const v of Object.values(b[0]))if(typeof v==='number')assert.ok(Number.isFinite(v));
    closeMonth(shut.state,2026,1,'b',new Date(2026,2,2));
    assert.deepEqual(sortedLessons(shut.state).map(l=>l.note),['b','a']);
  });
  test('closing January preserves all twelve months in Year and analysis totals',()=>{
    const e=createEngine({baseYear:2026,singlePerson:true,province:'BC',ageA:38,budgetItems:[expense('A','Living costs',4300)]});
    e.state.years[0].grossA=64000;
    const before=project(e.state);
    near(before.monthly[0].months[0].earning,4198.81,1);
    closeMonth(e.state,2026,0,'',new Date(2026,1,2));
    const after=project(e.state),engine=createEngine(e.state);
    assert.equal(after.monthly[0].months[0].isCompleted,true);
    assert.deepEqual(after.annual,before.annual);
    near(after.annual[0].expense,51600);
    near(after.annual[0].earning,before.salary[0].totalAfterTax);
    assert.deepEqual(engine.analysisAggregates(),before.annual);
    const html=year.render({state:engine.state,engine,result:after,year:2026,today:()=>new Date(2026,1,2)});
    assert.match(html,/Their data still counts in totals/);
    assert.doesNotMatch(html,/id="month-0"/);
  });
  test('closing months preserves extras, contributions, withdrawals and carried balances',()=>{
    const e=scenario('retiringCouple');
    const jan=e.state.years[0].months[0];
    jan.earning=100;jan.expense=9000;jan.tfsaA=200;jan.rrspA=100;
    jan.extraEntries=[{type:'income',person:'A',amount:300},{type:'loss',person:'B',amount:50}];
    const before=e.computeAnnualAggregates();
    for(const m of [0,1,11])closeMonth(e.state,2026,m,'',new Date(2027,0,2));
    assert.deepEqual(createEngine(e.state).computeAnnualAggregates(),before);
  });
  test('lessons learned survive store, JSON export/import, and are validated',()=>{
    const e=createEngine({baseYear:2026,singlePerson:true});closeMonth(e.state,2026,0,'Cut takeout',new Date(2026,1,2));
    const store=createStore(memory());store.commit('Close',s=>{Object.assign(s,structuredClone(e.state));});
    assert.equal(store.state.lessons[0].note,'Cut takeout');
    const back=parseBackup(backupJSON(store.state));assert.equal(back.lessons[0].note,'Cut takeout');assert.equal(back.years[0].months[0].locked,true);
    const old=structuredClone(store.state);delete old.lessons;assert.deepEqual(createEngine(old).state.lessons,[]);
    const bad=structuredClone(store.state);bad.lessons[0].month=12;assert.throws(()=>validatePlan(bad));
    const bad2=structuredClone(store.state);bad2.lessons=[{id:'1',year:2026,month:0,at:'nope',note:'x'}];assert.throws(()=>validatePlan(bad2));
  });
}
