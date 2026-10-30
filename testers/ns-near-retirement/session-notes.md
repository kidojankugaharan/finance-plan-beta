# Fresh session audit - 2026-10-30 (20:13 UTC)

Opened a fresh headless browser session against the existing profile/agent plan. Preserved prior logs, profiles, screenshots and backups. Used file batches; the first two writes used UTF-8 BOM or unsupported PowerShell methods and were rejected before browser actions. Subsequent batches used ASCII JSON. An initial submenu navigation attempt used visible label text and timed out; selectors based on the app's `#open-goals`, `#open-analysis`, and `#open-lessons` controls worked. The final session was explicitly closed with `quit`; error reports were empty. System clock was not changed.

Plan loaded with Pat & Lee, Nova Scotia, 2026. Salary review showed gross income $100,000/year and take-home $74,654, consisting of Pat $78,000 and Lee $22,000; current individual stop-work years are 2029 (Pat, age 65) and 2032 (Lee, age 65). Tax and pension figures are estimates. More states Nova Scotia omits some senior/family/low-income credits, CPP/QPP depends on contribution history, and OAS assumes full residency. No unsupported pension income was added as salary. Existing starting balances remained cash $20,000, TFSA $110,000, RRSP $370,000 (aggregate $500,000); Invest projects 4% return and its room assumptions are disclosed. No salary overrides, registered room values or settings were changed in this audit.

Budget categories are living $1,750 + mortgage $950 + groceries $800 + transport $400 = $3,900/month ($46,800/year). This matches the provided total with the mortgage payment included once. Monthly Year view showed income $6,221 less expenses $3,900 = $2,321. The interface says year-end net worth is bank + TFSA + RRSP and excludes debts; the mortgage balance is not modeled as an asset/liability or amortization. Thus the payment is a budget expense, not a mortgage principal/interest model. Treat this limitation as disclosed.

Goal view showed Retirement Reserve $600,000 by Dec 2032; projected metric $631,647, and explicitly warns that total portfolio is not money earmarked or available for the goal. Projection & analysis showed projected 2032 net worth $715,891 under current settings; not an established sustainable-income estimate. Current UI does not expose separate retirement years beyond individual stop-work years; CPP/OAS starts are 65 under these existing settings.

January 2026 was already closed and hidden. Did not attempt another closeout or add a new lesson. Existing January lesson remained visible and described mortgage payment/balance distinctions, Pat and Lee stop-work ages, and need to verify pension estimates and contribution room. It survived export/import and a subsequent profile reopen. No system clock modification.

Exported `2026-10-30T20-12-57-073Z-backup.json`. Preview identified Pat & Lee, 2026, four regular expenses, and one goal. Confirmed Import this plan. Year view preserved monthly expenses and one closed month; Lessons view preserved the January 2026 note. Reopened the persistent profile and verified Year and lesson still load. Browser errors empty.

Screenshots from this run are in `testers/ns-near-retirement/screenshots/`: `2026-10-30T20-11-57-952Z-current-start.png`, `2026-10-30T20-12-02-905Z-current-salary.png`, `2026-10-30T20-12-02-905Z-current-budget.png`, `2026-10-30T20-12-02-905Z-current-invest.png`, `2026-10-30T20-12-02-905Z-current-more.png`, `2026-10-30T20-12-51-795Z-current-goals-view.png`, `2026-10-30T20-12-51-795Z-current-analysis-view.png`, `2026-10-30T20-12-51-795Z-current-lessons-view.png`, `2026-10-30T20-13-02-086Z-current-import-preview.png`, `2026-10-30T20-13-02-086Z-current-after-import.png`, `2026-10-30T20-13-02-086Z-current-after-import-lesson.png`, and `2026-10-30T20-13-08-050Z-current-reload-check.png`. Some failed label-click attempts are in run-log.jsonl; these were harness command mismatches and were corrected.

Salary/month overrides, contribution room editing, live closeout workflow, and offline behavior were not tested in this audit. No application changes, git/gh, installations, issue filing, or other agents were used.

Fresh replacement audit, 2026-10-30 20:55-20:57 UTC

This section supersedes prior audit conclusions where they conflict. Prior logs, profiles, backups and screenshots were preserved. New file batches opened the existing profile/agent; no reset, new household, application fixes, build, installation, git, gh, filing or other agents. Final batch explicitly quit and run-log records end with consoleErrors:0.

Diagnosis: prior 20:54 attempts used submenu selectors from the Year page and timed out; their supposed analysis/lessons final captures were actually Year. This audit explicitly navigated More before each submenu and read actual page text. Earlier issues.md was a stale clean report, not evidence for this session. It has now been rewritten after current verification.

