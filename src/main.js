import {createEngine} from './engine/index.js';
import {createStore,backupJSON,parseBackup} from './state.js';
import * as setup from './ui/setup.js';
import * as year from './ui/year.js';
import * as salary from './ui/salary.js';
import * as budget from './ui/budget.js';
import * as invest from './ui/invest.js';
import * as goals from './ui/goals.js';
import * as analysis from './ui/analysis.js';
import * as more from './ui/more.js';
import * as lessons from './ui/lessons.js';
import {escape,notify,listen,openEditor,download,navIcon,info} from './ui/shared.js';

import {mortgageNotice} from './ui/budget-check.js';

// Storage access itself can throw in private/restricted browser contexts.
const storage={getItem:key=>window.localStorage.getItem(key),setItem:(key,value)=>window.localStorage.setItem(key,value)};
const store=createStore(storage);
const tabs={year,salary,budget,invest,goals,analysis,more,lessons};
const labels={year:'Year',salary:'Salary',budget:'Budget',invest:'Invest',goals:'Goals',analysis:'Projection',more:'More',lessons:'Lessons learned'};
let active=tabs[location.hash.slice(1)]?location.hash.slice(1):'year';
let selectedYear=store.state.baseYear;
let offlineReady=false;
let engine,result;
function calculate() {
  engine=createEngine(store.state);
  result={annual:engine.computeAnnualAggregates(),monthly:engine.computeMonthlySeries(),salary:engine.computeSalaryChain(),windows:engine.resolveDrawdown().windows,goals:engine.computeGoalResults()};
}
function exportBackup() {
  download('finance-plan-'+new Date().toISOString().slice(0,10)+'.json',backupJSON(store.state));
  if(!store.loadError)store.markBackup();render();notify('Backup downloaded. Keep the file somewhere safe.');
}
function importBackup() {
  const input=document.createElement('input');input.type='file';input.accept='.json,application/json';input.hidden=true;
  // Keep the picker connected and alive until the native chooser finishes.
  // It lives outside #app so a render cannot detach it while choosing a file.
  const cleanup=()=>input.remove();
  input.addEventListener('cancel',cleanup,{once:true});
  input.addEventListener('change',async()=>{
    const file=input.files?.[0];cleanup();
    if(!file)return;
    try {
      if(file.size>5_000_000)throw new Error('Choose a backup under 5 MB.');
      const next=parseBackup(await file.text());
      openEditor('Review backup import',`<p>Replace your current plan with <strong>${escape(next.nameA||'Unnamed household')}${next.nameB?' & '+escape(next.nameB):''}</strong>?</p><p>Starting year: ${next.baseYear}. ${next.budgetItems.length} regular expenses and ${next.goals.length} goals.</p>${mortgageNotice(createEngine(next),next.baseYear)}<p>The current plan is kept in Recent changes so you can revert this import. Download a backup first for a permanent copy.</p>`,()=>{store.restore(next);selectedYear=next.baseYear;refresh();notify('Backup imported. You can revert it in More.');},'Import this plan');
    } catch(error){notify('Import failed: '+error.message,true);}
  },{once:true});
  document.body.append(input);
  // Request the native picker directly during the user's activation. Retain
  // click() for browsers that do not implement the explicit picker API.
  try{if(typeof input.showPicker==='function')input.showPicker();else input.click();}
  catch(error){cleanup();throw error;}
}
function navigate(tab) {if(!tabs[tab])return;active=tab;history.replaceState(null,'','#'+tab);render();window.scrollTo(0,0);document.querySelector('h1')?.focus();}
function update(label,edit) {store.commit(label,edit);refresh();notify(store.error||'Saved · '+label,!!store.error);}
function refresh() {calculate();selectedYear=Math.max(store.state.baseYear,Math.min(2086,selectedYear));render();}
function render() {
  const s=store.state,inSetup=!s.setup.completed&&!s.setup.paused;
  const ctx={today:()=>new Date(),state:s,store,engine,result,year:selectedYear,navigate,update,refresh,exportBackup,importBackup,setYear:y=>{selectedYear=y;render();}};
  document.documentElement.dataset.theme=s.ui.theme||'synthwave';
  const view=inSetup?setup:tabs[active];
  document.getElementById('app').innerHTML=`<div class="local-status" aria-label="Storage status"><span>${store.error?'Not saved':'Local only'}</span><span id="offline-state">${offlineReady?'Ready offline':'Offline cache pending'}</span></div>${store.error?`<aside class="save-error" role="alert">${escape(store.error)} <button id="emergency-export">Download ${store.loadError?'stored data':'backup'}</button></aside>`:''}${!inSetup&&!s.setup.completed?'<aside class="draft-banner">Your setup is a draft. <button id="resume-banner" class="text-button">Resume setup</button></aside>':''}<main id="main" tabindex="-1">${store.loadError?'<h1>Recover your plan</h1><p>Your saved data remains on this device. Import a valid backup to continue.</p><button id="recover-import">Import backup</button>':view.render(ctx)}</main>${!inSetup&&!store.loadError?`<nav class="main-nav" aria-label="Main navigation">${['budget','salary','year','invest','more'].map(id=>[id,labels[id]]).map(([id,label])=>`<button data-tab="${id}" class="${active===id||(id==='more'&&['lessons','goals','analysis'].includes(active))?'active':''}" ${active===id||(id==='more'&&['lessons','goals','analysis'].includes(active))?'aria-current="page"':''}><span class="nav-icon">${navIcon(id)}</span><span>${label}</span></button>`).join('')}</nav><footer class="app-footer">Private by design. Stored on this device. <button id="quick-backup" class="text-button">Export backup</button>${store.history.length?'<button id="undo-last" class="text-button">Undo last change</button>':''}</footer>`:''}`;
  if(!inSetup)document.querySelectorAll('main > .card > p:not(.warning):not(.tracked-balance-notice),main > .more-grid > .card > p:not(.warning),main > .card > form > p.hint').forEach(p=>{
    if(p.textContent.length<100)return;
    const holder=document.createElement('div');holder.className='note-help';holder.innerHTML=info('Details',p.outerHTML);p.replaceWith(holder);
  });
  document.querySelectorAll('[data-tab]').forEach(el=>el.addEventListener('click',()=>navigate(el.dataset.tab)));
  document.querySelector('h1')?.setAttribute('tabindex','-1');
  listen('resume-banner','click',()=>update('Resumed setup',s=>{s.setup.paused=false;}));
  listen('quick-backup','click',exportBackup);listen('recover-import','click',importBackup);
  listen('emergency-export','click',()=>store.loadError?download('finance-plan-recovery.json',store.raw()):exportBackup());
  listen('undo-last','click',()=>{store.revert(store.history[0].id);refresh();notify('Last change reverted.');});
  if(!store.loadError)view.bind(ctx);
}
window.addEventListener('hashchange',()=>{const tab=location.hash.slice(1);if(tabs[tab]){active=tab;render();}});
document.addEventListener('click',e=>document.querySelectorAll('.info[open]').forEach(el=>{if(!el.contains(e.target))el.open=false;}));
document.addEventListener('keydown',e=>{if(e.key==='Escape')document.querySelectorAll('.info[open]').forEach(el=>{el.open=false;el.querySelector('summary').focus();});});
window.addEventListener('storage',e=>{if(e.key==='finance-plan-beta.v1')notify('This plan changed in another tab. Reload before editing to avoid overwriting it.',true);});
try{refresh();}catch(error){document.getElementById('app').innerHTML='<main><h1>The plan could not be calculated</h1><p>Your saved data has not been changed.</p><button id="recover-import">Import backup</button><button id="emergency-export">Download stored data</button></main>';listen('recover-import','click',importBackup);listen('emergency-export','click',()=>download('finance-plan-recovery.json',store.raw()));notify(error.message,true);}
if('serviceWorker' in navigator && !import.meta.env?.DEV){
  navigator.serviceWorker.register('./sw.js').then(()=>navigator.serviceWorker.ready).then(()=>{
    offlineReady=true;const el=document.getElementById('offline-state');if(el)el.textContent='Ready offline';
  }).catch(()=>{const el=document.getElementById('offline-state');if(el)el.textContent='Offline cache unavailable';});
}
