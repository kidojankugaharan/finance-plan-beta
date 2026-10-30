import {test} from 'vitest';
import assert from 'node:assert/strict';
import {createEngine} from '../src/engine/index.js';
import * as goals from '../src/ui/goals.js';

test('saved goal cards scope achievement to the tracked metric',()=>{
  const e=createEngine({baseYear:2026,startCashA:50000,goals:[{
    goalKey:'customNetWorth',goalType:'other',description:'Accessible home improvements',
    targetAmount:18000,targetYear:2028,targetMonth:11,achievementMode:'automatic'
  }]});
  const result={goals:e.computeGoalResults()};
  assert.equal(result.goals[0].status,'Achieved');
  const html=goals.render({engine:e,state:e.state,result});
  assert.match(html,/Metric: target met/);
  assert.match(html,/does not show money earmarked or available for this goal/);
  assert.doesNotMatch(html,/>Achieved</);
});
