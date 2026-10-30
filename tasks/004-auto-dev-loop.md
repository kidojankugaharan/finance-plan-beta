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
- [ ] `node scripts/loop.mjs all --dry-run` prints the full plan for one round
- [ ] `node scripts/loop.mjs round --only <one-persona>` works for real
- [ ] `npm test`, `npm run test:e2e`, `npm run build` pass

## Rules
- Ask before: deleting files, working outside the project folder, paid/credit tools. No git commands yourself (the script may contain them).
- Append your report below; 15 lines max.

## Codex report

## Opus review
