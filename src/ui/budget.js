import {field,select,card,metric,button,listen,submit,openEditor,escape,money,people,name,yearOptions} from './shared.js';
import {numberValue,validateExpense} from '../validation.js';
import {mortgageNotice} from './budget-check.js';
const debtNotice='<p class="hint debt-notice"><strong>Debt payments are expenses only.</strong> This plan does not track debt balances, interest, principal repayments, or payoff dates. Debts are not subtracted from net worth. Update the payment amount or end month yourself when payments change or stop.</p>';
const frequencies=[['monthly','Monthly'],['weekly','Weekly'],['biweekly','Every two weeks'],['semimonthly','Twice a month'],['quarterly','Quarterly'],['annual','Annual'],['once','One time'],['daily','Daily'],['bimonthly','Every two months'],['semiannual','Twice a year'],['custom','Custom'],['none','Inactive']];
function items(c) {return c.engine.budgetItemsForYear(c.year);}
function editable(s,year) {
  if(s.budgetMode!=='year')return s.budgetItems;
  if(!s.budgetByYear[year]){
    const prior=Object.keys(s.budgetByYear).map(Number).filter(y=>y<=year).sort((a,b)=>b-a)[0];
    s.budgetByYear[year]=structuredClone(prior?s.budgetByYear[prior]:s.budgetItems);
    for(const item of s.budgetByYear[year])for(const key of ['startDate','endDate'])if(item[key]?.startsWith(String(prior)))item[key]=String(year)+item[key].slice(4);
  }
  return s.budgetByYear[year];
}
function edit(c,index=-1,preset='') {
  const item=index>=0?items(c)[index]:{expense:preset,category:preset||'Living',owner:c.state.singlePerson?'A':'Both',cost:'',recurrenceType:'monthly',startDate:'',endDate:'',repeatEvery:1,repeatUnit:'months'};
  openEditor(index<0?'Add expense':'Edit expense',`${debtNotice}<div class="fields">${field('expense','Expense name',item.expense,{type:'text',required:true})}${field('category','Category',item.category,{type:'text',required:true})}${field('cost','Amount per occurrence (CAD)',item.cost,{required:true})}${select('owner','Who pays?', [...people(c.state).map(p=>[p,name(c.state,p)]),['Both','Shared'],['n/a','Excluded']],item.owner)}${select('recurrenceType','Frequency',frequencies,item.recurrenceType)}${field('startDate','Start month (optional)',item.startDate,{type:'month'})}${field('endDate','End month (optional)',item.endDate,{type:'month'})}${field('repeatEvery','Custom: repeat every',item.repeatEvery,{min:1,max:120,step:1})}${select('repeatUnit','Custom: unit',[['days','Days'],['weeks','Weeks'],['months','Months'],['years','Years']],item.repeatUnit)}</div><p class="hint">Recurring expenses are averaged monthly, with inflation in Auto mode. One-time expenses fall in their start month. Entered amounts round to whole dollars.</p>`,d=>{
    const next={...d,cost:numberValue(d.cost,{whole:true}),repeatEvery:numberValue(d.repeatEvery,{min:1,max:120,whole:true})};validateExpense(next);
    c.update(index<0?'Added expense':'Edited expense',s=>{const list=editable(s,c.year);if(index<0)list.push(next);else list[index]=next;});
  });
}
export function render(c) {
  const total=c.engine.budgetTotalAnnual(c.year),list=items(c);
  const byCategory={};for(const item of list)byCategory[item.category]=(byCategory[item.category]||0)+c.engine.budgetAnnual(item,c.year);
  return `<div class="page-heading"><span class="eyebrow">MAKE ROOM FOR WHAT MATTERS</span><h1>Budget</h1><p>Give your everyday spending a place in the plan.</p></div>${mortgageNotice(c.engine,c.year)}<div class="metrics">${metric('Yearly expenses',money(total))}${metric('Monthly average',money(total/12))}${metric('Budget style',c.state.budgetMode==='year'?'By year':'Auto',c.state.budgetMode==='year'?'Lists carry forward until changed':`${c.state.inflationRate}% annual inflation`)}</div>${card('Your expenses',`${debtNotice}<div class="toolbar">${button('add-expense','Add expense','primary')}${select('budget-year','Budget year',yearOptions(c.state),c.year)}${button('budget-settings','Budget settings')}</div>${list.length?`<ul class="item-list">${list.map((item,i)=>`<li><div><strong>${escape(item.expense)}</strong><small>${escape(item.category)} · ${escape(frequencies.find(x=>x[0]===item.recurrenceType)?.[1]||item.recurrenceType)} · ${escape(item.owner==='Both'?'Shared':name(c.state,item.owner))}</small></div><div class="item-amount">${money(item.cost)}<small>${money(c.engine.budgetAnnual(item,c.year))} / year</small></div><button id="edit-expense-${i}" aria-label="Edit ${escape(item.expense)}" class="secondary">Edit</button><button id="remove-expense-${i}" aria-label="Remove ${escape(item.expense)}" class="text-button">Remove</button></li>`).join('')}</ul>`:'<div class="empty"><h3>Start with one expense.</h3><p>Housing, groceries, or transport is a good place to begin. Zero spending makes projections look too optimistic.</p></div>'}<div class="toolbar starter">${['Groceries','Transport','Debt','Kids'].map((v,i)=>button('starter-'+i,'+ '+v,'chip')).join('')}</div>`)}${card('Where it goes',Object.keys(byCategory).length?Object.entries(byCategory).map(([cat,value])=>`<div class="category"><span>${escape(cat)}</span><strong>${money(value)}</strong><progress max="${Math.max(1,total)}" value="${value}">${money(value)}</progress></div>`).join(''):'<p>Add expenses to see your category breakdown.</p>')}`;
}
export function bind(c) {
  listen('add-expense','click',()=>edit(c));
  ['Groceries','Transport','Debt','Kids'].forEach((v,i)=>listen('starter-'+i,'click',()=>edit(c,-1,v)));
  listen('budget-year','change',e=>c.setYear(Number(e.target.value)));
  items(c).forEach((item,i)=>{
    listen('edit-expense-'+i,'click',()=>edit(c,i));
    listen('remove-expense-'+i,'click',()=>c.update('Removed '+item.expense,s=>editable(s,c.year).splice(i,1)));
  });
  listen('budget-settings','click',()=>openEditor('Budget settings',select('budgetMode','Budget style',[['auto','Auto — prices rise with inflation'],['year','By year — enter each year’s prices']],c.state.budgetMode)+`<p>By-year lists carry forward until you create another list. Switching styles keeps both sets of expenses so you can switch back.</p>`,d=>c.update('Changed budget style',s=>{s.budgetMode=d.budgetMode;if(d.budgetMode==='year'&&!Object.keys(s.budgetByYear).length)s.budgetByYear[s.baseYear]=structuredClone(s.budgetItems);}))); 
}
