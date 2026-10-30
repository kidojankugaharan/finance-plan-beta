# Issues

## [idea] Allow limited Canadian residency in OAS assumptions
Dedupe-key: oas-residency-years-not-modelled
Steps: 1. Open More. 2. Open CPP/QPP & OAS. 3. Review Avery and Drew's assumptions; they moved to Canada five years ago.
Expected: A way to enter Canadian residence years or adjust the OAS estimate to reflect this household's circumstances.
Actual: The editor states OAS assumes 40 years of Canadian residence after age 18. It offers start ages but no residence-years input or amount adjustment. This is a disclosed limitation; no exact entitlement or tax error is claimed.
Screenshot: testers/mb-newcomer-couple/screenshots/2026-10-30T20-56-56-427Z-verified_pensions.png

## [confusing] Education goal does not set a planned contribution schedule
Dedupe-key: education-goal-zero-dedicated-savings
Steps: 1. Open More > Goals. 2. Review the existing education savings goal of $15,000 by December 2029.
Expected: A clear monthly amount or affordability calculation to help fund the stated goal.
Actual: Goal says “Savings plan: Not reached” and “Planned savings at target date: $0.” The workflow treats goal targets as separate from projection cash, and the goal schedule uses assumed contributions that are not moved or confirmed saved. This is disclosed, but the zero schedule does not make a funding amount apparent.
Screenshot: testers/mb-newcomer-couple/screenshots/2026-10-30T20-56-56-427Z-verified_goal_now.png

## [confusing] Contribution room for new residents needs external verification
Dedupe-key: registered-room-not-derived-from-residency-history
Steps: 1. Open More > Invest. 2. Review Contribution room for Avery and Drew, who moved to Canada five years ago.
Expected: Room estimates that account for eligibility years since residency began, or a clear input for contribution room confirmed from CRA.
Actual: The default room is blank and described as “Projected or not answered.” “Use estimates” assumes Canadian residency since age 18, no previous withdrawals or investment gains, and a salary-based RRSP amount. Exact CRA TFSA/RRSP room is not calculated; the UI asks users to rely on CRA and their own records. This is a disclosed limitation; no exact room or tax error is claimed.
Screenshot: testers/mb-newcomer-couple/screenshots/2026-10-30T20-55-41-308Z-session_invest.png
