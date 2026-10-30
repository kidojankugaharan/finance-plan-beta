# Calculation conventions

Reviewed against the supplied reference and official 2026 sources on 2026-10-29. These are household planning estimates, not payroll certification or a complete personal tax return.

## Reference compatibility

The calculation functions were separated into model, tax, pensions, budget, investments, projection and drawdown modules. Each engine instance owns its state and caches. No calculation module reads browser storage or the DOM.

`tests/fixtures/projection-golden.json` contains only the reference's synthetic Alex/Sam and Pat/Lee examples. Tests compare every rounded field across 61 years for each household. There is no runtime dependency on the private HTML, its storage, or other private fixtures. New plans automatically stop salaries at shared retirement; explicit true/false work breakpoints remain authoritative. This leaves the reference fixtures unchanged because they explicitly start retirement at that same year.

## Taxes and pensions

- [CRA 2026 federal, provincial and territorial annual brackets](https://www.canada.ca/en/revenue-agency/services/tax/individuals/tax-rates-brackets/current-year.html).
- [CRA T4127, January 2026: payroll formulas, credits, CPP/CPP2 and EI](https://www.canada.ca/en/revenue-agency/services/forms-publications/payroll/t4127-payroll-deductions-formulas/t4127-jan/t4127-jan-payroll-deductions-formulas-computer-programs.html).
- [British Columbia July update](https://www.canada.ca/en/revenue-agency/services/forms-publications/payroll/t4032-payroll-deductions-tables/t4032bc-july/t4032bc-july-general-information.html): the model uses the **annual 5.6%** lowest rate and $690 reduction, not prorated second-half withholding rates. BC indexation is paused through 2030.
- [Revenu Québec 2026 payroll changes](https://www.revenuquebec.ca/en/businesses/source-deductions-and-employer-contributions/employers-principal-changes-for-2026/) and [Quebec income tax rates](https://www.revenuquebec.ca/en/citizens/income-tax-return/completing-your-income-tax-return/income-tax-rates/): QPP 6.3% plus the second tier, reduced EI, QPIP, the worker deduction, and basic provincial amount.

Ontario preserves the reference's fuller tax-credit calculation. Other provinces use basic personal and payroll credits without the full set of senior, spouse/dependant, disability, medical, donation, tuition and low-income reductions. Quebec uses a 16.5% federal abatement. Manitoba's basic amount is reduced above $200,000. Future thresholds generally increase with the user's inflation assumption; PE/MB amounts and Ontario's highest thresholds stay fixed. Future legislative changes are not forecast.

CPP estimates apply the reference maximum and a salary-to-YMPE contribution-history approximation with a 17% dropout. CPP starts from 60–70 with early/deferred adjustments. OAS starts from 65–70, assumes full residency, and includes recovery tax and the age-75 increase. Pensions replace salary after the shared work transition. Quebec retirement benefits use the same approximation; QPP-specific contribution-history and deferral beyond 70 are not modelled.

## Cash, budgets, investments and withdrawals

Starting balances are January 1 balances, not “as of today.” Monthly income is annual take-home divided by 12 unless overridden. Budget recurrence is averaged monthly; a dated one-time item lands only in its specified month. Auto budgets inflate annually; annual lists carry forward without inflation. Closed months omit cash flows while account contributions and growth still occur, as in the reference.

Automatic contributions use the reference's available-cash pool and verified room anchors. Monthly, annual and quarterly schedules allocate by account priority. Missing room is skipped. Future RRSP room uses prior-year earned income with published/indexed caps; pensions create no RRSP room. TFSA limits project in $500 increments, and withdrawals restore room in the following year. Estimated room cannot infer historical contributions, residence or withdrawals from balances and must be verified.

RRSP deductions include the first-60-day election and pay their tax benefit in April of the following year. Opening RRSP/RRIF balances are before withdrawal tax. RRSP contributions stop after 71, with prescribed RRIF minimums starting the following year. Tax-aware withdrawals gross up RRSP amounts to supply the needed net cash. The optimizer compares a finite set of income ceilings and a ten-year terminal RRSP liquidation assumption; it does not prove a globally optimal lifetime strategy.

Returns compound monthly. Manual return overrides cannot lose more than the account balance. Values shown as net worth include pre-tax RRSP/RRIF money, so they are not all spendable after tax. Negative bank balances and uncovered withdrawals indicate a shortfall.

Dedicated goal schedules are illustrative sums independent of the bank/investment projection. They do not reserve cash, reduce spending, or test affordability. Inflation-adjusted analysis divides monetary values by cumulative inflation while leaving rates unchanged.
