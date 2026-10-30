# Issues

## [confusing] Freelance income has no supported tax-aware income type
Dedupe-key: freelance-income-no-supported-tax-aware-income-type-confusing
Steps: 1. Open Salary for Camille, the Quebec freelance worker. 2. Review the income breakdown and freelance entry guidance. 3. Inspect the 2026 projection.
Expected: The plan can represent Camille's $72,000 freelance receipts with tax-aware estimates, or clearly guide the household to a complete spendable-income estimate.
Actual: Camille's employee gross and take-home are $0. The page directs users to estimate receipts after business expenses, income tax, and self-employment contributions, then add an after-tax amount; it says QPP/QPIP, tax instalments, and child benefits are not calculated automatically. The household projection therefore shows only Noel's $58,000 employee income and is incomplete until an after-tax freelance amount is supplied. This is a disclosed limitation, not a tax estimate defect established by this test. Quebec tax figures are planning estimates and are not independently verified.
Screenshot: testers/qc-self-employed-family/screenshots/2026-10-30T20-49-11-406Z-salary-review.png

## [confusing] Quebec pension estimate is described as CPP-based
Dedupe-key: quebec-pension-estimate-cpp-based-wording-confusing
Steps: 1. Open More > CPP/QPP & OAS. 2. Read the pension estimate note for a Quebec household.
Expected: Quebec's public pension estimate should be identified as QPP or the relationship between QPP and CPP should be explained, since this household is in Quebec.
Actual: The note says, "Quebec uses a simplified CPP-based retirement benefit estimate," and that QPP deferral beyond 70 is not modelled. This appears to disclose a simplified estimate, but the CPP-based wording may lead a Quebec user to mistake the modelled pension program. No correctness of pension amounts was independently established.
Screenshot: testers/qc-self-employed-family/screenshots/2026-10-30T20-09-41-119Z-pension-current.png

## [confusing] Mortgage payment does not reduce a debt balance
Dedupe-key: debt-payments-do-not-reduce-debt-balance-confusing
Steps: 1. Open More > Starting balances and read the debt note. 2. Open Budget and inspect the mortgage expense. 3. Review Year or Projection.
Expected: A $1,900 monthly mortgage payment on a $290,000 mortgage would ordinarily reduce principal and pay interest over time, or the plan would prompt for those terms to model a mortgage balance.
Actual: Starting balances says debt balances are outside the plan and are not subtracted from net worth; debt payments are budget expenses and do not track or pay down a debt balance. Budget labels the $1,900 item "Mortgage payment (no principal or interest tracking)." The projection is $90,765 in bank and investments excluding the mortgage liability, while the full $22,800 annual payment is counted as expense. This is an explicit model limitation.
Screenshot: testers/qc-self-employed-family/screenshots/2026-10-30T20-49-11-406Z-budget-review.png

## [idea] Goal target does not create a savings schedule
Dedupe-key: goal-defaults-to-zero-monthly-savings-idea
Steps: 1. Open More > Goals and inspect the $16,000 Tax instalment reserve due December 2027. 2. Review planned savings.
Expected: The goal target and deadline could prompt for a contribution schedule so the household can see a possible path to fund the reserve.
Actual: The goal displays $0 monthly across 23 payments and $0 planned savings at the target date, with status Not reached. It explains contributions are assumed and money is not moved or confirmed saved. A goal amount and date alone do not fund it.
Screenshot: testers/qc-self-employed-family/screenshots/2026-10-30T20-09-41-119Z-goals-current.png
