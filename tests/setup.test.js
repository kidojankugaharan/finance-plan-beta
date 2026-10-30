import {test} from 'vitest';
import assert from 'node:assert/strict';
import {createEngine} from '../src/engine/index.js';
import {readBalances,render} from '../src/ui/setup.js';

function review(singlePerson,balances) {
  const engine=createEngine({baseYear:2026,singlePerson,...balances});
  const state=engine.state;
  // Exercise the same save path as the Starting balances step.
  readBalances(state,Object.fromEntries(Object.entries(balances).map(([key,value])=>[key,String(value)])));
  state.setup={started:true,step:6};
  return render({state,engine,result:{salary:[{grossA:0,grossB:0}]}});
}

function assertBalance(html,label,amount,status='entered') {
  assert.ok(html.includes(`<dt>${label}</dt><dd>${amount} · ${status}</dd>`),`${label} should show ${amount} as ${status}`);
}

test('setup review includes saved bank, TFSA and RRSP starting balances for one person',()=>{
  const html=review(true,{
    startCashA:6000,startTFSAA:3500,startRRSPA:8000,
    startCashB:10000,startTFSAB:20000,startRRSPB:30000
  });
  assertBalance(html,'Bank balances','$6,000');
  assertBalance(html,'TFSA balances','$3,500');
  assertBalance(html,'RRSP balances','$8,000');
});

test('setup review totals each starting account across both household members',()=>{
  const html=review(false,{
    startCashA:6000,startTFSAA:3500,startRRSPA:8000,
    startCashB:1000,startTFSAB:2500,startRRSPB:4000
  });
  assertBalance(html,'Bank balances','$7,000');
  assertBalance(html,'TFSA balances','$6,000');
  assertBalance(html,'RRSP balances','$12,000');
});

test('setup review shows zero for empty accounts and excludes inactive second-person balances',()=>{
  const html=review(true,{
    startCashA:0,startTFSAA:0,startRRSPA:0,
    startCashB:1000,startTFSAB:2500,startRRSPB:4000
  });
  for(const label of ['Bank balances','TFSA balances','RRSP balances'])assertBalance(html,label,'$0','zero');
});
