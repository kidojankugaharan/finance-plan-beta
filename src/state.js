import { createEngine } from './engine/index.js';
import { validatePlan } from './validation.js';

export const STORAGE_KEY = 'finance-plan-beta.v1';
export const clone = value => structuredClone(value);
export function freshPlan() {
  const state = createEngine({ singlePerson: true }).state;
  state.setup = { started: false, completed: false, step: 0, seen: {} };
  return state;
}
export function parseBackup(text) {
  if (text.length > 5_000_000) throw new Error('This backup is too large (maximum 5 MB).');
  const data = JSON.parse(text, (key, value) => {
    if (['__proto__', 'prototype', 'constructor'].includes(key)) throw new Error('Unsafe backup field.');
    return value;
  });
  if (data?.format !== 'finance-plan-beta' || data.version !== 1) throw new Error('Choose a Finance Plan Beta v1 JSON backup.');
  validatePlan(data.state);
  return clone(data.state);
}
export function backupJSON(state) {
  return JSON.stringify({ format: 'finance-plan-beta', version: 1, exportedAt: new Date().toISOString(), state }, null, 2);
}
export function createStore(storage) {
  let envelope = { state: freshPlan(), history: [], updatedAt: null, backupAt: null };
  let saveError = '', loadError = '';
  let lastStored = null;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    lastStored = raw;
    if (raw) {
      const saved = JSON.parse(raw);
      validatePlan(saved.state);
      if (!Array.isArray(saved.history)) throw new Error('Invalid change history.');
      saved.history.forEach(h => validatePlan(h.state));
      envelope = saved;
    }
  } catch { loadError = 'Saved data could not be opened. It has not been overwritten. Import a valid backup to recover, or download the stored data for troubleshooting.'; }
  const write = () => {
    if (loadError) throw new Error('Recover your saved data before making changes.');
    try {
      if(storage.getItem(STORAGE_KEY)!==lastStored){saveError='Another tab changed this plan. Export your work, then reload before editing.';return;}
      const raw=JSON.stringify(envelope); storage.setItem(STORAGE_KEY, raw); lastStored=raw; saveError = '';
    }
    catch { saveError = 'Changes are not saved: browser storage is full or blocked. Export a backup before closing.'; }
  };
  return {
    get state() { return envelope.state; },
    get history() { return envelope.history; },
    get updatedAt() { return envelope.updatedAt; },
    get backupAt() { return envelope.backupAt; },
    get error() { return saveError || loadError; },
    get loadError() { return loadError; },
    commit(label, edit) {
      if (loadError) throw new Error('Recover your saved data first.');
      // Refuse stale-tab writes; a failure to access storage is reported by write().
      let current=lastStored;try{current=storage.getItem(STORAGE_KEY);}catch{}
      if(current!==lastStored)throw new Error('Another tab changed this plan. Export your unsaved work, then reload before editing.');
      const candidate = clone(envelope.state);
      edit(candidate);
      validatePlan(candidate);
      const next = createEngine(candidate).state;
      envelope.history.unshift({ id: crypto.randomUUID(), label, at: new Date().toISOString(), state: envelope.state });
      envelope.history = envelope.history.slice(0, 5);
      envelope.state = next;
      envelope.updatedAt = new Date().toISOString();
      write();
    },
    restore(state) {
      validatePlan(state);
      if (loadError) {
        // Persist the original bytes before replacing an unreadable save.
        storage.setItem(STORAGE_KEY + '.recovery', storage.getItem(STORAGE_KEY) || '');
        loadError = '';
      }
      this.commit('Imported backup', candidate => { Object.keys(candidate).forEach(k => delete candidate[k]); Object.assign(candidate, clone(state)); });
    },
    revert(id) {
      const entry = envelope.history.find(h => h.id === id);
      if (!entry) throw new Error('This change is no longer available.');
      this.commit('Reverted: ' + entry.label, candidate => { Object.keys(candidate).forEach(k => delete candidate[k]); Object.assign(candidate, clone(entry.state)); });
    },
    markBackup() { envelope.backupAt = new Date().toISOString(); write(); },
    raw() { return storage.getItem(STORAGE_KEY) || ''; },
  };
}
