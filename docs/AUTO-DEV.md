# Automated improvement rounds

Run from the project root in a normal shell. Preview without credentials, processes, network access or file changes:

```powershell
node scripts/loop.mjs all --dry-run
node scripts/loop.mjs round --only on-student --dry-run
node scripts/loop.mjs fix --max-fixes 2 --dry-run
```

Real execution requires Node 24, installed dependencies and Playwright Chromium, authenticated `codex` and `gh`, and Git with push access. Repository auto-merge and the required `verify` check must already be configured. Real runs consume model usage and can create issues, comments, labels, branches and PRs, then merge passing fixes automatically. The loop itself never installs dependencies or changes repository settings.

Modes: `round` runs browser testers; `file` files their findings; `fix` handles existing open tester issues; `all` combines them and retests after merges. `--only <persona>` restricts testing and filing; fixes still consider all open tester issues. `--max-fixes N` defaults to 5 per round; `--max-rounds N` defaults to 3 tester rounds in `all`. Options require positive integers.

Real `fix` and `all` require `main` with no pending changes outside `testers/`. Commit the implementation before starting: worktrees are created from fetched `origin/main`, so unpublished source edits are not included. The root checkout fast-forwards after each confirmed merge. Existing reports/logs stay in place; reports are rewritten by testers to reflect current reproducible findings, while evidence is preserved. A local listener on `127.0.0.1:4174` prevents overlapping loop processes; it closes on exit. Do not run a separate tester session for the same persona concurrently.

Each tester round builds once, then runs up to three `gpt-6-luna` testers with low effort. `tester-run.mjs --skip-build` reuses that build; normal tester sessions still build by default. Fresh completed browser logs and rewritten, valid reports are required before filing. Filing uses the existing open/closed fingerprint deduplication; its `--summary-json` output supplies exact newly created issue URLs. Missing summaries fail the round rather than counting as zero.

Testers use persona-local `--commands` JSON-array batches when stdin cannot stay open; browser temp files also stay in the persona directory. Each failed Light tester gets exactly one `gpt-6.1-sol` low-effort attempt with the failure reason. Only validated personas are passed to filing through `--personas`; both-attempt failures appear with reasons in `ROUNDS.md`. If every persona fails, the round stops before filing. Tester final output is retained in `.cache/auto-dev/testers/` for diagnosis.

GitHub commands (including the issue filer) and git pushes retry transient internal-server, GraphQL “Something went wrong”, and HTTP 5xx failures three times after the first request, waiting 1, 2 and 4 seconds. Other failures surface immediately. Before selecting fixes, open issues are grouped by shared dedupe keys, identical titles, or conservative area-and-symptom signatures for the observed closed-month totals, goal net-worth status, and assumption-label defects. Unknown differently worded findings stay separate. The oldest eligible issue supplies the fix branch and receives related reports as evidence; groups with no eligible issue remain skipped. Duplicates (including triaged copies) receive `Duplicate of #N` and close only after a confirmed PR merge, including resumed PRs. `--max-fixes` counts groups.

Fixes use `gpt-6.1-sol` with medium effort in individual worktrees under `.cache/auto-dev/worktrees/`. Installed `node_modules` is linked into each worktree. The runner invokes executables without a shell; on Windows it resolves npm/Codex Node entry points to avoid `.cmd` quoting problems. CLI sandbox flags follow the [official Codex CLI reference](https://learn.chatgpt.com/docs/cli/reference). Agents receive no-git instructions and project-only write access; tester prompts restrict edits to their assigned persona directory.

Ideas are classified conservatively in read-only mode. Only localized UI/copy ideas proceed; new models, calculations, tabs or workflows get `idea-backlog`. Invalid triage results become `needs-human`. Eligible issues run oldest first, excluding `needs-human` and `idea-backlog`. Existing open PRs on the deterministic fix branch are resumed. Closed/merged PRs or abandoned local branches require inspection rather than silently creating duplicate fixes.

Every fix must change a regression test and pass `npm.cmd test`, `npm.cmd run test:e2e`, and `npm.cmd run build`. A failed attempt gets exactly one repair attempt with the failure output. Continued failure labels/comments the issue `needs-human` and moves on. Deleted files and changes outside source, tests, public assets, scripts, docs and README are rejected before staging. Commit identity uses the public noreply address from `CLAUDE.md`; PR bodies use `Fixes #<number>`.

Auto-merge requests are polled for up to ten minutes. Only confirmed merged PRs count as merged in `testers/ROUNDS.md`; a timeout becomes `needs-human` with a comment. Worktrees and diagnostic body files are retained for inspection, including failed work; no cleanup deletes evidence. After manually resolving a failed issue, remove `needs-human` when it is ready to re-enter the queue.

In `all`, even a zero-new-issue round fixes eligible existing issues. If those fixes merge, another tester round checks the updated main, subject to `--max-rounds`. Stop when there are no newly filed issues and no newly merged fixes, or when the round limit is reached. A round error is recorded and stops filing stale findings. Skipped/backlogged or human-needed issues remain visible in the round log and GitHub.

Local verification of task 004 uses dry runs and mocked orchestration unit tests. It does not claim a live Codex/gh round, actual PR merge, browser acceptance run, or resolution of existing issues #4 and #5.
