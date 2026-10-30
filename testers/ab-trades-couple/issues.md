# Issues

## [confusing] Goal progress uses an unearmarked bank balance
Dedupe-key: goal-progress-uses-unearmarked-combined-bank-balance
Steps: 1. Open More > Goals in the Jordan and Riley plan. 2. Read the Down payment card for $80,000 by December 2030. 3. Compare the displayed metric and explanation.
Expected: The card should distinguish money reserved for the down payment from general bank cash, since the household needs to know whether saving toward the goal is on track.
Actual: The card says “Funding not assessed” and explains that combined bank/cash is neither earmarked nor available for this goal, but then shows “Projected metric at target date: $99,148.” That value is the projected bank balance, which can read like the goal is funded despite the warning.
Screenshot: testers/ab-trades-couple/screenshots/2026-10-30T20-50-07-911Z-goals_recheck.png

## [wrong-number] Projection continues with a negative bank asset after depletion
Dedupe-key: projection-allows-negative-bank-balance-after-assets-depleted
Steps: 1. Open More > Projection & analysis. 2. Read the year-by-year detail after retirement. 3. Inspect years 2062 onward and the final net worth.
Expected: A household balance projection should flag an unfunded shortfall or stop at zero once cash and investments are depleted, rather than report a negative bank asset as net worth.
Actual: Bank reaches -$33,519 in 2062 after TFSA and RRSP/RRIF reach $0. The negative balance continues to -$1,676,631 by 2086, and final bank + investments equals that negative bank balance. The page shows a shortfall from 2062, but negative bank asset values remain in the reported result.
Screenshot: testers/ab-trades-couple/screenshots/2026-10-30T20-50-07-911Z-projection_recheck.png
