import {test,expect} from 'vitest';
import {createEngine} from '../src/engine/index.js';
import {render} from '../src/ui/year.js';

function seasonalPlan({opening=3162,extra=0,closed=false,year=2026}={}) {
  const engine=createEngine({baseYear:2026,singlePerson:true,startCashA:opening,startCashB:0});
  const state=engine.state;
  const y=state.years.find(y=>y.year===2026);
  y.planAutoOff=true;
  y.months.forEach((m,i)=>{
    Object.assign(m,{earning:[1,2,10,11].includes(i)?0:4788,expense:2650,tfsaA:0,tfsaB:0,rrspA:0,rrspB:0});
    if(extra)m.extraEntries=[{type:'income',person:'A',amount:extra,note:'Additional income'}];
    if(closed)m.locked=true;
  });
  state.years.find(y=>y.year===2027).months.forEach(m=>Object.assign(m,{earning:4000,expense:2650}));
  const result={monthly:engine.computeMonthlySeries(),annual:engine.computeAnnualAggregates(),windows:[]};
  const html=render({engine,state,result,year,today:()=>new Date(2026,9,30)});
  return {html,result,notice:html.match(/<aside class="warning" id="cash-timing">.*?<\/aside>/)?.[0]};
}

test('Year summary surfaces seasonal cash gaps despite an annual surplus',()=>{
  const {html,result,notice}=seasonalPlan();
  expect(result.annual[0]).toMatchObject({earning:38304,expense:31800});
  expect(notice).toContain('February, March, November, December');
  expect(notice).toContain('bank buffer or investment withdrawals');
  expect(notice).toContain('An annual surplus can still leave monthly cash gaps');
  expect(notice).toContain('Lowest projected month-end bank balance: $0 in March');
  expect(html.indexOf('id="cash-timing"')).toBeLessThan(html.indexOf('Monthly cash flow'));
});

test('buffered and closed seasonal months still explain the annual cash timing risk',()=>{
  const {notice}=seasonalPlan({opening:20000,closed:true});
  expect(notice).toContain('February, March, November, December');
  expect(notice).toContain('$16,838 in March');
});

test('extra income covering monthly expenses removes the cash timing notice',()=>{
  expect(seasonalPlan({extra:2650}).notice).toBeUndefined();
});

test('cash timing notice follows the selected year rather than another year in the plan',()=>{
  const {notice}=seasonalPlan({year:2027});
  expect(notice).toBeUndefined();
});
