import {test, expect, chromium, devices} from '@playwright/test';
import fs from 'node:fs/promises';
import {openTesterPage, checkpointTesterPage} from '../../scripts/tester-profile.mjs';
import {freshPlan, STORAGE_KEY} from '../../src/state.js';
import {createEngine} from '../../src/engine/index.js';
import {closeMonth} from '../../src/closeout.js';

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
      await expect(page.getByRole('heading', {name: 'Your year, in focus.'})).toBeVisible();
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
