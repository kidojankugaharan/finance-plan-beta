import fs from 'node:fs/promises';
import path from 'node:path';
import {STORAGE_KEY} from '../src/state.js';
import {validatePlan} from '../src/validation.js';

const checkpointPath = profile => path.join(profile, 'finance-plan-checkpoint.json');
function validateSave(raw) {
  const envelope = JSON.parse(raw);
  validatePlan(envelope.state);
  if (!Array.isArray(envelope.history)) throw new Error('Invalid change history.');
  envelope.history.forEach(item => validatePlan(item.state));
  return envelope;
}

// Keep the app's saved envelope alongside the persistent browser profile. This
// gives batch sessions a recovery path if Chromium loses its localStorage or
// the preview origin changes. Never overwrite an existing browser save.
export async function openTesterPage(context, url, profile) {
  let raw;
  try {
    raw = await fs.readFile(checkpointPath(profile), 'utf8');
    validateSave(raw);
  } catch (error) {
    if (error.code !== 'ENOENT') throw new Error('Tester profile checkpoint could not be opened; preserved for recovery.', {cause: error});
  }
  const page = context.pages()[0] || await context.newPage();
  if (raw) await page.addInitScript(({origin, key, raw}) => {
    if (location.origin === origin && localStorage.getItem(key) === null) localStorage.setItem(key, raw);
  }, {origin: new URL(url).origin, key: STORAGE_KEY, raw});
  await page.goto(url);
  return page;
}

export async function checkpointTesterPage(page, profile) {
  const raw = await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY);
  // An empty or unreadable browser save must not erase a previous checkpoint.
  if (!raw) return;
  const envelope = validateSave(raw);
  if (!envelope.state.setup?.started && !envelope.state.setup?.completed) return;
  await fs.writeFile(checkpointPath(profile), raw);
}
