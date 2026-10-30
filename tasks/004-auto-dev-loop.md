```queue
project: C+D
tool: codex
tier: standard
status: queued
after: 003-persona-testers.md
interval: none
last_run: never
review: now
paid: no
```

# 004: Auto-dev loop (test → issues → fix PRs → auto-merge → retest)

Tier: Standard (gpt-6.1-sol, medium)
Project folder: C:\Users\Kido\03-ventures\finance-plan-beta (stay inside it)

## Goal
One command runs a full improvement round with no human input, per REQUIREMENTS.md "Auto-development loop".

## Scope
- In: `scripts/loop.mjs` (run by Claude from a normal shell, not the Codex sandbox):
  1. `round`: for each persona in `testers/personas.json`, run `codex exec` (model gpt-6-luna, effort low, write access to the project only) with `testers/PROMPT.md` + persona brief → fills `testers/<id>/`. Up to 3 personas in parallel.
  2. `file`: `node scripts/file-issues.mjs --file`, skipping duplicates of open/closed issues.
  3. `fix`: for each open `tester` issue (oldest first, max N per round, default 5): branch `fix/<num>-<slug>` from main → `codex exec` (gpt-6.1-sol, medium) with the issue body + CLAUDE.md, told: fix, add a test, no git → run `npm test`, `npm run test:e2e`, `npm run build` → if green: commit (noreply identity from CLAUDE.md), push, `gh pr create` with "Fixes #num", `gh pr merge --auto --merge`; if red after one retry: label issue `needs-human`, comment the failure, move on.
  4. `all`: round → file → fix; then repeat `round` once; stop when a round files 0 new issues or after `--max-rounds` (default 3).
  - Product decisions: issues of type `idea` get fixed only if small; larger ones are labeled `idea-backlog`.
  - Log each round to `testers/ROUNDS.md` (date, issues filed, PRs merged, needs-human).
  - `--dry-run` prints every command without running it.
- Out: repo settings (Claude enables auto-merge + required CI check).

## Acceptance checklist
- [x] `node scripts/loop.mjs all --dry-run` prints the full plan for one round
- [ ] `node scripts/loop.mjs round --only <one-persona>` works for real
- [ ] `npm test`, `npm run test:e2e`, `npm run build` pass

## Rules
- Ask before: deleting files, working outside the project folder, paid/credit tools. No git commands yourself (the script may contain them).
- Append your report below; 15 lines max.

## Codex report

- Implemented `scripts/loop.mjs`: round/file/fix/all, persona filtering, 3 tester workers, fix/round limits, project-only Codex sandboxes.
- Tester rounds build once; `tester-run.mjs --skip-build` reuses dist and preserves normal standalone behavior.
- Require fresh completed browser logs and rewritten valid issue reports before filing; filing adds scoped selection and JSON summaries.
- Fixes use isolated retained worktrees, noreply commits, regression tests, all three validation commands, and one repair retry.
- Added conservative small-idea triage, idea-backlog/needs-human labels and comments, PR resumption, and confirmed-merge polling.
- Existing open tester issues are processed even when a round files zero new issues; merged changes trigger retesting within the round limit.
- Real rounds append dated outcomes to `testers/ROUNDS.md`; dry runs launch no processes and write no logs.
- Added `docs/AUTO-DEV.md` with prerequisites, options, retained evidence, and recovery behavior.
- PASS: `npm.cmd test` (56 tests, including 20 orchestration tests); full all dry-run; scoped round/fix dry-runs; scoped issue-filer dry-run.
- Not run: live Codex/gh steps, e2e, or build; issues #4/#5 and repository settings untouched. No git commands executed or files deleted.

## Opus review

Pass. e2e 20/20 + build verified by Opus. Live run next.
