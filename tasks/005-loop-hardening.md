```queue
project: C+D
tool: codex
tier: standard
status: queued
interval: none
last_run: never
review: now
paid: no
```

# 005: Loop hardening after first live rounds

Tier: Standard (gpt-6.1-sol, medium)
Project folder: C:\Users\Kido\03-ventures\finance-plan-beta (stay inside it)

## Goal
First 3 live rounds (testers/ROUNDS.md, 2026-10-30) filed 17 issues and merged 5 fixes, but lost work to avoidable failures. Fix those in `scripts/loop.mjs` / `scripts/file-issues.mjs`.

## Scope
- In:
  - Retry transient GitHub failures (git push / gh "Internal Server Error", GraphQL "Something went wrong", 5xx) 3x with backoff before marking needs-human.
  - Tester sessions: 4-5 of 10 personas were skipped each round ("no completed fresh tester session", missing run-log.jsonl). Find why from `.cache/auto-dev/` and tester logs; fix the prompt/harness. If a Light (gpt-6-luna) tester still fails, retry that persona once on gpt-6.1-sol low.
  - Duplicates: before fixing, group open issues that describe the same defect (same area + symptom across personas); fix once, close the others with "Duplicate of #N" when the PR merges.
  - ROUNDS.md: list skipped personas with reason.
- Out: app feature work.

## Acceptance checklist
- [x] Unit tests cover retry, persona fallback, duplicate grouping
- [x] `npm test`, `npm run test:e2e`, `npm run build` pass; `node scripts/loop.mjs all --dry-run` OK

## Rules
- Ask before: deleting files, working outside the project folder, paid/credit tools. No git commands yourself.
- Append your report below; 15 lines max.

## Codex report

- Implemented 2026-10-30; all changes and verification stayed inside this project.
- Shared GitHub retry handles transient push/gh/filer errors: three retries with 1s/2s/4s backoff; permanent errors fail immediately.
- Evidence: cached issue #5/#8 push failures and #9 GraphQL failure; tester notes identify closed stdin and Windows TEMP EPERM.
- Harness now supports persona-local command-file batches, attaches piped stdin before launch, and uses persona-local browser temp storage.
- Failed Light personas retry once on gpt-6.1-sol low; only validated reports reach filing; ROUNDS lists skipped personas and both failure reasons.
- Open duplicates group by shared keys/titles or conservative signatures for observed defects; one eligible fix runs per group.
- Related evidence reaches the fixer; duplicate comments/closures happen only after confirmed merges, including resumed PRs.
- Updated AUTO-DEV/PROMPT guidance; ignored transient persona command/temp files; retained tester output for future diagnosis.
- Passed: npm.cmd test (72 tests), npm.cmd run test:e2e (26 tests), npm.cmd run build, and all --dry-run.
- Local command-file and piped-stdin browser smoke checks passed with isolated profiles; evidence appended to on-student/run-log.jsonl.
- Dry-run trace: .cache/auto-dev/task-005-dry-run.txt; scoped filer dry-run also passed.
- No live codex/gh calls, git commands, paid tools, file deletions, or app feature changes; semantic grouping intentionally leaves unknown paraphrases separate.

## Opus review

Pass. Unit 72/72 re-verified by Opus. Merged; rounds 4-6 launched.
