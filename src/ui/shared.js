export const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const money = n => new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD',maximumFractionDigits:0}).format(Number(n)||0);
export const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
export const people = state => state.singlePerson ? ['A'] : ['A','B'];
export const employmentIncomeNotice = '<p class="income-notice"><strong>Employee payroll approximation.</strong> Salary entries use employee income tax and CPP/QPP, EI and QPIP estimates. Freelance and self-employment tax treatment is not modelled. Entering freelance income here may give inaccurate take-home income and projections. Do not include freelance receipts in annual salary: enter only employee pay (0 if none). Use Salary: Add after-tax freelance income, or Year: Add extra income or expense, with an amount you have independently estimated after business expenses, income tax and self-employment contributions. Set the repeat dates explicitly; these entries do not grow with salary or stop at retirement. Avoid counting the same income twice.</p>';
export const name = (s,p) => s['name'+p] || 'Person '+p;
export const options = (entries, value) => entries.map(([v,l])=>`<option value="${escape(v)}" ${String(v)===String(value)?'selected':''}>${escape(l)}</option>`).join('');
export const select = (key,label,entries,value,hint='') => `<label><span id="${key}-label">${escape(label)}</span><select name="${key}" id="${key}" aria-labelledby="${key}-label" ${hint?`aria-describedby="${key}-hint"`:''}>${options(entries,value)}</select>${hint?`<small id="${key}-hint">${escape(hint)}</small>`:''}</label>`;
export function field(key,label,value='',{type='number',min=0,max=1e9,step='any',required=false,hint='',placeholder=''}={}) {
  return `<label><span id="${key}-label">${escape(label)}</span><input id="${key}" name="${key}" aria-labelledby="${key}-label" ${hint?`aria-describedby="${key}-hint"`:''} type="${type}" value="${escape(value)}" ${type==='number'?`min="${min}" max="${max}" step="${step}" inputmode="decimal"`:''} ${required?'required':''} maxlength="120" placeholder="${escape(placeholder)}">${hint?`<small id="${key}-hint">${escape(hint)}</small>`:''}</label>`;
}
export const card = (title,body,cls='') => `<section class="card ${cls}"><h2>${escape(title)}</h2>${body}</section>`;
export const metric = (label,value,note='') => `<div class="metric"><span>${escape(label)}</span><strong>${escape(value)}</strong>${note?`<small>${escape(note)}</small>`:''}</div>`;
export const button = (id,label,cls='secondary') => `<button type="button" id="${id}" class="${cls}">${escape(label)}</button>`;
export function listen(id,event,handler) {
  document.getElementById(id)?.addEventListener(event,async e=>{try{await handler(e);}catch(error){notify(error.message,true);}});
}
export function submit(id,handler) {
  listen(id,'submit',async e=>{e.preventDefault();await handler(Object.fromEntries(new FormData(e.currentTarget)),e);});
}
export function notify(message,error=false) {
  const el=document.getElementById('notice'); el.textContent=message;el.className=error?'error show':'show';el.setAttribute('role',error?'alert':'status');
  clearTimeout(notify.timer);notify.timer=setTimeout(()=>el.classList.remove('show'),error?12000:4500);
}
export function openEditor(title,body,onSave,saveLabel='Save changes') {
  const d=document.getElementById('editor');
  d.innerHTML=`<form id="editor-form"><header><h2 id="dialog-title">${escape(title)}</h2><button type="button" id="close-editor" aria-label="Close dialog">×</button></header><div class="dialog-body">${body}</div><p id="editor-error" role="alert"></p><footer><button type="button" id="cancel-editor" class="secondary">Cancel</button><button type="submit">${escape(saveLabel)}</button></footer></form>`;
  for(const id of ['close-editor','cancel-editor'])listen(id,'click',()=>d.close());
  document.getElementById('editor-form').addEventListener('submit', async e=>{
    e.preventDefault();
    try {await onSave(Object.fromEntries(new FormData(e.currentTarget)));d.close();}
    catch(error){document.getElementById('editor-error').textContent=error.message;}
  });
  d.showModal();
}
export function yearOptions(s) { return s.years.map(y=>[y.year,y.year]); }
export function download(filename,contents,type='application/json') {
  const url=URL.createObjectURL(new Blob([contents],{type}));
  const a=document.createElement('a');a.href=url;a.download=filename;a.hidden=true;
  // Keep the link connected outside #app while the browser starts the download;
  // exporting rerenders #app immediately after this function returns.
  document.body.append(a);
  try { a.click(); }
  finally { setTimeout(()=>{a.remove();URL.revokeObjectURL(url);},1000); }
}
export function chart(rows,key='netWorth') {
  if(!rows.length)return '';
  const values=rows.map(r=>Number(r[key])||0),lo=Math.min(0,...values),hi=Math.max(1,...values),w=760,h=220;
  const y=v=>h-20-(v-lo)/(hi-lo)*(h-40);
  const points=values.map((v,i)=>`${20+i*(w-40)/Math.max(1,values.length-1)},${y(v)}`).join(' ');
  return `<figure class="chart"><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${escape(key)} from ${rows[0].year} to ${rows.at(-1).year}, ending at ${money(values.at(-1))}"><line x1="20" x2="740" y1="${y(0)}" y2="${y(0)}" stroke="#686184" stroke-dasharray="4 4"/><polyline points="${points}" fill="none" stroke="#5de4dc" stroke-width="3" stroke-linejoin="round"/></svg><figcaption><span>${rows[0].year}</span><span>${money(lo)} to ${money(hi)}</span><span>${rows.at(-1).year}</span></figcaption></figure>`;
}
