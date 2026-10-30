import {field,select,card,button,submit,listen,escape,money,people,name,employmentIncomeNotice} from './shared.js';
import {numberValue} from '../validation.js';
import {PROVINCES} from '../engine/provinces.js';

const steps=['Household','Income','Expenses','Starting balances','Assumptions','Pensions','Review'];
export function householdFields(s) {
  return `<div class="fields">${field('nameA','Your name',s.nameA,{type:'text',required:true})}${field('ageA','Your age in the starting year',s.ageA,{min:18,max:110,step:1,required:true})}${field('nameB','Second person’s name (optional)',s.nameB,{type:'text',hint:'Leave blank for a one-person plan.'})}${field('ageB','Second person’s age',s.ageB,{min:18,max:110,step:1})}${field('baseYear','Starting year',s.baseYear,{min:2026,max:2086,step:1,required:true})}${select('province','Province or territory',Object.entries(PROVINCES).map(([id,p])=>[id,p.name]),s.province)}</div>`;
}
export function readHousehold(s,d) {
  s.nameA=d.nameA.trim().slice(0,40); if(!s.nameA)throw new Error('Enter your name.');
  s.nameB=d.nameB.trim().slice(0,40);s.singlePerson=!s.nameB;
  s.ageA=numberValue(d.ageA,{min:18,max:110,whole:true});
  s.ageB=numberValue(d.ageB,{min:18,max:110,whole:true,optional:s.singlePerson});
  s.baseYear=numberValue(d.baseYear,{min:2026,max:2086,whole:true});s.baseYearUserSet=true;s.province=d.province;
  if(s.ui.analysis)for(const key of ['from','to'])if(s.ui.analysis[key]!==undefined)s.ui.analysis[key]=Math.max(s.baseYear,s.ui.analysis[key]);
}
export function balanceFields(s) {
  return `<p>Enter balances at <strong>January 1, ${s.baseYear}</strong>. Use a year-start statement. Current balances would count this year’s earnings twice.</p><div class="fields">${people(s).map(p=>['Cash','TFSA','RRSP'].map(a=>field(`start${a==='Cash'?'Cash':a}${p}`,`${name(s,p)} · ${a==='Cash'?'Bank balance':a}`,s[`start${a}${p}`],{required:true})).join('')).join('')}</div><p class="hint">All amounts are Canadian dollars. Money you enter is rounded to whole dollars. Debt balances are outside this plan and are not subtracted from net worth. Enter debt payments as Budget expenses; they do not track or pay down a debt balance.</p>`;
}
export function readBalances(s,d) {for(const p of people(s))for(const a of ['Cash','TFSA','RRSP'])s[`start${a}${p}`]=numberValue(d[`start${a}${p}`],{whole:true});}
function stopWorkAge(s,p) {
  if(s['retirementAge'+p]!=null)return s['retirementAge'+p];
  const ages=people(s).map(p=>Number(s['age'+p])).filter(a=>a>0);
  return ages.length && s['age'+p] ? Math.max(Number(s['age'+p]), Number(s['age'+p])+s.retirementAge-Math.min(...ages)) : s.retirementAge;
}
export function assumptionFields(s) {
  return `<div class="fields">${select('payGrowthChoice','Choose an assumption', [['','Choose an assumption'],['same','Same pay'],['inflation','Keeps up with prices'],['custom','Custom growth'],['unsure','Not sure — use 0% provisionally']],s.payGrowthChoice,'How should your pay change?')}${field('raiseA','Custom annual pay growth (%)',s.raiseA,{min:-50,max:50})}${field('inflationRate','Annual price inflation (%)',s.inflationRate,{max:20,required:true})}${field('returnRateA','Annual investment return (%)',s.returnRateA,{min:-99,max:100,required:true})}${people(s).map(p=>field('retirementAge'+p,`${name(s,p)}: stop-work age`,stopWorkAge(s,p),{min:18,max:100,step:1,required:true})).join('')}</div><p class="hint">Each salary stops when that person reaches their stop-work age. Set different ages for staggered retirement. Yearly keep-working choices in Salary apply to the household and carry forward. Inflation and returns are estimates, not forecasts.</p>`;
}
export function readAssumptions(s,d) {
  if(!['same','inflation','custom','unsure'].includes(d.payGrowthChoice))throw new Error('Choose how your pay should change.');
  s.payGrowthChoice=d.payGrowthChoice;s.inflationRate=numberValue(d.inflationRate,{max:20});
  s.raiseA=d.payGrowthChoice==='inflation'?s.inflationRate:d.payGrowthChoice==='custom'?numberValue(d.raiseA,{min:-50,max:50}):0;s.raiseB=s.raiseA;
  s.returnRateA=numberValue(d.returnRateA,{min:-99,max:100});s.returnRateB=s.returnRateA;
  s.years[0].annualReturnPct=s.returnRateA;s.years[0].annualReturnPctManual=true;
  for(const p of people(s))s['retirementAge'+p]=numberValue(d['retirementAge'+p],{min:18,max:100,whole:true});
}
export function pensionFields(s) {
  return `<p>Public pensions are estimated separately for each person. OAS assumes 40 years of Canadian residence after age 18. CPP/QPP estimates use your salary history; enter your benefit estimate as a share of the maximum for a better fit.</p><div class="fields">${people(s).map(p=>`${field(`cppStart${p}`,`${name(s,p)} · CPP/QPP start age`,s.pensions[p].cppStartAge,{min:60,max:70,step:1,required:true})}${field(`oasStart${p}`,`${name(s,p)} · OAS start age`,s.pensions[p].oasStartAge,{min:65,max:70,step:1,required:true})}${field(`cppPct${p}`,`${name(s,p)} · CPP/QPP share of maximum (%)`,s.pensions[p].cppPct,{max:100,hint:'Blank uses a salary-based estimate.'})}`).join('')}</div><p class="hint">Pensions enter this projection after each person stops working. For payments received while working, use a yearly income override. Quebec uses a simplified CPP-based retirement benefit estimate; QPP deferral beyond 70 is not modelled.</p>`;
}
export function readPensions(s,d) {for(const p of people(s))s.pensions[p]={cppStartAge:numberValue(d[`cppStart${p}`],{min:60,max:70,whole:true}),oasStartAge:numberValue(d[`oasStart${p}`],{min:65,max:70,whole:true}),cppPct:numberValue(d[`cppPct${p}`],{max:100,optional:true})};}
function content(c,step) {
  const s=c.state;
  if(step===0)return householdFields(s);
  if(step===1)return `<p>Annual employment income before tax. Enter 0 if you are not working.</p>${employmentIncomeNotice}<div class="fields">${people(s).map(p=>field('gross'+p,`${name(s,p)} · annual salary`,s.years[0]['gross'+p],{required:true})).join('')}</div>`;
  if(step===2)return `<p>Start with one monthly expense. You can add categories, dates, and other frequencies in Budget later.</p>${s.budgetItems.length?`<p>${s.budgetItems.length} expenses entered · ${money(c.engine.budgetTotalAnnual(s.baseYear))} per year.</p>`:`<div class="fields">${field('expense','Expense name','',{type:'text',placeholder:'Housing, groceries, transport…'})}${field('cost','Monthly amount','',{hint:'Leave both fields blank to finish this step later.'})}</div>`}`;
  if(step===3)return balanceFields(s);
  if(step===4)return assumptionFields(s);
  if(step===5)return pensionFields(s);
  const retire=c.engine.retirementStartYear();
  const balances=[['Cash','Bank balances'],['TFSA','TFSA balances'],['RRSP','RRSP balances']].map(([account,label])=>{
    const total=people(s).reduce((sum,p)=>sum+s[`start${account}${p}`],0);
    return `<dt>${label}</dt><dd>${money(total)} · ${total?'entered':'zero'}</dd>`;
  }).join('');
  return `<p>Review your plan before opening the projection.</p><dl class="review"><dt>Household</dt><dd>${people(s).map(p=>escape(name(s,p))).join(' & ')} · ${PROVINCES[s.province].name}</dd><dt>Annual salary</dt><dd>${money(c.result.salary[0].grossA+c.result.salary[0].grossB)} · entered</dd><dt>Expenses</dt><dd>${s.budgetItems.length?money(c.engine.budgetTotalAnnual(s.baseYear))+' / year · entered':'Not answered — projection is a draft'}</dd>${balances}<dt>Pay growth</dt><dd>${s.raiseA}% · ${s.payGrowthChoice==='unsure'?'provisional estimate':escape(s.payGrowthChoice)}</dd><dt>Inflation / return</dt><dd>${s.inflationRate}% / ${s.returnRateA}% · estimates</dd><dt>Stop-work years</dt><dd>${people(s).map(p=>escape(name(s,p))+': '+(Number.isFinite(c.engine.personRetirementStartYear(p))?c.engine.personRetirementStartYear(p):'Age not answered')).join('; ')}</dd></dl><p>You can change every assumption in More. Planned savings goals do not reserve money or check affordability.</p>`;
}
export function render(c) {
  const s=c.state;
  if(!s.setup.started)return `<section class="welcome"><span class="eyebrow">YOUR MONEY · YOUR DEVICE</span><h1>A clearer view<br>of what comes next.</h1><p>Connect today’s budget to tomorrow’s possibilities. A private Canadian household plan, from your next paycheque to retirement.</p><div class="pills"><span>No account</span><span>Works offline</span><span>Canadian dollars</span></div>${button('start-setup','Build my plan','primary')}<p class="hint">About five minutes. You can finish later.</p>${button('welcome-import','Import a backup')}</section>`;
  const step=Math.min(6,Math.max(0,s.setup.step||0));
  return `<div class="page-heading"><span class="eyebrow">SETUP · ${step+1} OF ${steps.length}</span><h1>${steps[step]}</h1></div><div class="progress" aria-label="Step ${step+1} of 7"><span style="width:${(step+1)/7*100}%"></span></div>${card(steps[step],`<form id="setup-form">${content(c,step)}<div class="form-actions">${step?'<button type="submit" name="direction" value="back" formnovalidate class="secondary">Back</button>':''}<button type="submit" name="direction" value="next">${step===6?'Open my plan':'Continue'}</button></div><button type="submit" name="direction" value="later" formnovalidate class="text-button">Save and finish later</button></form>`)}`;
}
export function bind(c) {
  const draft=c.state.setup.drafts?.[c.state.setup.step||0];
  if(draft)for(const [key,value] of Object.entries(draft)){const input=document.getElementById('setup-form')?.elements.namedItem(key);if(input)input.value=value;}
  listen('start-setup','click',()=>c.update('Started setup',s=>{s.setup.started=true;}));
  listen('welcome-import','click',()=>c.importBackup());
  submit('setup-form',(d,e)=>{
    const direction=e.submitter?.value||'next',step=c.state.setup.step||0;
    if(direction==='back'||direction==='later'){
      c.update(direction==='back'?'Previous setup step':'Saved setup draft',s=>{
        s.setup.drafts??={};s.setup.drafts[step]=d;
        if(direction==='later')s.setup.paused=true;else s.setup.step=Math.max(0,step-1);
      });return;
    }
    c.update('Setup: '+steps[step],s=>{
      if(step===0)readHousehold(s,d);
      if(step===1)for(const p of people(s))s.years[0]['gross'+p]=numberValue(d['gross'+p],{whole:true});
      if(step===2 && !s.budgetItems.length && (d.expense?.trim() || d.cost))s.budgetItems.push({owner:'Both',expense:d.expense.trim(),category:'Living',cost:numberValue(d.cost,{whole:true}),recurrenceType:'monthly',startDate:'',endDate:'',repeatEvery:1,repeatUnit:'months'});
      if(step===3)readBalances(s,d);
      if(step===4)readAssumptions(s,d);
      if(step===5)readPensions(s,d);
      s.setup.seen[steps[step]]=true;
      if(s.setup.drafts)delete s.setup.drafts[step];
      if(direction==='later')s.setup.paused=true;
      else if(direction==='back')s.setup.step=Math.max(0,step-1);
      else if(step===6){s.setup.completed=true;s.setup.paused=false;}
      else s.setup.step=step+1;
    });
  });
}
