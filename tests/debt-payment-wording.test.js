import {test,expect} from 'vitest';
import {createEngine} from '../src/engine/index.js';
import {render as renderYear} from '../src/ui/year.js';
import {render as renderAnalysis} from '../src/ui/analysis.js';
import {render as renderBudget} from '../src/ui/budget.js';
import {balanceFields} from '../src/ui/setup.js';

test('mortgage cash spending is not presented as debt paydown or full net worth (#80)',()=>{
  const engine=createEngine({baseYear:2026,singlePerson:true,budgetItems:[{
    expense:'Mortgage payment',category:'Housing',owner:'A',cost:1900,
    recurrenceType:'monthly',startDate:'',endDate:'',repeatEvery:1,repeatUnit:'months'
  }]});
  const result={monthly:engine.computeMonthlySeries(),annual:engine.computeAnnualAggregates(),windows:[]};
  const c={engine,state:engine.state,result,year:2026,today:()=>new Date(2026,9,30)};
  expect(result.annual[0].expense).toBe(22800);
  const year=renderYear(c),analysis=renderAnalysis(c);
  for(const html of [year,analysis]){
    // The qualification must be visible alongside results, outside an info dialog.
    const notice=html.match(/<p class="hint tracked-balance-notice">(.*?)<\/p>/)?.[1];
    expect(notice).toContain('excludes property and debt balances');
    expect(notice).toContain('not full household net worth');
    expect(notice).toContain('Mortgage and other debt payments count in full as cash expenses');
    expect(notice).toContain('principal reduction, interest and home equity are not calculated');
    expect(html).not.toMatch(/Net worth, year end|Final net worth|<th>Net worth<\/th>/);
  }
  expect(year).toContain('Bank + investments, year end');
  expect(analysis).toContain('Final bank + investments');
  expect(analysis).toContain('<th>Bank + investments</th>');
  expect(analysis).toContain('aria-label="Bank + investments from');
  expect(renderBudget(c)).toContain('it is not full household net worth');
  expect(balanceFields(c.state)).toContain('The bank + investments total is not full household net worth');
});
