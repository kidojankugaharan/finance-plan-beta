import {test} from 'vitest';
import assert from 'node:assert/strict';
import {createEngine} from '../src/engine/index.js';
import {assumptionFields,readAssumptions} from '../src/ui/setup.js';
import {render as salaryView} from '../src/ui/salary.js';
import {backupJSON,parseBackup} from '../src/state.js';

function staggered() {
  const e=createEngine({baseYear:2026,nameA:'Pat',nameB:'Lee',singlePerson:false,ageA:62,ageB:59});
  e.state.years[0].grossA=60000;e.state.years[0].grossB=24000;
  readAssumptions(e.state,{payGrowthChoice:'same',inflationRate:'2',returnRateA:'5',retirementAgeA:'62',retirementAgeB:'65'});
  return createEngine(e.state);
}
test('individual stop-work ages preserve partner earnings, taxes and RRSP room during staggered retirement',()=>{
  const e=staggered(),rows=e.computeSalaryChain(),r=rows[3];
  assert.equal(e.personRetirementStartYear('A'),2026);
  assert.equal(e.personRetirementStartYear('B'),2032);
  assert.equal(r.pensionActiveA,true);assert.equal(r.pensionActiveB,false);assert.equal(r.pensionActive,false);
  assert.equal(r.taxCtxA.employment,undefined);assert.equal(r.taxCtxB.employment,24000);
  assert.equal(r.grossB,24000);assert.ok(r.taxB.cpp>0);assert.ok(r.pensionA.oas>0);
  assert.equal(e.projectedRrspNewRoom(4,'rrspA',rows).value,0);
  assert.equal(e.projectedRrspNewRoom(4,'rrspB',rows).value,4320);
  assert.equal(e.salaryRowsFor('A')[3].pensionActive,true);
  assert.equal(e.salaryRowsFor('B')[3].pensionActive,false);
  assert.equal(rows[6].pensionActive,true);assert.equal(rows[6].taxCtxB.employment,undefined);
  const html=salaryView({state:e.state,engine:e,result:{salary:rows},year:2029});
  assert.match(html,/One retired/);assert.match(html,/<dd>Working<\/dd>/);assert.match(html,/<dd>2032<\/dd>/);
  assert.equal(createEngine(parseBackup(backupJSON(e.state))).computeSalaryChain()[3].grossB,24000);
});
test('shared-age backups retain their timing and individual ages are validated',()=>{
  const e=createEngine({baseYear:2026,ageA:62,ageB:59,singlePerson:false,retirementAge:62});
  assert.equal(e.personRetirementStartYear('A'),2029);assert.equal(e.personRetirementStartYear('B'),2029);
  const html=assumptionFields(e.state);
  assert.match(html,/id="retirementAgeA"[^>]*value="65"/);assert.match(html,/id="retirementAgeB"[^>]*value="62"/);
  for(const age of [17,101,'bad'])assert.throws(()=>parseBackup(backupJSON({...e.state,retirementAgeB:age})));
});
test('individual retirement honours carried household work overrides and ignores absent partners',()=>{
  const e=staggered();e.state.years[0].pensionModeOverride=false;e.state.years[3].pensionModeOverride=true;
  const rows=e.computeSalaryChain();
  assert.equal(rows[2].grossA,60000);assert.equal(rows[2].grossB,24000);
  assert.equal(rows[3].pensionActiveA,true);assert.equal(rows[3].pensionActiveB,false);
  assert.equal(rows[6].pensionActive,true);
  const single=createEngine({...e.state,singlePerson:true});
  assert.equal(single.retirementStartYear(),2026);assert.equal(single.computeSalaryChain()[3].pensionActiveB,false);
});

test('second partner can retire first without pension income creating RRSP room',()=>{
  const e=staggered();e.state.retirementAgeA=68;e.state.retirementAgeB=59;
  const rows=e.computeSalaryChain();
  assert.equal(rows[3].pensionActiveA,false);assert.equal(rows[3].pensionActiveB,true);
  assert.equal(rows[3].grossA,60000);assert.equal(rows[3].taxCtxB.employment,undefined);
  assert.equal(e.projectedRrspNewRoom(4,'rrspA',rows).value,10800);
  assert.equal(e.projectedRrspNewRoom(4,'rrspB',rows).value,0);
});
