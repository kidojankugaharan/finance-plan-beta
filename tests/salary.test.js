import {afterEach,expect,test,vi} from 'vitest';
import {createEngine} from '../src/engine/index.js';
import {render,bind} from '../src/ui/salary.js';
import {money} from '../src/ui/shared.js';

afterEach(()=>vi.unstubAllGlobals());

function plan() {
  const engine=createEngine({baseYear:2026,singlePerson:false,nameA:'Worker A',nameB:'Worker B',ageA:30,ageB:30,raiseA:0});
  engine.state.years[0].grossA=105000;
  engine.state.years[0].grossB=26000;
  engine.state.years[1].grossA=85000;
  return {engine,state:engine.state,year:2026,result:{salary:engine.computeSalaryChain()},refresh:vi.fn()};
}
async function view(c,mode) {
  const handlers={};
  vi.stubGlobal('document',{
    getElementById:id=>({addEventListener:(event,handler)=>{handlers[id]=handler;}}),
    querySelectorAll:()=>[],
  });
  bind(c);
  await handlers['salary-'+mode]();
  return render(c);
}
function tracker(html) {return html.match(/<table class="salary-tracker">.*?<\/table>/s)[0];}
function groupedRow(html,year) {return html.match(new RegExp('<button class="year-group-row" data-salary-edit="'+year+'">.*?<\/button>'))[0];}

test('year-specific pay is attributed to its entry and inherited years, separately from household totals',async()=>{
  const c=plan(),html=await view(c,'person'),table=tracker(html);
  expect(table).toContain('$105,000<small class="salary-source">Entered for 2026</small>');
  expect(table).toContain('$85,000<small class="salary-source">Entered for 2027</small>');
  expect(table.match(/From 2027 entry/g)).toHaveLength(3);
  expect(table).not.toContain('$26,000');
  expect(html).toContain('later blank years inherit it plus the listed growth');
  expect(html).toContain('<th>Household gross</th>');
  expect(html).toContain('<tr><th>2027</th><td>$111,000</td>');
  expect(groupedRow(html,2031)).toContain('$85,000');
  expect(groupedRow(html,2031)).toContain('From 2027 entry');
  expect(c.state.years[2].grossA).toBeNull();
});

test('expanded years follow Combined and Biweekly views as well as By person',async()=>{
  const c=plan(),r=c.result.salary[5];
  const combined=await view(c,'combined');
  expect(groupedRow(combined,2031)).toContain(money(r.grossA+r.grossB));
  expect(groupedRow(combined,2031)).not.toContain('salary-source');
  const biweekly=await view(c,'biweekly');
  expect(groupedRow(biweekly,2031)).toContain(money(r.totalAfterTax/26));
  expect(tracker(biweekly)).toContain(money(c.result.salary[0].totalAfterTax/26));
  await view(c,'person');
});

test('zero salary entries remain explicit and growth does not change their source year',async()=>{
  const c=plan();
  c.state.years[2].grossA=0;
  c.state.years[3].grossA='';
  c.state.years[3].salaryGrowthPct=3;
  c.result.salary=c.engine.computeSalaryChain();
  const table=tracker(await view(c,'person'));
  expect(table).toContain('$0<small class="salary-source">Entered for 2028</small>');
  expect(table).toContain('$0<small class="salary-source">From 2028 entry</small>');
  c.state.years[2].grossA=null;
  c.result.salary=c.engine.computeSalaryChain();
  const grown=tracker(await view(c,'person'));
  expect(grown).toContain('$87,550<small class="salary-source">From 2027 entry</small>');
});

test('retirement income is identified instead of being attributed to a salary entry',async()=>{
  const c=plan();
  c.state.retirementAgeA=31;
  c.result.salary=c.engine.computeSalaryChain();
  const table=tracker(await view(c,'person'));
  expect(c.result.salary[1].pensionActiveA).toBe(true);
  expect(table).toContain('Pension income');
  expect(table).not.toContain('Entered for 2027');
});
