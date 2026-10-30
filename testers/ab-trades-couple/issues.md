# Issues

## [bug] Saved household reopens at welcome screen
Dedupe-key: persisted-household-reopens-as-welcome-screen-bug
Steps: 1. Open the persona's persistent agent profile; observe Jordan & Riley and the 2026 home plan. 2. In More, select Review setup; the app displays setup step 1 with blank household fields. 3. In the following harness batch, the same profile opens at the welcome screen with Build my plan and Import a backup, without the household. 4. Reload/reopen the profile; it remains at welcome.
Expected: The saved household should reopen consistently, and Review setup should show its saved values. The existing January closeout and lesson should remain available.
Actual: The profile first showed the existing plan, January 2026 closed, and a saved lesson. Review setup instead displayed blank fields; the subsequent fresh batch displayed the welcome screen. Reopening stayed on welcome. Browser errors were empty. Export/import could not be completed after the household disappeared.
Screenshot: testers/ab-trades-couple/screenshots/2026-10-30T16-22-25-768Z-final-state.png

## [confusing] Down payment goal marked met using household net worth
Dedupe-key: down-payment-goal-defaults-to-household-net-worth-confusing
Steps: 1. Open More > Goals in the existing Jordan & Riley plan. 2. Inspect the $80,000 December 2030 Down payment goal. 3. Compare the measure and status with the projection.
Expected: The status should communicate whether $80,000 is available for a down payment; total household net worth includes registered retirement assets and is not necessarily available for this goal.
Actual: The goal uses household net worth and labels the target met at $245,010 projected for 2030. The UI discloses that the measure does not show money earmarked or available for the goal, but still presents a met status.
Screenshot: testers/ab-trades-couple/screenshots/2026-10-30T16-21-09-321Z-projection.png
