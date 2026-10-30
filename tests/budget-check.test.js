import {test,expect} from 'vitest';
import {createEngine} from '../src/engine/index.js';
import {backupJSON,parseBackup} from '../src/state.js';
import {missingMortgage,mortgageNotice} from '../src/ui/budget-check.js';
import {render} from '../src/ui/budget.js';
import {status} from '../src/ui/year.js';

const living={expense:'Household expenses (excluding mortgage)',category:'Living',owner:'Both',cost:3500,recurrenceType:'monthly',startDate:'',endDate:'',repeatEvery:1,repeatUnit:'months'};
const payment={...living,expense:'Mortgage payment',category:'Housing',cost:1900};
const makeEngine=(items=[living],extra={})=>createEngine({baseYear:2026,budgetItems:structuredClone(items),...extra});

test('imported mortgage exclusion warns without inventing a payment; adding payment restores totals',()=>{
  const source=makeEngine().state;
  const imported=parseBackup(backupJSON(source));
  const engine=createEngine(imported),c={engine,state:engine.state,year:2026,result:{monthly:[]}};
  expect(imported).toEqual(source);
  expect(engine.budgetTotalAnnual(2026)).toBe(42000);
  expect(mortgageNotice(engine,2026)).toContain('Mortgage payment may be missing');
  expect(render(c)).toContain('role="alert"');
  expect(status(c)).toMatchObject({text:'Review mortgage spending',tab:'budget'});
  engine.state.budgetItems.push({...payment});
  expect(missingMortgage(engine,2026)).toBe(false);
  expect(render(c)).not.toContain('mortgage-warning');
  expect(status(c).text).toBe('Your plan covers projected spending');
  expect(engine.budgetTotalAnnual(2026)).toBe(64800);
  expect(engine.computeAnnualAggregates()[0].expense).toBe(64800);
});

test('inactive, excluded, zero and partially dated mortgage payments cannot hide missing months',()=>{
  for(const change of [{cost:0},{owner:'n/a'},{category:'n/a'},{recurrenceType:'none'},{startDate:'2026-07'},{endDate:'2025-12'}]) {
    expect(missingMortgage(makeEngine([living,{...payment,...change}]),2026)).toBe(true);
  }
  expect(missingMortgage(makeEngine([{...living,startDate:'2026-07'},{...payment,startDate:'2026-07'}]),2026)).toBe(false);
  expect(missingMortgage(makeEngine([{...living,recurrenceType:'none'}]),2026)).toBe(false);
});

test('checks effective by-year lists, including carry-forward, rather than unused auto items',()=>{
  const engine=makeEngine([living,payment],{budgetMode:'year',budgetByYear:{2026:[living],2028:[living,payment]}});
  expect(missingMortgage(engine,2027)).toBe(true);
  expect(missingMortgage(engine,2028)).toBe(false);
});

test('explicit exclusions are case insensitive; ordinary housing expenses do not trigger warning',()=>{
  for(const expense of ['Living WITHOUT the MORTGAGE','Household expenses (excludes mortgage)'])expect(missingMortgage(makeEngine([{...living,expense}]),2026)).toBe(true);
  for(const expense of ['Housing','Household expenses including mortgage','Mortgage payment'])expect(missingMortgage(makeEngine([{...living,expense}]),2026)).toBe(false);
});
