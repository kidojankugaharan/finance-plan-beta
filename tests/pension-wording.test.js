import {expect,test} from 'vitest';
import {createEngine} from '../src/engine/index.js';
import {pensionFields,render as renderSetup} from '../src/ui/setup.js';
import {render as renderMore} from '../src/ui/more.js';

test('Quebec pension settings and help identify QPP and explain the CPP approximation',()=>{
  const {state}=createEngine({province:'QC',singlePerson:false});
  state.setup={started:true,step:5};
  // More and Salary use pensionFields for their pension editors.
  const surfaces=[
    pensionFields(state),
    renderSetup({state}),
    renderMore({state,store:{history:[]}}),
  ];
  for(const html of surfaces){
    expect(html).toContain('Quebec’s public pension is the Quebec Pension Plan (QPP).');
    expect(html).toContain('approximates QPP retirement benefits using its CPP calculation');
    expect(html).toContain('QPP-specific benefit rules are not fully modelled, including deferral beyond age 70');
    expect(html).not.toContain('CPP-based');
  }
});
