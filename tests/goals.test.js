import {test} from 'vitest';
import assert from 'node:assert/strict';
import {createEngine} from '../src/engine/index.js';
import * as goals from '../src/ui/goals.js';

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
  assert.doesNotMatch(html,/target met|Achieved|<progress/);
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
  assert.doesNotMatch(html,/target met|Achieved|<progress/);
});

test('intentional wealth milestones keep metric progress',()=>{
  const e=createEngine({baseYear:2026,startCashA:100000,goals:[{
    goalKey:'netWorthMilestone',goalType:'wealth',description:'Net worth milestone',
    targetAmount:45000,targetYear:2030,targetMonth:11,achievementMode:'automatic'
  }]});
  const html=goals.render({engine:e,state:e.state,result:{goals:e.computeGoalResults()}});
  assert.match(html,/Metric: target met/);
  assert.match(html,/<progress/);
});
