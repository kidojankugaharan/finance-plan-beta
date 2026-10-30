# Issues

## [wrong-number] Year summary says eight past months remain open
Dedupe-key: year-summary-open-month-count-mismatch|wrong-number
Steps: 1. Open the persisted on-student plan on Year in the 2026 plan year. 2. Compare the summary prompt with the month-by-month list and closed-month notice. 3. Observe the summary says 8 past months are still open, while January 2026 is identified as the one hidden closed month and only February through December are listed.
Expected: The open-month count should reflect the actual months still available to close. On this plan it should not report eight months when February through December are open (11 months).
Actual: The Year summary says “8 past months are still open. Close February 2026”, while its list shows February through December and says “1 closed month is hidden.”
Screenshot: testers/on-student/screenshots/2026-10-30T18-37-52-239Z-current_year.png
