import {describe, it, expect, vi} from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import {Loop, ROOT, options, pool, selectIssues, branchFor, codexArgs} from '../scripts/loop.mjs';

const issue = (number, type = 'bug') => ({number, title: 'A tester finding', body: 'Evidence', created_at: `2026-10-${String(number).padStart(2, '0')}`, labels: [{name: 'tester'}, {name: type}]});
const summary = () => ({round: 1, filed: [], merged: [], needsHuman: [], backlog: []});

async function fixture(run, args = ['fix']) {
  // Keep every test artifact within the workspace; preserve it rather than deleting files.
  await fs.mkdir(path.join(ROOT, '.cache'), {recursive: true});
  const root = await fs.mkdtemp(path.join(ROOT, '.cache', 'loop-test-'));
  await fs.mkdir(path.join(root, 'testers', 'one'), {recursive: true});
  await fs.mkdir(path.join(root, 'node_modules'));
  await fs.writeFile(path.join(root, 'CLAUDE.md'), 'Project instructions');
  await fs.writeFile(path.join(root, 'testers', 'PROMPT.md'), 'Tester instructions');
  await fs.writeFile(path.join(root, 'testers', 'personas.json'), '[{"id":"one"}]');
  await fs.writeFile(path.join(root, 'testers', 'one', 'brief.md'), 'Fictional household');
  const loop = new Loop(options(args), {root, run, output: () => {}, wait: vi.fn(), mergeAttempts: 2});
  await loop.load();
  return loop;
}

function fakeFix({issues = [issue(4)], failTests = 0, pending = false, previous = [], largeIdea = false} = {}) {
  const calls = [];
  let failures = failTests;
  const run = vi.fn(async (name, args, settings) => {
    calls.push({name, args, ...settings});
    if (name === 'gh' && args[0] === 'api') return JSON.stringify([issues]);
    if (name === 'gh' && args[0] === 'pr' && args[1] === 'list') return JSON.stringify(previous);
    if (name === 'git' && args[0] === 'worktree') {await fs.mkdir(args[4], {recursive: true}); return '';}
    if (name === 'codex' && args.includes('--output-last-message')) {
      await fs.writeFile(args[args.indexOf('--output-last-message') + 1], JSON.stringify({size: largeIdea ? 'large' : 'small', reason: 'Classified scope'}));
      return '';
    }
    if (['npm', 'npm.cmd'].includes(name) && args[0] === 'test' && failures-- > 0) throw new Error('Regression failure');
    if (name === 'git' && args[0] === 'status') return ' M src/state.js\n M tests/state.test.js\n';
    if (name === 'gh' && args[0] === 'pr' && args[1] === 'create') return 'https://github.com/example/repo/pull/10\n';
    if (name === 'gh' && args[0] === 'pr' && args[1] === 'view') return JSON.stringify({state: pending ? 'OPEN' : 'MERGED', mergedAt: pending ? null : '2026-10-30', url: 'https://github.com/example/repo/pull/10'});
    return '';
  });
  return {run, calls};
}

