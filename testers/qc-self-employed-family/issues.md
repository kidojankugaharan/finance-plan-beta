# Issues

## [confusing] Self-employment income is entered as employee salary
Dedupe-key: self-employment-income-modeled-as-employee-salary-confusing
Steps: 1. Open Salary for Camille's $72,000 freelance income alongside Noel's $58,000 employment income. 2. Review income breakdown and estimated deductions.
Expected: The plan should distinguish freelance income from employee salary or offer a way to model self-employment tax treatment, because Camille's QPP and other obligations differ.
Actual: Both amounts are treated as gross salary and employee payroll deductions are estimated; Camille shows $5,521 for employee CPP/QPP, EI and QPIP. The page explicitly discloses that freelance/self-employment tax treatment is not modelled, advises excluding freelance receipts from annual salary, and suggests an independently estimated after-tax entry. The resulting take-home is therefore not a supported estimate of Camille's freelance income. Tax amounts are not independently verified.
Screenshot: testers/qc-self-employed-family/screenshots/2026-10-30T18-37-45-397Z-fresh-salary.png

## [idea] Goal can be left with zero planned savings
Dedupe-key: goal-defaults-to-zero-monthly-savings-idea
Steps: 1. Open More > Goals with the existing Tax instalment reserve goal of $16,000 by December 2027. 2. Review its planned savings amount.
Expected: A household may expect the target and date to prompt for a savings schedule so the plan can indicate how to fund the reserve.
Actual: The goal remains at $0 monthly for 23 payments and displays $0 planned savings at the target date and "Not reached." The page discloses that affordability is not checked and contributions are assumed, so the target alone does not create or move savings.
Screenshot: testers/qc-self-employed-family/screenshots/2026-10-30T18-38-17-928Z-fresh-goals.png
