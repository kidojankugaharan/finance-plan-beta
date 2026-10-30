# Issues

## [wrong-number] Closing a month removes its expenses from Year totals
Dedupe-key: closed-month-excluded-from-annual-totals
Steps: 1. Enter expenses totaling $1,450/month for 2026. 2. Close January 2026. 3. Compare Year, Budget, and Projection & analysis totals.
Expected: All annual views should include 12 months of expenses ($17,400), especially because Year says closed data still counts in totals.
Actual: Year reports $15,950 ($1,450 x 11), while Budget and Projection & analysis report $17,400. The mismatch reproduced after closing January in this fresh profile.
Screenshot: testers/on-student/screenshots/2026-10-30T14-53-55-226Z-year_after_close.png

## [idea] Track student-loan balance and payment allocation
Dedupe-key: debt-payment-does-not-amortize-principal
Steps: 1. Enter the $100 monthly student-loan payment as a Debt expense. 2. Inspect Year and Projection & analysis.
Expected: For this household's $18,000 student loan, show the outstanding liability or offer an explicitly optional principal/interest schedule so the $100 payment can reduce the balance.
Actual: The payment is counted as spending, but the loan principal and interest are not modeled. This is a disclosed limitation; no loan balance or amortization controls were present in the reviewed plan.
Screenshot: testers/on-student/screenshots/2026-10-30T14-53-55-226Z-budget_expenses.png