Setup was already complete; reviewed saved setup rather than pretending to complete seven new onboarding steps. Pat age 62, Lee 59, NS, base year 2026, employee incomes 78000 + 22000 = 100000. Saved Jan 1 split verified in the new exported JSON: cash 10000 each; TFSA 55000 each; RRSP Pat 250000, Lee 120000. Total 500000. No dependants. Reviewed and retained flat salary growth 0%, inflation 2%, investment return 4%, auto-invest 0% (keep surplus in bank). Pat and Lee individually stop at 65, in 2029 and 2032 respectively. Shared age does not mean the same calendar retirement year. Salary confirms One retired in 2029 and Retired in 2032. Both CPP/OAS start ages are 65. Public pension settings disclose full 40-year OAS residency assumption, salary-based CPP estimates and pensions entering only after stopping work; while-working payments require yearly income override. Actual pension entitlements and alternate claiming-age scenarios remain unverified.

Visited and captured Year, Salary, Budget, Invest, More, Goals, Projection & analysis, Lessons learned, Review setup, Starting balances and Public pensions. Existing budget retained: living 1750 + mortgage 950 + groceries 800 + transport 400 = 3900/month; 46800/year. No duplicate total expense added. Mortgage balance 64000 is outside the model; app explicitly says principal, interest and home equity are not calculated. This is a disclosed limitation, not an established defect. Monthly rounded take-home 6221 less 3900 = 2321. Annual take-home 74654 less 46800 = 27854; opening bank 20000 + 27854 = 47854. Investments 480000 at 4% become 499200, and bank plus investments = 547054. Rounded individual take-homes sum one dollar above the rounded household total; no tax defect inferred.

Re-saved 2026 employee salaries 78000 and 22000 through the yearly income editor. Tested February expense override 3900, read unchanged totals, then cleared it back to automatic budget inheritance. An uppercase FEBRUARY click had previously only failed to match DOM text; corrected to February, then used the actual Edit February button to open the editor. Initial labels containing a middle dot were damaged by PowerShell encoding; corrected with #grossA and #grossB selectors. These failed harness commands are retained in the log, not silently treated as passes.

Contribution-room fields were exercised using scoped #room-form selectors and the already saved estimates (Pat RRSP 14040, Lee RRSP 3960, TFSA 54000 each). Actual room was not supplied in the brief and these are not verified CRA amounts. A preceding zero-room attempt failed strict selector matching because the closed month editor retained duplicate input IDs; no zero values were applied. A subsequent harness note explicitly corrects that earlier note. Existing room values were re-saved successfully and screenshot captured. Automatic investment stayed 0%.

Goal remains Retirement reserve 600000 by December 2032, measured against total investments. Projected metric 631647 matches 144752 TFSA + 486895 RRSP in 2032. Funding not assessed and no money earmarked are explicitly shown. Projected 2032 income 44974 versus expenses 52704 implies a 7730 shortfall covered by bank under these assumptions. This is not an independently established sustainable-income recommendation; no external financial claims were checked.

January was already closed when first opened. Inspected its existing lesson instead of closing another month or claiming a new closeout. Lesson mentions mortgage 950 within 3900, separate debt balance 64000, retirement years and verifying pensions/room. It survived the new import and restart; January stayed hidden as one closed month. Live closeout creation was not repeated and system clock was untouched.

New export: downloads/2026-10-30T20-56-52-547Z-1-finance-plan-2026-10-30.json; retained deliverable copy: 2026-10-30T20-56-52-547Z-backup.json. Import preview read Pat & Lee, start 2026, four regular expenses and one goal before confirmation. After Import this plan, read budget, goal and lesson contents. Restarted browser and read Year closed count, lesson, household review and balances again. Browser errors [] throughout successful final batches.

Current evidence (relative to persona directory):
- screenshots/2026-10-30T20-55-12-197Z-current-year.png
- screenshots/2026-10-30T20-55-12-197Z-current-salary.png
- screenshots/2026-10-30T20-55-12-197Z-current-budget.png
- screenshots/2026-10-30T20-55-12-197Z-current-invest.png
- screenshots/2026-10-30T20-55-12-197Z-current-more.png
- screenshots/2026-10-30T20-55-19-700Z-current-review.png
- screenshots/2026-10-30T20-55-25-824Z-current-goals.png
- screenshots/2026-10-30T20-55-25-824Z-current-analysis.png
- screenshots/2026-10-30T20-55-25-824Z-current-lessons.png
- screenshots/2026-10-30T20-55-34-632Z-current-pensions.png
- screenshots/2026-10-30T20-55-40-575Z-current-balances.png
- screenshots/2026-10-30T20-56-51-185Z-current-room-saved.png
- screenshots/2026-10-30T20-56-58-975Z-current-import-preview.png
- screenshots/2026-10-30T20-56-58-975Z-current-import-lesson.png
- screenshots/2026-10-30T20-57-09-335Z-current-final-year.png
- screenshots/2026-10-30T20-57-09-335Z-current-final-lesson.png
- screenshots/2026-10-30T20-57-09-335Z-current-final-household.png

Final household screenshot visually inspected: review contents fit the phone capture and match read-back text. Offline/service-worker behaviour belongs to the e2e suite and was not tested. New onboarding, new closeout creation, changed pension timing, verified CRA room, tax-return accuracy, mortality/survivor scenarios, and independently assessed sustainable withdrawals remain untested.
