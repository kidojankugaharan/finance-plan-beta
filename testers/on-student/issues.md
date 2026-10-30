# Issues

## [wrong-number] Closing a month removes its expenses from annual totals
Dedupe-key: closed-month-excluded-from-annual-totals
Steps: 1. Reopen the completed 2026 plan with January closed and monthly expenses of Housing 950, Groceries 300, Transport 100 and Student loan payment 100. 2. On Year, observe annual expenses of $15,950 and the note that closed data still counts in totals. 3. On Budget for 2026, observe $17,400 yearly expenses ($1,450 × 12). 4. Reload and import the exported backup; the difference remains.
Expected: Year expenses match the 2026 budget total of $17,400 because the page says closed data still counts and no expenses were edited.
Actual: Year shows $15,950, exactly 11 × $1,450, omitting the closed January. Budget still shows $17,400. The mismatch persisted after reload and backup import.
Screenshot: testers/on-student/screenshots/2026-10-30T14-00-20-359Z-reopened-final.png
