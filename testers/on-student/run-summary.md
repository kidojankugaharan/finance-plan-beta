# Student acceptance run — 2026-10-30

Completed run: `2026-10-30T13-43-57-916Z` (UTC). Alex, 21, Ontario, part-time employment. All data is fictional.

Completed seven setup steps; visited Year, Salary, Budget, Invest, More, Goals, Projection & analysis, and Lessons learned. Added housing 950, groceries 300, transport 100 and student-loan payment 100 (CAD 1,450/month). Used same-pay growth, 2% inflation, 4% return, retirement/CPP/OAS at 65, and illustrative TFSA/RRSP room of 5,000/1,000. Created a CAD 3,000 emergency buffer goal for December 2027 with a separate planned savings schedule.

Closed January 2026 and saved a lesson. Reloaded, exported the plan, inspected the import preview and confirmed import. Verified the expense, goal, lesson and closed month survived. No console/page errors. Acceptance automation completed; two product findings remain in [issues.md](issues.md): debt principal tracking (idea), and a verified annual-total discrepancy after closeout (wrong-number). Successful workflow completion does not mean the application has no defects.

Evidence: [command/event log](run-log.jsonl), [exported backup](2026-10-30T13-43-57-916Z-backup.json), [before closing](screenshots/2026-10-30T13-43-57-916Z-year-before-close.png), [final screen](screenshots/2026-10-30T13-43-57-916Z-final.png). Fifteen screenshots were captured for this run. Earlier development attempts remain in the log and screenshot folder, including failures from a collapsed help section assertion and an import-preview timing race; both harness problems were corrected. No files were deleted.

Reopen the completed persistent profile:

```powershell
node scripts/tester-run.mjs on-student --profile acceptance-2026-10-30T13-43-57-916Z
```

The preceding successful acceptance profile was also reopened through the JSONL CLI, confirming browser-restart persistence and zero browser errors. No tax accuracy or offline test is claimed by this persona run. The existing browser suite separately passed its offline checks. The remaining nine persona briefs are ready for their own agent runs; they have not been tested here. GitHub filing was not executed.
