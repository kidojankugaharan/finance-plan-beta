import {createEngine} from '../src/engine/index.js';
export const expense=(owner,expense,cost,category='Housing')=>({owner,expense,cost,category,startDate:'',endDate:'',recurrenceType:'monthly',repeatEvery:1,repeatUnit:'months'});
export function scenario(kind='workingCouple') {
  const working=kind==='workingCouple';
  let e=createEngine({baseYear:2026,nameA:working?'Alex':'Pat',nameB:working?'Sam':'Lee',singlePerson:false,ageA:working?34:62,ageB:working?32:61,retirementAge:working?65:63,raiseA:working?2:0,raiseB:working?2:0,inflationRate:2.5,startTFSAA:working?30000:90000,startTFSAB:working?12000:80000,startRRSPA:working?40000:350000,startRRSPB:working?15000:250000,startCashA:working?8000:20000,startCashB:working?4000:10000,budgetItems:working?[expense('Both','Rent',2600),expense('A','Car',450,'Transport'),expense('B','Groceries',900,'Food')]:[expense('Both','Living costs',6500,'Living')]});
  e.state.years[0].grossA=working?95000:60000;e.state.years[0].grossB=working?70000:40000;
  e.state.years.find(y=>y.year===(working?2059:2028)).pensionModeOverride=true;
  return createEngine(e.state);
}
export function projectionSummary(e) {
  const salary=e.computeSalaryChain();
  return e.computeAnnualAggregates().map((a,i)=>({year:a.year,grossA:Math.round(salary[i].grossA),grossB:Math.round(salary[i].grossB),afterTax:Math.round(salary[i].totalAfterTax),expenses:Math.round(a.expense||0),netWorth:Math.round(a.netWorth||0),tfsa:Math.round(a.tfsaBal||0),rrsp:Math.round(a.rrspBal||0)}));
}
