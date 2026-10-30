# Issues

No current reproducible defects or confusing behavior were found in this fresh session using the existing persistent household plan.

Tested October 30, 2026 in `profile/agent`; fresh-session evidence is recorded in `run-log.jsonl` for run IDs `2026-10-30T18-38-09-006Z`, `2026-10-30T18-38-22-758Z`, `2026-10-30T18-38-31-900Z`, `2026-10-30T18-38-52-027Z`, and `2026-10-30T18-38-58-569Z`. The household opened as Jordan & Riley, starting year 2026. The existing plan had one closed month (January 2026) and eight past months still open; no further closeout was performed. January’s lesson remained visible after the backup import and a fresh browser session.

Rechecked tab values: 2026 salary gross CAD 131,000 and take-home CAD 101,174; budget CAD 5,600 monthly / CAD 67,200 yearly across rent 2,000, groceries 850, childcare 1,000, vehicle payment 680, and utilities/transport/other 1,070. The vehicle payment is explicitly an expense only; principal, interest, payoff date, and debt subtraction from net worth are unsupported and disclosed. Investment view showed 4% annual return, TFSA year-end CAD 19,760, RRSP/RRIF CAD 46,755, and CAD 2,549 investment growth. Registered room assumptions are disclosed estimates requiring verification. Goal remained CAD 80,000 by December 2030, measured against combined bank/cash with “Funding not assessed” and no earmarking. Tax estimates were observed but not independently verified; no tax error is asserted.

Exported and retained `2026-10-30T18-38-31-900Z-backup.json`. Import preview identified Jordan & Riley, year 2026, five regular expenses and one goal; after import and fresh restart, household, goal, closed January and its lesson persisted. Browser errors were empty in the completed sessions. One import attempt timed out because it reopened on Year rather than More; navigating to More and retrying succeeded. Initial welcome state, all seven setup steps, changing income/month overrides, dependant-age entry, offline mode, CSV contents, print layout, and tax correctness were not retested in this fresh-session run. Prior profiles, logs, backups and screenshots were preserved; no app fixes, issue filing, git, installations or other agents were used.

Fresh screenshots:

- `screenshots/2026-10-30T18-38-09-006Z-fresh-start.png`
- `screenshots/2026-10-30T18-38-15-826Z-more.png`
- `screenshots/2026-10-30T18-38-15-826Z-lessons.png`
- `screenshots/2026-10-30T18-38-22-758Z-year.png`
- `screenshots/2026-10-30T18-38-22-758Z-salary.png`
- `screenshots/2026-10-30T18-38-22-758Z-budget.png`
- `screenshots/2026-10-30T18-38-22-758Z-invest.png`
- `screenshots/2026-10-30T18-38-22-758Z-goals.png`
- `screenshots/2026-10-30T18-38-22-758Z-analysis.png`
- `screenshots/2026-10-30T18-38-31-900Z-more-backup.png`
- `screenshots/2026-10-30T18-38-52-027Z-import-preview.png`
- `screenshots/2026-10-30T18-38-52-027Z-post-import.png`
- `screenshots/2026-10-30T18-38-58-569Z-final-lessons.png`
- `screenshots/2026-10-30T18-38-58-569Z-final-goal.png`
