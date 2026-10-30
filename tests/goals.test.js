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
  assert.match(html,/Household net worth/);
  assert.match(html,/does not show money earmarked or available for this goal/);
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
  assert.match(html,/Combined bank \/ cash/);
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
