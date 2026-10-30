# Issues

## [wrong-number] Year summary says eight past months remain open
Dedupe-key: year-summary-open-month-count-mismatch|wrong-number
Steps: 1. Open the persisted on-student plan in the 2026 Year view. 2. Compare the summary prompt with the month-by-month list and closed-month notice. 3. Observe the summary says 8 past months are still open, while February through December are listed and January is the one hidden closed month.
Expected: The open-month count should match the months still available to close. With January closed, February through December are 11 open months.
Actual: The Year summary says "8 past months are still open. Close February" despite listing February through December and saying 1 closed month is hidden.
Screenshot: testers/on-student/screenshots/2026-10-30T19-44-23-264Z-final_persisted_year.png

## [confusing] Debt payment expense does not track student-loan balance
Dedupe-key: debt-payment-does-not-amortize-balance|confusing
Steps: 1. Open More > Starting balances and read the debt guidance. 2. Open Budget and inspect the $100 monthly student loan payment. 3. Check the Year summary net worth and observe debts are excluded from the reported total.
Expected: A student with an $18,000 loan would expect either a balance/amortization input or an explicit balance in net worth, so the $100 payment can be understood against principal and interest.
Actual: The starting-balance dialog says debt balances are outside the plan and are not subtracted from net worth; debt payments are expenses and do not track or pay down a debt balance. The current plan therefore cannot project the $18,000 loan balance or determine how much of each payment reduces principal.
Screenshot: testers/on-student/screenshots/2026-10-30T19-42-00-840Z-balances.png
