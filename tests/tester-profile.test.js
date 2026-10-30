import {test, expect, vi} from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import {openTesterPage, checkpointTesterPage} from '../scripts/tester-profile.mjs';
import {freshPlan} from '../src/state.js';

async function fixture(raw) {
  await fs.mkdir('.cache', {recursive: true});
  const profile = await fs.mkdtemp(path.resolve('.cache', 'tester-profile-'));
  const page = {evaluate: async () => raw, addInitScript: vi.fn(), goto: vi.fn()};
  const context = {pages: () => [page]};
  return {page, context, profile};
}
const url = 'http://127.0.0.1:4173/finance-plan-beta/';
function saved() {
  const state = freshPlan(); state.setup.started = true;
  return JSON.stringify({state, history: []});
}

test('new profiles open normally without a checkpoint', async () => {
  const {page, context, profile} = await fixture(null);
  await openTesterPage(context, url, profile);
  expect(page.addInitScript).not.toHaveBeenCalled();
  expect(page.goto).toHaveBeenCalledWith(url);
});

test('checkpoint preserves the complete saved envelope and restores before navigation', async () => {
  const raw = saved();
  const {page, context, profile} = await fixture(raw);
  await checkpointTesterPage(page, profile);
  await openTesterPage(context, url, profile);
  expect(page.addInitScript.mock.calls[0][1].raw).toBe(raw);
  expect(page.addInitScript.mock.invocationCallOrder[0]).toBeLessThan(page.goto.mock.invocationCallOrder[0]);
});

test('empty or invalid browser data cannot replace an existing checkpoint', async () => {
  const raw = saved();
  const {page, context, profile} = await fixture(raw);
  await checkpointTesterPage(page, profile);
  page.evaluate = async () => null;
  await checkpointTesterPage(page, profile);
  page.evaluate = async () => 'invalid';
  await expect(checkpointTesterPage(page, profile)).rejects.toThrow();
  await openTesterPage(context, url, profile);
  expect(page.addInitScript.mock.calls[0][1].raw).toBe(raw);
});

test('recovery only fills missing storage at the intended app origin', async () => {
  const {page, context, profile} = await fixture(saved());
  await checkpointTesterPage(page, profile);
  await openTesterPage(context, url, profile);
  const [initialize, args] = page.addInitScript.mock.calls[0];
  const setItem = vi.fn();
  try {
    vi.stubGlobal('location', {origin: args.origin});
    for (const existing of ['newer save', 'unreadable', '']) {
      vi.stubGlobal('localStorage', {getItem: () => existing, setItem});
      initialize(args);
    }
    expect(setItem).not.toHaveBeenCalled();
    vi.stubGlobal('localStorage', {getItem: () => null, setItem});
    vi.stubGlobal('location', {origin: 'https://example.com'});
    initialize(args);
    expect(setItem).not.toHaveBeenCalled();
    vi.stubGlobal('location', {origin: args.origin});
    initialize(args);
    expect(setItem).toHaveBeenCalledWith(args.key, args.raw);
  } finally { vi.unstubAllGlobals(); }
});
