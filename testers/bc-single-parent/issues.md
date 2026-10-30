# Issues

## [wrong-number] Closed January is omitted from displayed 2026 take-home total
Dedupe-key: closed-january-omitted-from-displayed-annual-totals-wrong-number
Steps: 1. Open the 2026 Year tab with January already closed. 2. Compare annual take-home with the visible February–December monthly rows. 3. Observe the closed month is hidden while its data is said to count in totals.
Expected: Annual take-home should reconcile with January plus February through December, or the page should make the exclusion clear.
Actual: The Year summary shows $50,386 annual take-home, while the 11 visible rows show $4,199 each ($46,189 total). The page says the closed month still counts in totals. Annual expenses of $51,600 do reconcile to 12 × $4,300. Salary independently shows $50,386 for 2026.
Screenshot: testers/bc-single-parent/screenshots/2026-10-30T16-22-44-859Z-year_current.png

## [bug] Goals and projection are unreachable from the phone layout
Dedupe-key: goals-and-projection-unreachable-from-phone-layout-bug
Steps: 1. Open More at the iPhone 13 viewport. 2. Try Goals or Projection & analysis from More > Explore. 3. Try the corresponding bottom tabs.
Expected: A phone user should be able to open the goal and projection pages listed in the app navigation.
Actual: More shows Goals and Projection & analysis as plain text. Their bottom tabs are desktop-only and hidden at this viewport, so the harness cannot activate either page.
Screenshot: testers/bc-single-parent/screenshots/2026-10-30T16-23-52-942Z-more_nav.png
