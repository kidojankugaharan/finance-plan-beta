import {test,expect} from 'vitest';
import {createEngine} from '../src/engine/index.js';
import {render} from '../src/ui/analysis.js';

function depletedPlan(singlePerson=false) {
  const engine=createEngine({baseYear:2061,singlePerson,ageA:65,ageB:65,
    startCashA:150,startCashB:0,startTFSAA:200,startTFSAB:0,
    startRRSPA:300,startRRSPB:0,investPct:0,returnRateA:0,returnRateB:0});
  for(const y of engine.state.years){
    y.planAutoOff=true;
    for(const m of y.months)Object.assign(m,{earning:0,expense:100,tfsaA:0,tfsaB:0,rrspA:0,rrspB:0});
  }
  return engine;
}

for(const single of [false,true])for(const mode of ['monthly','lump']){
  test(`depleted assets stay at zero with separate monthly shortfalls (${single?'single':'couple'}, ${mode})`,()=>{
    const e=depletedPlan(single);
    const policies=Object.fromEntries(e.state.years.map(y=>[y.year,{strategy:'fixed',mode,month:0}]));
    const series=e.computeMonthlySeriesCore(policies),first=series[0].months;
    expect(first.slice(0,6).every(m=>m.autoWithdrawalUncovered===0)).toBe(true);
    expect(first[6]).toMatchObject({cash:0,tfsaBal:0,rrspBal:0,netWorth:0,autoWithdrawalUncovered:68});
    // The $300 RRSP also incurs $18 of withdrawal tax.
    expect(first.reduce((sum,m)=>sum+m.autoWithdrawalTax,0)).toBeCloseTo(18);
    expect(first[7].autoWithdrawalUncovered).toBe(100);
    expect(series[1].openingCashCombined).toBe(0);
    for(const y of series)for(const m of y.months){
      expect(m.cash).toBeGreaterThanOrEqual(0);
      expect(m.netWorth).toBeGreaterThanOrEqual(0);
    }
    expect(series.at(-1).months[11]).toMatchObject({cash:0,netWorth:0,autoWithdrawalUncovered:100});
    const metrics=e.drawdownMetrics(series,e.computeSalaryChain(),2062);
    expect(metrics.afterTaxNetWorth).toBe(0);
    expect(metrics.uncovered).toBe(1768);
  });
}

test('projection reports annual unfunded spending independently of assets in future and real dollars',()=>{
  const e=depletedPlan(),state=e.state;
  const annual=e.computeAnnualAggregates();
  expect(annual[0]).toMatchObject({netWorth:0,autoWithdrawalUncovered:568});
  expect(annual[1]).toMatchObject({netWorth:0,autoWithdrawalUncovered:1200});
  const html=render({engine:e,state});
  expect(html).toContain('Unfunded shortfall from 2061');
  expect(html).toContain('<th>Unfunded shortfall</th>');
  expect(html).toContain('<td>$568</td>');
  expect(html).toContain('<td>$1,200</td>');
  expect(html).not.toContain('Negative bank balances');
  state.ui.analysis={realDollars:true};
  expect(e.analysisAggregates()[1].autoWithdrawalUncovered).toBeCloseTo(1200/1.025);
  expect(e.analysisAggregates()[1].netWorth).toBe(0);
});

test('later income resumes cash accumulation without silently funding earlier shortfalls',()=>{
  const e=depletedPlan();
  e.state.years[1].months[0].earning=400;
  const series=e.computeMonthlySeriesCore({});
  expect(series[0].months[11].autoWithdrawalUncovered).toBe(100);
  expect(series[1].months[0]).toMatchObject({cash:300,netWorth:300,autoWithdrawalUncovered:0});
});
