# Issues

## [idea] Add a seasonal employment income schedule
Dedupe-key: seasonal-employment-income-schedule-idea
Steps: 1. Open Casey's plan. 2. Open Salary. 3. Review the controls for entering CAD 48,000 employment income paid mainly April through October.
Expected: Salary can represent the months when seasonal pay is earned so the monthly projection reflects winter cash needs without manually editing each month.
Actual: Salary provides annual employee payroll estimates and has no seasonal schedule control. The Year view supports monthly income schedules, but they must be represented there separately from salary.
Screenshot: testers/sk-seasonal-worker/screenshots/2026-10-30T18-42-21-815Z-salary.png

## [confusing] Annual overview hides seasonal cash shortfalls
Dedupe-key: annual-overview-hides-seasonal-cash-shortfalls-confusing
Steps: 1. Open the Year view for Casey's seasonal plan. 2. Compare the annual take-home and expense totals with the month-by-month schedule.
Expected: The annual summary should make clear that its surplus can coexist with months that have no pay and CAD 2,650 of expenses, since this household depends on a winter income buffer.
Actual: The overview reports CAD 38,304 take-home against CAD 31,800 expenses, while month details show CAD 0 take-home in February, March, November, and December and CAD 2,650 expenses each month; the bank balance reaches CAD 0 by March before seasonal wages resume. The month schedule contains the timing detail, but the annual summary does not surface this cash timing risk.
Screenshot: testers/sk-seasonal-worker/screenshots/2026-10-30T18-42-14-519Z-start.png
