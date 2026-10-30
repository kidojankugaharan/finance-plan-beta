import {test, expect, chromium, devices} from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import {openTesterPage, checkpointTesterPage} from '../../scripts/tester-profile.mjs';
import {freshPlan, STORAGE_KEY} from '../../src/state.js';
import {createEngine} from '../../src/engine/index.js';
import {closeMonth} from '../../src/closeout.js';
import {importTesterBackup, preserveTesterDownloads} from '../../scripts/tester-run.mjs';

test('ordinary UI exports survive tester shutdown and can be imported in a fresh session (#78)', async ({browser}) => {
  // Keep Chromium's download path below the Windows path length limit.
  await fs.mkdir('.cache', {recursive: true});
  const directory = await fs.mkdtemp(path.resolve('.cache', 'export-'));
  const state = createEngine({...freshPlan(), baseYear: 2026, nameA: 'Taylor'}).state;
  state.setup = {started: true, completed: true, seen: {}, step: 6};
  const temp = path.join(directory, 'temp');
  await fs.mkdir(temp, {recursive: true});
  await fs.mkdir(directory + '/downloads', {recursive: true});
  const context = await chromium.launchPersistentContext(path.join(directory, 'profile'), {
    ...devices['iPhone 13'], headless: true, acceptDownloads: true, serviceWorkers: 'block',
    downloadsPath: path.join(directory, 'downloads'),
    env: {...process.env, TEMP: temp, TMP: temp, TMPDIR: temp},
  });
  const page = context.pages()[0];
  const downloads = preserveTesterDownloads(page, directory);
  let files;
  try {
    await page.goto('http://127.0.0.1:4173/finance-plan-beta/');
    await page.evaluate(({key, state}) => localStorage.setItem(key, JSON.stringify({state, history: []})), {key: STORAGE_KEY, state});
    await page.reload();
    await page.locator('[data-tab="more"]').click();
    // Exercise the regular click path: no harness export shortcut or explicit saveAs.
    for (let attempt = 0; attempt < 2; attempt++) {
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.getByRole('button', {name: 'Export JSON backup', exact: true}).click(),
      ]);
      expect(download.suggestedFilename()).toMatch(/^finance-plan-\d{4}-\d{2}-\d{2}\.json$/);
    }
    await downloads.flush();
  } finally { await context.close(); }

  files = await fs.readdir(directory + '/downloads');
  expect(files).toHaveLength(2);
  for (const file of files) {
    expect(JSON.parse(await fs.readFile(directory + '/downloads/' + file, 'utf8')).state).toEqual(state);
  }
  const fresh = await browser.newContext({serviceWorkers: 'block'});
  try {
    const freshPage = await fresh.newPage();
    await freshPage.goto('http://127.0.0.1:4173/finance-plan-beta/');
    await freshPage.getByRole('button', {name: 'Build my plan'}).click();
    await freshPage.getByRole('button', {name: 'Finish later'}).click();
    await freshPage.locator('[data-tab="more"]').click();
    await importTesterBackup(freshPage, directory + '/downloads/' + files[0]);
    await expect(freshPage.getByRole('dialog')).toContainText('Taylor');
    await freshPage.getByRole('button', {name: 'Import this plan', exact: true}).click();
    expect(await freshPage.evaluate(key => JSON.parse(localStorage.getItem(key)).state, STORAGE_KEY)).toEqual(state);
  } finally { await fresh.close(); }
});

for (const nativePicker of [true, false]) test(`harness imports an exported backup (${nativePicker ? 'native chooser' : 'no chooser event'})`, async ({}, info) => {
  const temp = info.outputPath('temp');
  await fs.mkdir(temp, {recursive: true});
  const context = await chromium.launchPersistentContext(info.outputPath('profile'), {
    ...devices['iPhone 13'], headless: true, acceptDownloads: true, serviceWorkers: 'block',
    env: {...process.env, TEMP: temp, TMP: temp, TMPDIR: temp},
  });
  try {
    const page = context.pages()[0];
    page.setDefaultTimeout(10000);
    // Reproduce the harness failure independently of the host's native picker:
    // the Import button creates its input, but no filechooser event is emitted.
    if (!nativePicker) await page.addInitScript(() => {
      HTMLInputElement.prototype.showPicker = function () {};
    });
    await page.goto('http://127.0.0.1:4173/finance-plan-beta/');
    let state = createEngine({...freshPlan(), baseYear: 2026}).state;
    state.nameA = 'Taylor';
    state.setup = {started: true, completed: true, seen: {}, step: 6};
    state.budgetItems = [{expense: 'Housing', category: 'Home', cost: 1500, owner: 'A', recurrenceType: 'monthly', startDate: '', endDate: ''}];
    state.goals = [{description: 'Emergency fund', goalKey: 'customSavings', targetAmount: 3000, targetYear: 2027, targetMonth: 11, achievementMode: 'dedicated', active: true}];
    closeMonth(state, 2026, 0, 'Keep a monthly cushion.', new Date(2026, 1, 2));
    state = createEngine(state).state;
    await page.evaluate(({key, state}) => localStorage.setItem(key, JSON.stringify({state, history: []})), {key: STORAGE_KEY, state});
    await page.reload();
    await page.locator('[data-tab="more"]').click();
    const event = page.waitForEvent('download');
    await page.getByRole('button', {name: 'Export JSON backup', exact: true}).click();
    const download = await event;
    const file = info.outputPath(download.suggestedFilename());
    await download.saveAs(file);
    const backup = JSON.parse(await fs.readFile(file, 'utf8'));
    // Import must replace a different current plan, only after confirmation.
    const current = freshPlan();
    current.nameA = 'Current household';
    current.setup = state.setup;
    await page.evaluate(({key, state}) => localStorage.setItem(key, JSON.stringify({state, history: []})), {key: STORAGE_KEY, state: current});
    await page.reload();
    const saved = await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY);
    const chooserListeners = page.listenerCount('filechooser');
    await importTesterBackup(page, file);
    expect(page.listenerCount('filechooser')).toBe(chooserListeners);
    await expect(page.getByRole('dialog')).toContainText('Taylor');
    await expect(page.getByRole('dialog')).toContainText('1 regular expenses and 1 goals');
    expect(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY)).toBe(saved);
    await page.getByRole('button', {name: 'Import this plan', exact: true}).click();
    const restored = await page.evaluate(key => JSON.parse(localStorage.getItem(key)).state, STORAGE_KEY);
    expect(restored).toEqual(backup.state);
    expect(restored.years[0].months[0].locked).toBe(true);
    expect(restored.lessons[0].note).toBe('Keep a monthly cushion.');
    await expect(page.locator('input[type="file"]')).toHaveCount(0);
  } finally { await context.close(); }
});

