# Issues

## [idea] Track student debt principal alongside monthly payments
Dedupe-key: debt-principal-tracking
Steps: 1. Set up Alex with cash 1,500, TFSA 500 and student debt 18,000. 2. Visit Budget and add Student loan payment at 100 per month. 3. Inspect starting balances, More and Projection for a debt principal input.
Expected: As a student I want to record my outstanding loan and distinguish reducing the balance from paying interest.
Actual: I could add a payment expense but found no dedicated liability balance or payoff schedule in the visited screens. This is a feature request; no independently verified tax or arithmetic error is claimed.
Screenshot: testers/on-student/screenshots/2026-10-30T13-43-57-916Z-budget-debt.png

## [wrong-number] Closing a month removes its expenses from annual totals
Dedupe-key: closed-month-excluded-from-annual-totals
Steps: 1. Use 2026 and monthly expenses Housing 950, Groceries 300, Transport 100 and Student loan payment 100. 2. Observe Year expenses of 17,400 before closing. 3. Close January with a lesson, then inspect Year totals. 4. Reload or export/import; the discrepancy persists.
Expected: Annual expenses stay 1,450 x 12 = 17,400. The page explicitly says closed data still counts in totals.
Actual: Year expenses fall to 15,950 = 1,450 x 11, omitting January. Take-home also falls when the month closes. No edits to income or expenses were made during closeout.
Screenshot: testers/on-student/screenshots/2026-10-30T13-43-57-916Z-final.png
