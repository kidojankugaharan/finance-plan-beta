import {test} from 'vitest';
import assert from 'node:assert/strict';
import {createEngine} from '../src/engine/index.js';
import * as goals from '../src/ui/goals.js';
import {money} from '../src/ui/shared.js';

test.each([
  ['Sabbatical fund','customNetWorth','other',45000],
  ['Down payment','homeDownPayment','saving',80000]
])('saved %s goal cannot claim funding from household net worth', (description,goalKey,goalType,targetAmount)=>{
  const e=createEngine({baseYear:2026,startCashA:50000,goals:[{
    goalKey,goalType,description,targetAmount,
    targetYear:2030,targetMonth:11,achievementMode:'existing',existingMetric:'netWorth'
  }]});
  e.state.startRRSPA=900000;
  const result={goals:e.computeGoalResults()};
  assert.equal(result.goals[0].status,'Achieved');
  const html=goals.render({engine:e,state:e.state,result});
  assert.match(html,/Funding not assessed/);
  assert.doesNotMatch(html,/Household net worth/);
  assert.match(html,/Funding cannot be assessed from household balances alone/);
  assert.match(html,/edit this goal and choose/);
  assert.doesNotMatch(html,/target met|Achieved|<progress|Projected metric at target date/);
  assert.match(html,/Savings toward this goal at target date: Not assessed/);
  assert.ok(!html.includes(money(result.goals[0].projectedValue)));
  assert.equal(e.state.goals[0].achievementMode,'existing');
});

test('legacy automatic custom net-worth goals require funding assessment',()=>{
  const e=createEngine({baseYear:2026,startCashA:100000,goals:[{
    goalKey:'customNetWorth',goalType:'other',description:'Sabbatical',
    targetAmount:45000,targetYear:2030,targetMonth:11,achievementMode:'automatic'
  }]});
  const result={goals:e.computeGoalResults()};
  assert.equal(result.goals[0].status,'Achieved');
  const html=goals.render({engine:e,state:e.state,result});
  assert.match(html,/Funding not assessed/);
  assert.doesNotMatch(html,/target met|Achieved|<progress|Projected metric at target date/);
});

test.each([true,false])('down payment does not present general bank cash as goal savings (active: %s)',active=>{
  const e=createEngine({baseYear:2026,startCashA:100000,startCashB:25000,goals:[{
    goalKey:'homeDownPayment',goalType:'saving',description:'Down payment',
    targetAmount:80000,targetYear:2030,targetMonth:11,
    achievementMode:'existing',existingMetric:'bank',active
  }]});
  const result={goals:e.computeGoalResults()};
  assert.equal(result.goals[0].metric,'bank');
  assert.ok(result.goals[0].projectedValue>80000);
  const html=goals.render({engine:e,state:e.state,result});
  assert.match(html,active?/Funding not assessed/:/Paused/);
  assert.doesNotMatch(html,/Combined bank \/ cash/);
  assert.match(html,/Savings toward this goal at target date: Not assessed/);
  assert.match(html,/\$80,000/);
  assert.match(html,/By December 2030/);
  assert.doesNotMatch(html,/Projected metric at target date|<progress|target met/);
  assert.ok(!html.includes(money(result.goals[0].projectedValue)));
});

test('separate down payment savings schedule retains its planned amount and progress',()=>{
  const e=createEngine({baseYear:2026,startCashA:100000,goals:[{
    goalKey:'homeDownPayment',goalType:'saving',description:'Down payment',
    targetAmount:80000,targetYear:2030,targetMonth:11,achievementMode:'dedicated',
    fundingPlan:{startingAmount:12000,amountMode:'fixed',amount:0}
  }]});
  const html=goals.render({engine:e,state:e.state,result:{goals:e.computeGoalResults()}});
  assert.match(html,/Planned savings at target date: \$12,000/);
  assert.match(html,/<progress/);
  assert.doesNotMatch(html,/Not assessed|Funding not assessed/);
});

test('intentional wealth milestones keep metric progress',()=>{
  const e=createEngine({baseYear:2026,startCashA:100000,goals:[{
    goalKey:'netWorthMilestone',goalType:'wealth',description:'Net worth milestone',
    targetAmount:45000,targetYear:2030,targetMonth:11,achievementMode:'automatic'
  }]});
  const html=goals.render({engine:e,state:e.state,result:{goals:e.computeGoalResults()}});
  assert.match(html,/Metric: target met/);
  assert.match(html,/Projected metric at target date:/);
  assert.match(html,/<progress/);
});

// Issue #83: explain the inputs and action needed to assess planned savings.
test('unassessed sabbatical explains how to assess a separate savings schedule',()=>{
  const e=createEngine({baseYear:2026,startCashA:100000,startRRSPA:900000,goals:[{
    goalKey:'customNetWorth',goalType:'other',description:'Sabbatical fund',
    targetAmount:45000,targetYear:2030,targetMonth:11,achievementMode:'automatic'
  }]});
  const before=JSON.stringify(e.state);
  const html=goals.render({engine:e,state:e.state,result:{goals:e.computeGoalResults()}});
  assert.match(html,/surplus and investments are not automatically allocated to this goal/);
  assert.match(html,/compare planned savings with this \$45,000 target by December 2030/);
  assert.match(html,/edit this goal and choose &quot;A separate planned savings schedule&quot; under &quot;How to measure progress&quot;/);
  for(const label of ['Already saved','Frequency','Start year','Start month','Fixed amount per payment','Divide remaining target across the schedule']){
    assert.ok(html.includes(`&quot;${label}&quot;`),`Missing schedule input guidance: ${label}`);
  }
  assert.match(html,/Save changes to see whether the scheduled savings meet the target/);
  assert.match(html,/Affordability is not checked/);
  assert.match(html,/schedule does not move money in your projection/);
  assert.doesNotMatch(html,/Household net worth|Projected metric at target date|<progress|target met/);
  assert.equal(JSON.stringify(e.state),before);
});
