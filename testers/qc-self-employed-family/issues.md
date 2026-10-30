# Issues

## [confusing] Freelance income has no supported tax-aware income type
Dedupe-key: freelance-income-no-supported-tax-aware-income-type-confusing
Steps: 1. Open Salary for Camille, a Quebec freelance worker. 2. Review the income breakdown and the separate freelance entry workflow. 3. Inspect the household projection without an after-tax entry.
Expected: The household can represent Camille's $72,000 freelance income with a tax-aware estimate or follow a clear workflow for modelling the income and associated obligations.
Actual: Camille's employee gross and take-home remain $0. Salary explains that freelance receipts must be estimated separately after business expenses, income tax and self-employment contributions, then entered as after-tax income. It explicitly says self-employment taxes, tax instalments and child benefits are not calculated automatically. QPP/QPIP are mentioned as items to estimate separately. Noel's $58,000 employee take-home is $44,130, with Quebec provincial tax simplified; these are planning estimates, not independently verified tax amounts.
Screenshot: testers/qc-self-employed-family/screenshots/2026-10-30T19-39-38-818Z-fresh-salary.png

## [idea] Goal target does not create a savings schedule
Dedupe-key: goal-defaults-to-zero-monthly-savings-idea
Steps: 1. Open More > Goals with the Tax instalment reserve target of $16,000 by December 2027. 2. Review planned savings.
Expected: The target and deadline could prompt for a contribution schedule so the plan can show how the reserve might be funded.
Actual: Planned savings remain $0 per month and $0 at the target date, with status Not reached. The page says contributions are assumed and money is not moved or confirmed saved.
Screenshot: testers/qc-self-employed-family/screenshots/2026-10-30T19-39-38-818Z-fresh-goals.png
