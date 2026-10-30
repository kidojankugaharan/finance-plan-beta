import {field,select,card,metric,button,listen,submit,openEditor,escape,money,people,name,yearOptions,info} from './shared.js';
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
let budgetView='detail',categoryFilter='',sortOrder='biggest';
export function render(c) {
  const total=c.engine.budgetTotalAnnual(c.year),list=items(c),byCategory={};
  for(const item of list)byCategory[item.category]=(byCategory[item.category]||0)+c.engine.budgetAnnual(item,c.year);
  const filtered=list.map((item,i)=>({item,i})).filter(({item})=>!categoryFilter||item.category===categoryFilter).sort((a,b)=>sortOrder==='name'?a.item.expense.localeCompare(b.item.expense):c.engine.budgetAnnual(b.item,c.year)-c.engine.budgetAnnual(a.item,c.year));
  return `<div class="page-heading"><h1>Budget</h1></div><div class="subtabs"><button id="budget-detail" aria-pressed="${budgetView==='detail'}">Detailed budget</button><button id="budget-split" aria-pressed="${budgetView==='split'}">Split by category</button></div>${mortgageNotice(c.engine,c.year)}<section class="card budget-summary"><div class="panel-heading"><h2>Budget ${c.year} · <span class="badge">${c.state.budgetMode==='year'?'BY YEAR':'AUTO'}</span></h2>${info('Budget',debtNotice+'<p>Recurring expenses are monthly averages. Auto mode applies your inflation assumption.</p>')}<button id="add-expense" aria-label="Add expense" class="secondary">+</button></div><div class="metrics">${metric('Per month',money(total/12))}${metric('Per year',money(total))}</div><div class="toolbar budget-filters">${select('budget-year','Budget year',yearOptions(c.state),c.year)}${select('category-filter','Category',[['','All'],...Object.keys(byCategory).map(k=>[k,k])],categoryFilter)}${select('budget-sort','Sort by',[['biggest','Biggest first'],['name','Name']],sortOrder)}<button id="clear-filter" class="secondary" aria-label="Clear filters">×</button></div><button id="budget-settings" class="text-button">Budget settings</button></section><section class="card" ${budgetView==='detail'?'':'hidden'}><ul class="item-list">${filtered.map(({item,i})=>`<li><div><strong>${escape(item.expense)}</strong><small>${escape(item.category)} · ${escape(frequencies.find(x=>x[0]===item.recurrenceType)?.[1]||item.recurrenceType)} · ${escape(item.owner==='Both'?'Shared':name(c.state,item.owner))}</small></div><div class="item-amount">${money(item.cost)}<small>${money(c.engine.budgetAnnual(item,c.year))} / year</small></div><button id="edit-expense-${i}" aria-label="Edit ${escape(item.expense)}" class="text-button">›</button><button id="remove-expense-${i}" aria-label="Remove ${escape(item.expense)}" class="text-button">×</button></li>`).join('')}</ul>${!filtered.length?'<p class="hint">No expenses. Add an expense to begin.</p>':''}<div class="toolbar starter">${['Groceries','Transport','Debt','Kids'].map((v,i)=>button('starter-'+i,'+ '+v,'chip')).join('')}</div></section><section class="card" ${budgetView==='split'?'':'hidden'}><h2>Where it goes</h2>${Object.entries(byCategory).map(([cat,value])=>`<div class="category"><span>${escape(cat)}</span><strong>${money(value)}</strong><progress max="${Math.max(1,total)}" value="${value}">${money(value)}</progress></div>`).join('')||'<p>Add expenses to see your category breakdown.</p>'}</section>`;
}

export function bind(c) {
  listen('budget-detail','click',()=>{budgetView='detail';c.refresh();});
  listen('budget-split','click',()=>{budgetView='split';c.refresh();});
  listen('category-filter','change',e=>{categoryFilter=e.target.value;c.refresh();});
  listen('budget-sort','change',e=>{sortOrder=e.target.value;c.refresh();});
  listen('clear-filter','click',()=>{categoryFilter='';sortOrder='biggest';c.refresh();});
  listen('add-expense','click',()=>edit(c));
  ['Groceries','Transport','Debt','Kids'].forEach((v,i)=>listen('starter-'+i,'click',()=>edit(c,-1,v)));
  listen('budget-year','change',e=>c.setYear(Number(e.target.value)));
  items(c).forEach((item,i)=>{
    listen('edit-expense-'+i,'click',()=>edit(c,i));
    listen('remove-expense-'+i,'click',()=>c.update('Removed '+item.expense,s=>editable(s,c.year).splice(i,1)));
  });
  listen('budget-settings','click',()=>openEditor('Budget settings',select('budgetMode','Budget style',[['auto','Auto — prices rise with inflation'],['year','By year — enter each year’s prices']],c.state.budgetMode)+`<p>By-year lists carry forward until you create another list. Switching styles keeps both sets of expenses so you can switch back.</p>`,d=>c.update('Changed budget style',s=>{s.budgetMode=d.budgetMode;if(d.budgetMode==='year'&&!Object.keys(s.budgetByYear).length)s.budgetByYear[s.baseYear]=structuredClone(s.budgetItems);}))); 
}