test('household checkpoint survives an origin change and repeated full profile restarts', async ({}, info) => {
  const directory = info.outputPath('persistent-profile');
  const temp = info.outputPath('temp');
  await fs.mkdir(temp, {recursive: true});
  const origin = 'http://127.0.0.1:4173';
  const url = origin + '/finance-plan-beta/';
  const legacy = 'http://127.0.0.1:4187';
  const state = createEngine({...freshPlan(), baseYear: 2026}).state;
  Object.assign(state, {nameA: 'Taylor', nameB: 'Morgan', singlePerson: false});
  state.setup = {started: true, completed: true, seen: {}, step: 6};
  closeMonth(state, 2026, 0, 'Keep a monthly cushion.', new Date(2026, 1, 2));
  let raw = JSON.stringify({state, history: [], updatedAt: '2026-02-02T12:00:00Z', backupAt: null});
  async function launch() {
    const context = await chromium.launchPersistentContext(directory, {
      ...devices['iPhone 13'], headless: true, serviceWorkers: 'block',
      env: {...process.env, TEMP: temp, TMP: temp, TMPDIR: temp},
    });
    await context.route(legacy + '/**', async route => {
      const response = await route.fetch({url: route.request().url().replace(legacy, origin)});
      await route.fulfill({response});
    });
    return context;
  }
  let context = await launch();
  try {
    const page = context.pages()[0];
    await page.goto(legacy + '/finance-plan-beta/');
    await page.evaluate(({key, raw}) => localStorage.setItem(key, raw), {key: STORAGE_KEY, raw});
    await checkpointTesterPage(page, directory);
  } finally { await context.close(); }

  for (let restart = 0; restart < 3; restart++) {
    context = await launch();
    try {
      const page = await openTesterPage(context, url, directory);
      await expect(page.getByRole('heading', {name: 'Year'})).toBeVisible();
      await expect(page.locator('main')).toContainText('Taylor & Morgan');
      await expect(page.locator('main')).toContainText('1 closed month is hidden');
      expect(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY)).toBe(raw);
      await page.locator('[data-tab="more"]').click();
      await page.getByRole('button', {name: 'Lessons learned', exact: true}).click();
      await expect(page.locator('main')).toContainText('January 2026');
      await expect(page.locator('main')).toContainText('Keep a monthly cushion.');
      await page.locator('[data-tab="more"]').click();
      // Every restarted session must produce fresh files, including repeated
      // exports after the backup status rerenders the page.
      let backup;
      for (let attempt = 0; attempt < 2; attempt++) {
        const event = page.waitForEvent('download', {timeout: 10000});
        await page.getByRole('button', {name: 'Export JSON backup', exact: true}).click();
        const download = await event;
        expect(download.suggestedFilename()).toMatch(/^finance-plan-\d{4}-\d{2}-\d{2}\.json$/);
        const file = info.outputPath(`backup-${restart}-${attempt}.json`);
        await download.saveAs(file);
        expect(await download.failure()).toBeNull();
        backup = await fs.readFile(file);
        expect(JSON.parse(backup).state).toEqual(JSON.parse(raw).state);
      }
      if (restart === 0) {
        const chooser = page.waitForEvent('filechooser');
        await page.getByRole('button', {name: 'Import JSON backup', exact: true}).click();
        await (await chooser).setFiles({name: 'fictional.json', mimeType: 'application/json', buffer: backup});
        await expect(page.getByRole('dialog')).toContainText('Taylor & Morgan');
        await page.getByRole('button', {name: 'Import this plan', exact: true}).click();
      }
      raw = await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY);
      await checkpointTesterPage(page, directory);
    } finally { await context.close(); }
  }
});
