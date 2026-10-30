# Persona tester instructions

Use only fictional data from `testers/personas.json` and your assigned `brief.md`. Stay in this project; no git commands or installations. This task records findings; leave application fixes for task 004.

## Start a session

From the project root run `node scripts/tester-run.mjs <persona-id>`. It builds and serves `dist/` locally, opens headless Chromium in an iPhone 13 viewport, and reads one JSON command per stdin line. Keep stdin open while interacting; EOF or `{"op":"quit"}` closes cleanly. The profile persists per persona. Run only one session per persona at a time. Errors return `ok:false` and set a failing exit code; inspect and correct the command rather than ignoring it. Vite build output goes to stderr; responses are JSON on stdout.

Examples (send each separately and read the result):

If the command runner closes stdin, use file batches instead: write a JSON array (for example `[{"op":"text"},{"op":"errors"}]`) to `testers/<persona-id>/commands.json`, then run `node scripts/tester-run.mjs <persona-id> --skip-build --commands testers/<persona-id>/commands.json` when a shared build is available. Read the output, rewrite the command file, and run the next batch. Each batch opens the persistent profile and closes cleanly. Keep actions depending on transient UI together in one batch (for example import, inspect preview text, confirm import); repeat tab navigation when reopening. The harness stores browser temporary files under the persona's `temp/` directory so sandboxed Windows sessions do not need access to user TEMP. Do not override TEMP/TMP to locations outside the persona directory.

```json
{"op":"text"}
{"op":"click","role":"button","text":"Build my plan"}
{"op":"fill","label":"Your name","value":"Alex"}
{"op":"select","label":"Province or territory","value":"ON"}
{"op":"click","text":"Continue","role":"button"}
{"op":"click","selector":"[data-tab=budget]"}
{"op":"screenshot","name":"budget"}
{"op":"errors"}
{"op":"note","text":"Explain the decision or limitation you observed."}
{"op":"goto","path":"./"}
```

Labels/text match exactly. `selector` is a CSS escape hatch. Screenshot names accept letters, digits, underscore and dash. Screenshot paths returned by the harness are relative to your persona directory. `run-log.jsonl` appends timestamped commands, results and browser errors across sessions. Profiles/download working files are local and ignored; logs, briefs, issues and fictional exported backups are deliverables. Screenshots are also ignored by existing repository policy but remain available on disk. Service workers are blocked to prevent a cached build from hiding changes; offline behavior is covered by the project's e2e suite.

## Complete the household journey

1. Read your brief and current page. Complete all seven setup steps with the household's province, ages, employment income and January 1 balances. For couples split the provided aggregate balances reasonably and record the split. Use 2026 as the starting year. Keep defaults only after considering them. Record choices for growth, retirement and pensions. Do not disguise unsupported income as salary; document the limitation and any explicitly labelled approximation.
2. Visit Year, Salary, Budget, Invest, More, Goals, Projection & analysis, and Lessons learned. Add realistic expense categories including your debt payment (do not double count the total). Try relevant salary/month overrides, registered room, and a goal from your brief. A debt payment expense does not automatically model principal or interest; investigate that distinction. Verify displayed values against simple input arithmetic. Report tax concerns as hypotheses unless independently established.
3. Close January 2026 (a past month), enter a lesson, inspect it in More > Lessons learned, and reload to verify persistence. Never alter the system clock. If rerunning, inspect existing closed months and avoid pretending to complete a new closeout.
4. In More, send `{"op":"export"}`. Keep the returned dated backup JSON. Send `{"op":"import","file":"<returned backup filename>"}`, read the preview, then click the `Import this plan` button. Verify the household, expense, goal, closed month and lesson survived. Reload or restart the session to check persistence.
5. Capture setup/review, each tab, the closeout/lesson, import preview and the final state. Read `errors`; investigate any browser error. Add notes describing what you tried, what worked, what was blocked and what remains untested. Do not infer a pass from a successful click alone.

## Issue format

Write `testers/<persona-id>/issues.md`. One second-level heading per issue, exactly as below; use `bug | confusing | wrong-number | idea`. With no findings, write a plain sentence under the top-level heading. Never use a second-level heading for general notes. Use a shared `Dedupe-key` for the same underlying problem across personas, even if titles differ. The default key is normalized title plus type. Keep different causes separate. Reference actual screenshots, not invented ones.

```markdown
# Issues

## [confusing] Short concrete title
Dedupe-key: stable-underlying-problem
Steps: 1. Open ... 2. Enter ... 3. Observe ...
Expected: What this household expected, and why.
Actual: What the page actually showed. State if this is a disclosed limitation.
Screenshot: testers/<persona-id>/screenshots/<actual-file>.png
```

Run `node scripts/file-issues.mjs` to list locally deduplicated reports without credentials or network access. Review the output. `--file` explicitly creates GitHub issues using the installed/authenticated `gh` CLI and creates missing `tester`, type and `persona:<id>` labels. It checks fingerprint markers on all open and closed tester issues before creating a duplicate. Dry-run deduplication is local; it does not check GitHub. Do not file during the harness acceptance run. Missing tools/installations belong in the report.

The reproducible acceptance journey is `node scripts/tester-student-run.mjs`. Each run keeps a separate dated persistent profile inside the student's `profile/` directory and starts on the welcome screen. It preserves earlier profiles and evidence. Reopen a completed acceptance profile with `node scripts/tester-run.mjs on-student --profile acceptance-<runId>` using the exact profile directory name recorded in the run log. Normal agent sessions use `profile/agent/` and should use the persistent plan as found. The other nine personas are prepared briefs, not completed tests.
