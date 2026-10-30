import {field,select,card,button,listen,openEditor,escape,money,months,yearOptions} from './shared.js';
import {numberValue} from '../validation.js';
function edit(c,index=-1) {
  const g=index<0?{description:'',goalKey:'customSavings',targetAmount:'',targetYear:Math.min(2086,c.state.baseYear+5),targetMonth:11,achievementMode:'dedicated',existingMetric:'bank',active:true}:c.state.goals[index],p=g.fundingPlan||{};
  const catalog=c.engine.goalCatalog();
  openEditor(index<0?'Add goal':'Edit goal',`<div class="fields">${field('description','Goal name or description',g.description,{type:'text',required:true})}${select('goalKey','What are you aiming for?',Object.keys(catalog).map(k=>[k,c.engine.goalLabel(k)]),g.goalKey)}${field('targetAmount','Target amount (CAD, %, months, or years)',g.targetAmount,{required:true,hint:'Use the unit shown by your selected goal: savings rate is %, coverage is months/years, other goals are CAD.'})}${select('targetYear','Target year',yearOptions(c.state),g.targetYear)}${select('targetMonth','Target month',months.map((m,i)=>[i,m]),g.targetMonth)}${select('achievementMode','How to measure progress',[['automatic','Projection metric for this goal'],['existing','An account balance'],['dedicated','A separate planned savings schedule']],g.achievementMode,'Projection metrics and account balances do not earmark money for this goal.')}${select('existingMetric','Account balance to track',Object.entries(c.engine.goalExistingBalanceCatalog()).map(([k,v])=>[k,v.label]),g.existingMetric)}${select('active','Goal status',[['true','Active'],['false','Paused']],String(g.active!==false))}</div><details id="goal-savings-schedule"><summary>Separate planned savings schedule</summary><p>Used only when measuring a separate savings schedule. Enter money already saved and planned contributions, or explicitly choose to divide the remaining target. Affordability is not checked; these amounts do not move money in your projection.</p><div class="fields">${field('startingAmount','Already saved',p.startingAmount||0)}${select('amountMode','Contribution amount',[['auto','Divide remaining target across the schedule'],['fixed','Use a fixed amount']],p.amountMode||'fixed')}${field('amount','Fixed amount per payment',p.amount||0)}${select('frequency','Frequency',[['monthly','Monthly'],['every2months','Every two months'],['quarterly','Quarterly'],['semiannual','Twice a year'],['annual','Annual'],['yearend','December']],p.frequency||'monthly')}${select('startYear','Start year',yearOptions(c.state),p.startYear||c.state.baseYear)}${select('startMonth','Start month',months.map((m,i)=>[i,m]),p.startMonth||0)}</div></details>`,d=>{
    const next={...g,description:d.description,goalKey:d.goalKey,goalType:catalog[d.goalKey].category,targetAmount:numberValue(d.targetAmount),targetYear:Number(d.targetYear),targetMonth:Number(d.targetMonth),achievementMode:d.achievementMode,existingMetric:d.existingMetric,active:d.active==='true'};
    if(next.achievementMode==='dedicated'){
      if(Number(d.startYear)*12+Number(d.startMonth)>next.targetYear*12+next.targetMonth)throw new Error('Start month must be before the target month.');
      next.fundingPlan={enabled:true,startingAmount:numberValue(d.startingAmount),amountMode:d.amountMode,amount:numberValue(d.amount),frequency:d.frequency,startYear:Number(d.startYear),startMonth:Number(d.startMonth),endYear:next.targetYear,endMonth:next.targetMonth,owner:'household'};
    }
    c.update(index<0?'Added goal':'Edited goal',s=>{if(index<0)s.goals.push(next);else s.goals[index]=next;});
  });
  const syncSchedule=()=>{
    document.getElementById('goal-savings-schedule').open=document.getElementById('achievementMode').value==='dedicated';
  };
  listen('achievementMode','change',syncSchedule);
  listen('goalKey','change',e=>{
    document.getElementById('achievementMode').value=catalog[e.target.value].defaultMode;
    syncSchedule();
  });
  syncSchedule();
}
function needsFundingAssessment(r) {
  // Saved custom goals may have inherited net worth before savings became the default.
  // A free-text name and a household balance cannot establish dedicated funding.
  return r.metric!=='dedicatedSavings'&&['saving','other'].includes(r.goal.goalType);
}
function progressStatus(r) {
  if(needsFundingAssessment(r))return r.goal.active===false?'Paused':'Funding not assessed';
  const scope=r.metric==='dedicatedSavings'?'Savings plan':'Metric';
  return scope+': '+(r.status==='Achieved'?'target met':r.status);
}
export function render(c) {
  return `<div class="page-heading"><span class="eyebrow">PUT A DATE ON YOUR PLANS</span><h1>Goals</h1><p>Planned savings — affordability not checked.</p></div><div class="toolbar">${button('add-goal','Add goal','primary')}</div>${c.result.goals.length?`<div class="goal-grid">${c.result.goals.map((r,i)=>card(r.goal.description||c.engine.goalLabel(r.goal.goalKey),`<span class="tag">${escape(progressStatus(r))}</span><p>${escape(r.metricLabel)}</p><p>${r.metric==='dedicatedSavings'?'Planned savings only. Contributions are assumed; money is not moved or confirmed saved.':'This metric does not show money earmarked or available for this goal.'+(needsFundingAssessment(r)?' To compare a separate savings plan with this target, edit this goal and choose &quot;A separate planned savings schedule&quot; under &quot;How to measure progress&quot;.':'')}</p><strong class="goal-target">${r.unit==='money'?money(r.target):escape(r.target+' '+r.unit)}</strong><p>By ${months[r.targetMonth]} ${r.targetYear}</p>${needsFundingAssessment(r)?'':`<progress max="100" value="${Math.max(0,Math.min(100,r.coverage))}">${Math.round(r.coverage)}%</progress>`}<p>${r.metric==='dedicatedSavings'?'Planned savings at target date':'Projected metric at target date'}: ${r.unit==='money'?money(r.projectedValue):r.projectedValue.toFixed(1)+' '+escape(r.unit)}</p>${r.goal.achievementMode==='dedicated'?`<p>${money(r.funding.amount)} · ${escape(r.funding.label)} · ${r.funding.count} payments</p>`:''}<div class="toolbar">${button('goal-'+i,'Edit goal')}${button('remove-goal-'+i,'Remove','text-button')}</div>`)).join('')}</div>`:card('What are you working toward?','<p>An emergency fund, a home, or a retirement milestone. Add a goal to compare it with your projection.</p>')}`;
}
export function bind(c) {
  listen('add-goal','click',()=>edit(c));
  c.state.goals.forEach((g,i)=>{listen('goal-'+i,'click',()=>edit(c,i));listen('remove-goal-'+i,'click',()=>c.update('Removed goal',s=>s.goals.splice(i,1)));});
}
