# Issues

## [confusing] One shared stop-work age retires both partners together
Dedupe-key: shared-stop-work-age-retires-both-partners-together-confusing
Steps: 1. Complete setup for Pat age 62 and Lee age 59 in NS starting in 2026. 2. Set shared stop-work age to 62. 3. Open Salary and select 2029. 4. Inspect More > Inflation, growth & retirement.
Expected: Pat and Lee can explore different retirement years with separate stop-work choices.
Actual: Both salaries stop in 2029, when Lee reaches 62 and Pat reaches 65. Salary shows Retired, Pat pension gross $28,909 and Lee gross $0. Assumptions explicitly disclose that both salaries stop at the younger person's shared age. This is a disclosed limitation; the yearly work-status choice is also shared, rather than a separate age for each person.
Screenshot: testers/ns-near-retirement/screenshots/2026-10-30T16-28-40-858Z-current-shared-retirement.png

## [wrong-number] Closing January removes its surplus from projected balances
Dedupe-key: month-closeout-drops-cashflow
Steps: 1. Use January 1 bank balances totalling $20,000, salaries $78,000 and $22,000, monthly expenses $3,900, 4% investment return and no contributions. 2. Observe Year: January bank $22,321, February $24,642, December $47,854 and year-end net worth $547,054. 3. Set January expense override to the same $3,900. 4. Close January 2026 with a lesson. 5. Reload and inspect Year; export/import and inspect again.
Expected: Closing a month preserves its cash flow and only hides its card, consistent with the dialog saying its numbers stay saved and count in projections and totals.
Actual: February bank becomes $22,321, December becomes $45,533 and year-end net worth becomes $544,733: about $2,321 lower, equal to January take-home $6,221 less expenses $3,900. Annual take-home $74,654 and expenses $46,800 remain unchanged. The closed-month notice says data still counts in totals, but projected cash omits the January surplus. This persisted after reload and import. Before evidence is current-year; after evidence is current-final-year.
Screenshot: testers/ns-near-retirement/screenshots/2026-10-30T16-28-40-858Z-current-final-year.png
