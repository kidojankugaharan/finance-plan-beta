# Issues

## [wrong-number] Closed January is omitted from displayed 2026 monthly take-home
Dedupe-key: closed-january-omitted-from-displayed-annual-totals-wrong-number
Steps: 1. Open the 2026 Year tab with January already closed. 2. Compare annual take-home income with the visible February-December monthly rows. 3. Observe that January is hidden while the page says its data still counts in totals.
Expected: Annual take-home should reconcile with the monthly amounts, or the page should explain why the displayed monthly rows do not add to the annual total.
Actual: Year shows $50,386 annual take-home, while each of the 11 visible rows shows $4,199 (11 x $4,199 = $46,189). At $4,199 per month, 12 months would be $50,388, $2 higher than the displayed annual figure. The matching Salary and Projection figures are $50,386, so the discrepancy may come from rounding or month aggregation; the page does not explain it. Expenses reconcile: $51,600 annually equals 12 x $4,300.
Screenshot: testers/bc-single-parent/screenshots/2026-10-30T18-39-32-421Z-year_current.png
