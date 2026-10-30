# Issues

## [wrong-number] Closing January removes its cash flows from annual totals
Dedupe-key: closed-month-cash-flows-excluded-from-annual-totals
Steps: 1. Open the existing 2026 Year view for Avery and Drew, where monthly take-home is $6,398 and monthly expenses are $4,100. 2. Observe January is already closed and hidden. 3. Compare the displayed annual totals and Projection & analysis row.
Expected: The 2026 totals include January's saved income and expenses; the Year notice explicitly says hidden closed-month data still counts.
Actual: Both the Year summary and projection show $70,383 income and $45,100 expenses, exactly 11 × $6,398 and 11 × $4,100. The other 11 month cards each show the regular monthly figures. The displayed annual totals contradict the closed-month notice.
Screenshot: testers/mb-newcomer-couple/screenshots/2026-10-30T14-57-52-880Z-fresh-year.png; testers/mb-newcomer-couple/screenshots/2026-10-30T14-57-52-880Z-projection-current.png

## [idea] Allow OAS estimates to reflect shorter Canadian residency
Dedupe-key: oas-residency-duration-cannot-be-modeled
Steps: 1. Open More > Review setup > Pensions for this household, which moved to Canada five years ago. 2. Review the OAS assumption and available fields.
Expected: Let the household enter Canadian-residency years or an OAS benefit estimate so shorter residency can be represented.
Actual: Setup discloses that OAS assumes 40 years of Canadian residence after age 18 and provides no residency-years field or OAS amount override. This is a disclosed limitation. Based on the brief, projected residency at age 65 would be about 29 years for Avery and 31 for Drew; no entitlement calculation was independently verified.
Screenshot: testers/mb-newcomer-couple/screenshots/2026-10-30T14-57-52-880Z-pensions-current.png

## [idea] Track the personal-loan balance as a household liability
Dedupe-key: debt-payments-do-not-model-liability-principal-or-interest
Steps: 1. Review the existing $350 monthly Personal loan payment expense, with $3,750 of other living expenses and $4,100 total monthly expenses. 2. Review the Year net-worth metric and starting balances.
Expected: Represent the $12,000 loan liability and show how payments affect principal and interest, or clearly identify net worth as assets before debt.
Actual: Budget lists the payment as an expense, but there is no loan balance or amortization input. The Year metric says “Bank + TFSA + RRSP” and does not subtract the $12,000 liability; the expense does not model principal or interest. This is a disclosed product limitation.
Screenshot: testers/mb-newcomer-couple/screenshots/2026-10-30T14-57-52-880Z-budget-current.png; testers/mb-newcomer-couple/screenshots/2026-10-30T14-57-52-880Z-final-year.png
