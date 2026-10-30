import {card,button,listen,openEditor,escape,months} from './shared.js';
import {sortedLessons,NOTE_MAX} from '../closeout.js';
const when = l => new Date(l.at).toLocaleDateString('en-CA',{dateStyle:'medium'});
export function render(c) {
  const list=sortedLessons(c.state);
  return `<div class="page-heading"><span class="eyebrow">LOOK BACK, PLAN AHEAD</span><h1>Lessons learned</h1><p>Notes you saved when closing a month. Newest first.</p></div>${card('Your notes',list.length?`<ul class="item-list lessons">${list.map(l=>`<li><div><strong>${months[l.month]} ${l.year}</strong><small>Saved ${escape(when(l))}</small><p class="lesson-note">${escape(l.note)}</p></div><button id="edit-lesson-${l.i}" class="secondary" aria-label="Edit note for ${months[l.month]} ${l.year}">Edit</button><button id="delete-lesson-${l.i}" class="text-button" aria-label="Delete note for ${months[l.month]} ${l.year}">Delete</button></li>`).join('')}</ul>`:'<div class="empty"><h3>No notes yet.</h3><p>When you close a past month in Year, add a takeaway for future budgeting and it will appear here.</p></div>')}<div class="toolbar">${button('back-more','Back to More')}</div>`;
}
export function bind(c) {
  listen('back-more','click',()=>c.navigate('more'));
  for(const l of sortedLessons(c.state)){
    const label=months[l.month]+' '+l.year;
    listen('edit-lesson-'+l.i,'click',()=>openEditor('Edit note · '+label,`<label><span id="note-label">Notes / lessons learned</span><textarea id="note" name="note" aria-labelledby="note-label" rows="5" maxlength="${NOTE_MAX}" required>${escape(l.note)}</textarea></label>`,d=>{
      const text=String(d.note||'').trim();if(!text)throw new Error('Enter a note, or delete it instead.');
      c.update('Edited lesson',s=>{s.lessons[l.i].note=text;});
    }));
    listen('delete-lesson-'+l.i,'click',()=>openEditor('Delete note',`<p>Delete the note for <strong>${label}</strong>? The month stays closed.</p>`,()=>c.update('Deleted lesson',s=>{s.lessons.splice(l.i,1);}),'Delete note'));
  }
}