describe('auto-development loop', () => {
  it('validates options and preserves the required models/sandbox', () => {
    expect(options(['all'])).toEqual({mode: 'all', dryRun: false, only: null, maxFixes: 5, maxRounds: 3});
    expect(options(['round', '--only', 'on-student', '--max-fixes', '2', '--max-rounds', '1', '--dry-run']).maxFixes).toBe(2);
    for (const args of [[], ['oops'], ['fix', '--max-fixes', '0'], ['all', '--max-rounds', '1.2'], ['round', '--only', '../outside'], ['all', '--unknown']]) expect(() => options(args)).toThrow();
    const args = codexArgs(ROOT, 'gpt-6-luna', 'low');
    expect(args).toContain('workspace-write');
    expect(args).toContain('model_reasoning_effort="low"');
    expect(args).toContain('sandbox_workspace_write.writable_roots=[]');
    expect(args).toContain('approval_policy="never"');
  });
  it('dry-run prints all phases and conditionals without launching ANY process or writing logs', async () => {
    const run = vi.fn(() => {throw new Error('Dry-run launched a command');});
    const lines = [];
    const loop = new Loop(options(['all', '--dry-run', '--only', 'on-student']), {run, output: line => lines.push(line)});
    const write = vi.spyOn(loop, 'write');
    const record = vi.spyOn(loop, 'record');
    await loop.execute();
    expect(run).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
    const plan = lines.join('\n');
    for (const fragment of ['gpt-6-luna', 'gpt-6.1-sol', '--file', 'test:e2e', 'needs-human', 'idea-backlog', '--auto', '--body-file', 'ROUNDS.md', 'on-student --skip-build']) expect(plan).toContain(fragment);
    expect(plan).not.toContain('qc-self-employed-family --skip-build');
  });
  it('rejects unknown personas before any commands', async () => {
    const run = vi.fn();
    await expect(new Loop(options(['round', '--only', 'missing']), {run}).execute()).rejects.toThrow('Unknown persona');
    expect(run).not.toHaveBeenCalled();
  });
  it('caps parallel workers at three and continues past one failed tester', async () => {
    let active = 0, peak = 0, completed = 0;
    await pool([0, 1, 2, 3, 4, 5], 3, async id => {
      active++; peak = Math.max(peak, active);
      await new Promise(r => setTimeout(r, 2));
      active--; completed++;
      if (id === 0) throw new Error('tester failed');
    });
    expect(peak).toBe(3);
    expect(active).toBe(0);
    expect(completed).toBe(6);
    await expect(pool([0, 1], 2, async () => {throw new Error('all failed');})).rejects.toThrow('all failed');
  });
  it('selects oldest eligible issues, skipping PRs and triaged items', () => {
    const human = issue(1); human.labels.push({name: 'needs-human'});
    const backlog = issue(2); backlog.labels.push({name: 'idea-backlog'});
    expect(selectIssues([issue(8), human, backlog, {...issue(3), pull_request: {}}, issue(5), issue(4)], 2).map(i => i.number)).toEqual([4, 5]);
    expect(branchFor({...issue(4), title: 'Bad ; $(command) / title'})).toBe('fix/4-bad-command-title');
  });
  it('runs validation, uses noreply commits and waits for actual merge before syncing main', async () => {
    const fake = fakeFix();
    const loop = await fixture(fake.run);
    const result = summary();
    await loop.fix(result);
    expect(result.merged).toHaveLength(1);
    expect(result.needsHuman).toEqual([]);
    const calls = fake.calls;
    const commit = calls.find(c => c.name === 'git' && c.args.includes('commit'));
    expect(commit.args).toContain('user.email=kidojankugaharan@users.noreply.github.com');
    const npmCalls = calls.filter(c => ['npm', 'npm.cmd'].includes(c.name));
    expect(npmCalls.map(c => c.args)).toEqual([['test'], ['run', 'test:e2e'], ['run', 'build']]);
    expect(npmCalls.every(c => c.cwd.includes('worktrees'))).toBe(true);
    const pr = calls.find(c => c.name === 'gh' && c.args[1] === 'create');
    expect(await fs.readFile(pr.args[pr.args.indexOf('--body-file') + 1], 'utf8')).toContain('Fixes #4');
    expect(calls.at(-1).args).toEqual(['merge', '--ff-only', 'origin/main']);
  });
  it('retries a red fix exactly once, labels/comments failure and continues to the next issue', async () => {
    const fake = fakeFix({issues: [issue(4), issue(5)], failTests: 2});
    const loop = await fixture(fake.run);
    const result = summary();
    await loop.fix(result);
    expect(result.needsHuman).toEqual([4]);
    expect(result.merged).toHaveLength(1);
    const fixes = fake.calls.filter(c => c.name === 'codex');
    expect(fixes).toHaveLength(3);
    expect(fixes[1].input).toContain('Regression failure');
    expect(fake.calls.filter(c => c.name === 'gh' && c.args[0] === 'pr' && c.args[1] === 'create')).toHaveLength(1);
    const comment = fake.calls.find(c => c.name === 'gh' && c.args[1] === 'comment');
    expect(await fs.readFile(comment.args.at(-1), 'utf8')).toContain('Regression failure');
  });
  it('does not call a queued auto-merge a merged PR', async () => {
    const fake = fakeFix({pending: true});
    const loop = await fixture(fake.run);
    const result = summary();
    await loop.fix(result);
    expect(result.merged).toEqual([]);
    expect(result.needsHuman).toEqual([4]);
    expect(loop.wait).toHaveBeenCalledTimes(1);
  });
  it('resumes an existing PR without starting a second fixer or worktree', async () => {
    const fake = fakeFix({previous: [{state: 'OPEN', url: 'https://github.com/example/repo/pull/10'}]});
    const loop = await fixture(fake.run);
    const result = summary();
    await loop.fix(result);
    expect(result.merged).toHaveLength(1);
    expect(fake.calls.some(c => c.name === 'codex' || c.args[0] === 'worktree')).toBe(false);
  });
  it('backlogs large ideas without running the fixer', async () => {
    const fake = fakeFix({issues: [issue(4, 'idea')], largeIdea: true});
    const loop = await fixture(fake.run);
    const result = summary();
    await loop.fix(result);
    expect(result.backlog).toEqual([4]);
    const codex = fake.calls.filter(c => c.name === 'codex');
    expect(codex).toHaveLength(1);
    expect(codex[0].args).toContain('read-only');
    expect(fake.calls.some(c => c.args[0] === 'worktree')).toBe(false);
  });
  it('small ideas proceed through normal validation', async () => {
    const fake = fakeFix({issues: [issue(4, 'idea')]});
    const loop = await fixture(fake.run);
    const result = summary();
    await loop.fix(result);
    expect(result.merged).toHaveLength(1);
    expect(result.backlog).toEqual([]);
  });
  it('requires machine-readable filing results and scopes --only', async () => {
    const run = vi.fn().mockResolvedValueOnce('LOOP_SUMMARY {"filed":["issue-url"]}\n').mockResolvedValueOnce('no summary');
    const loop = await fixture(run, ['file', '--only', 'one']);
    expect(await loop.file()).toEqual(['issue-url']);
    expect(run.mock.calls[0][1]).toContain('--only');
    await expect(loop.file()).rejects.toThrow('no summary');
  });
  it('fixes existing issues on a zero-new round, then retests after a merge and stops', async () => {
    const loop = await fixture(vi.fn(), ['all']);
    loop.preflight = vi.fn(); loop.round = vi.fn(); loop.file = vi.fn().mockResolvedValue([]);
    loop.fix = vi.fn(async result => {if (result.round === 1) result.merged.push('merged-url');});
    loop.record = vi.fn();
    await loop.execute();
    expect(loop.round).toHaveBeenCalledTimes(2);
    expect(loop.fix).toHaveBeenCalledTimes(2);
    expect(loop.record).toHaveBeenCalledTimes(2);
  });
  it('enforces --max-rounds even if testers keep finding new issues', async () => {
    const loop = await fixture(vi.fn(), ['all', '--max-rounds', '2']);
    loop.preflight = vi.fn(); loop.round = vi.fn(); loop.file = vi.fn().mockResolvedValue(['new-issue']);
    loop.fix = vi.fn(); loop.record = vi.fn();
    await loop.execute();
    expect(loop.round).toHaveBeenCalledTimes(2);
  });
  it('logs a failed tester round and never files stale findings', async () => {
    const loop = await fixture(vi.fn(), ['all']);
    loop.preflight = vi.fn(); loop.round = vi.fn().mockRejectedValue(new Error('tester failed'));
    loop.file = vi.fn(); loop.fix = vi.fn();
    await expect(loop.execute()).rejects.toThrow('tester failed');
    expect(loop.file).not.toHaveBeenCalled();
    expect(loop.fix).not.toHaveBeenCalled();
    expect(await fs.readFile(path.join(loop.root, 'testers/ROUNDS.md'), 'utf8')).toContain('tester failed');
  });
  it('requires a new completed browser session rather than stale reports', async () => {
    const loop = await fixture(vi.fn().mockResolvedValue(''), ['round']);
    await fs.writeFile(path.join(loop.root, 'testers/one/run-log.jsonl'), '{"kind":"start","persona":"one","runId":"old"}\n{"kind":"end","runId":"old"}\n');
    await expect(loop.round()).rejects.toThrow('no completed fresh tester session');
  });
  it('accepts a fresh completed tester session and uses the one shared build', async () => {
    let loop;
    const run = vi.fn(async name => {
      if (name !== 'codex') return '';
      const directory = path.join(loop.root, 'testers/one');
      await fs.appendFile(path.join(directory, 'run-log.jsonl'), [
        {kind: 'start', persona: 'one', runId: 'fresh'},
        {kind: 'command', runId: 'fresh'},
        {kind: 'end', runId: 'fresh'}
      ].map(r => JSON.stringify(r)).join('\n') + '\n');
      await fs.writeFile(path.join(directory, 'issues.md'), '# Issues\nNo current findings.\n');
      return '';
    });
    loop = await fixture(run, ['round']);
    await loop.round();
    expect(run).toHaveBeenCalledTimes(2);
    expect(run.mock.calls[0][1]).toEqual(['run', 'build']);
    expect(run.mock.calls[1][2].input).toContain('one --skip-build');
  });
  it('preflight rejects a different branch and pending source changes', async () => {
    const run = vi.fn().mockResolvedValueOnce('feature\n');
    const loop = await fixture(run);
    await expect(loop.preflight()).rejects.toThrow('from main');
    run.mockResolvedValueOnce('main\n').mockResolvedValueOnce(' M src/state.js\n');
    await expect(loop.preflight()).rejects.toThrow('non-tester changes');
  });
  it('refuses to push a fix without a regression test change', async () => {
    const fake = fakeFix();
    const run = async (name, args, settings) => {
      if (name === 'git' && args[0] === 'status') return ' M src/state.js\n';
      return fake.run(name, args, settings);
    };
    const loop = await fixture(run);
    const result = summary();
    await loop.fix(result);
    expect(result.needsHuman).toEqual([4]);
    expect(result.merged).toEqual([]);
    expect(fake.calls.some(c => c.name === 'git' && c.args.includes('push'))).toBe(false);
  });
  it('bounds real issue selection by --max-fixes', async () => {
    const fake = fakeFix({issues: [issue(5), issue(4)]});
    const loop = await fixture(fake.run, ['fix', '--max-fixes', '1']);
    const result = summary();
    await loop.fix(result);
    expect(fake.calls.filter(c => c.name === 'codex')).toHaveLength(1);
    expect(fake.calls.find(c => c.name === 'codex').input).toContain('issue #4');
  });
});
