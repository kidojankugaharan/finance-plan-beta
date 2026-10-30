# Issues

## [idea] Add a dedicated employer-pension income source
Dedupe-key: idea-add-a-dedicated-employer-pension-income-source
Steps: 1. Open the saved Robin household and inspect Salary and Pension settings. 2. Try to represent the brief's CAD 39,000 annual CPP, OAS, and employer pension income. 3. Inspect the 2026 income breakdown.
Expected: A retiree can enter employer pension income separately from employment salary and have it included in gross income and the projection.
Actual: The Salary page models CPP/QPP and OAS but has no employer-pension field. The profile shows 2026 gross income of CAD 12,239, all OAS, and CAD 0 CPP/QPP; the employer pension is not represented. An explicitly after-tax extra income entry may approximate cash flow, but it does not feed salary gross, take-home, or tax totals. This is an unsupported feature, not a tax calculation finding.
Screenshot: testers/nb-pensioner/screenshots/2026-10-30T14-57-26-105Z-review_salary.png

## [confusing] Home-improvement goal reports household net worth as progress
Dedupe-key: confusing-home-improvement-goal-reports-household-net-worth-as-progress
Steps: 1. Open the saved Accessible home improvements goal for CAD 18,000 by December 2028. 2. Inspect its progress metric and status.
Expected: The goal view should distinguish the amount earmarked or saved for home improvements from total household net worth, since net worth alone does not show that funds are available for the work.
Actual: The goal card uses Household net worth as its metric and marks the target met with projected net worth of CAD 221,829. The page discloses that the metric does not show money earmarked or available, but the status can still imply that the home-improvement target itself is funded.
Screenshot: testers/nb-pensioner/screenshots/2026-10-30T14-57-26-105Z-review_goals.png
