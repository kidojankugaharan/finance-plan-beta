# 007 — Restore the original tracker format

## Goal
The beta has drifted into a generic web-app look (marketing hero headings, long explanatory paragraphs, stacked big buttons, plain text nav). The owner wants it to **look and be laid out like the original app**: `C:\Users\Kido\03-ventures\finance-plan-beta\reference\tracker.html` at phone width (390px). The original format was good; only usability needed tweaks. Keep the beta's code architecture, data model, features and usability fixes — change the presentation.

Reference screenshots (390px): `C:\Users\Kido\03-ventures\finance-plan-beta\.cache\compare\orig-*.png` (original) vs `beta-*.png` (current beta). Screenshot script: `.cache/compare/shot2.mjs` in the main folder.

## Scope
1. **Visual system** — port from tracker.html: `--font-display` / `--font-ui` / `--font-num` fonts (same Google Fonts), colour tokens, magenta-glow bordered panels, stat cards, chips/badges (CURRENT, AUTO), `(i)` info buttons, inputs, sub-tab pills.
2. **Bottom nav** — same as original: icons + labels, order Budget · Salary · **Year (raised round centre button)** · Invest · More. Year stays the default tab.
3. **Page headers** — big display-font title per tab (YEAR, BUDGET, SALARY, INVEST, MORE) as in the original. Remove the marketing eyebrow / headline / subtitle copy on tabs ("Your year, in focus.", "Make room for what matters", etc.) and the app-bar block that pushes content down; keep "Local only / offline" status as a small chip at most.
4. **Year tab** — match original: year switcher (◀ 2026 ▾ CURRENT (i) ▶); Net worth year-end card with change this year and savings-rate gauge; Net bank projection + Total investment portfolio cards; Monthly cash flow card with Payday button, bank balance input and one row per month (income, expense, net, chevron; closed-month lock state from task 002). Beta warnings (shortfall, "close February") become compact one-line banners, not big cards. Extra income/expense, opening balances, payday schedule = small buttons or row actions like the original, not a stack of large buttons.
5. **Budget tab** — match original: Detailed budget / Split by category sub-tabs; summary card (Budget 2026 · AUTO (i) +, Per month / Per year, category filter, sort, clear); expense rows like the original. Long notes (e.g. the debt-payments paragraph) move behind `(i)` info buttons.
6. **Salary, Invest, More, setup/welcome, modals** — same treatment: match the original's equivalent screens' layout and styling; More keeps beta items (Goals, Projection & analysis, Lessons learned, backup import/export).
7. **Rule of thumb**: where the beta adds explanation text, prefer the original's pattern — short label + `(i)` popover.

## Must keep
- All beta features and logic (month close-out + lessons, goals, projection, import/export, setup, validations).
- Phone-only layout at every width (task 006), no horizontal scroll at 360px, 44px tap targets, accessible labels.
- Do not copy any personal data or the owner's numbers from reference/; reference/ stays uncommitted.

## Acceptance
- Side-by-side screenshots at 390px of Year, Budget, Salary, Invest, More (original vs beta with a tester backup loaded, e.g. `testers/bc-single-parent/*backup.json`) saved to `.cache/compare/after-*.png`; they read as the same app.
- Add one line to REQUIREMENTS.md: "Visual format and screen layout follow reference/tracker.html; changes are usability tweaks only."
- `npm.cmd test`, `npm.cmd run test:e2e` (update selectors/tests as needed, keep coverage), `npm.cmd run build` all pass.
- Work only in this worktree. No git commands. Append report (15 lines max) under "## Codex report".

## Codex report
- Restored Synthwave fonts, palette, glowing panels, stat cards, badges, info popovers, inputs and sub-tabs.
- Replaced the app bar and marketing headings with slim display-font page titles and a local/offline status chip.
- Restored icon navigation: Budget · Salary · raised Year · Invest · More; Year remains the default.
- Year now has a year switcher, wealth/savings summary, bank/portfolio cards, editable opening bank balance and compact monthly rows.
- Preserved month close-out, lessons, extras, payday schedules, withdrawals and annual totals; explanations are compact or behind info controls.
- Budget adds working detail/category tabs, category filtering, sorting and clear; Salary/Invest restore compact year tables and grouped future years.
- Styled More, setup and editors consistently; retained goals, analysis, validation, backup import/export and offline flows.
- Added the required visual-format statement to REQUIREMENTS.md; calculation engine and storage model are unchanged.
- Passed: npm.cmd test (94 tests), npm.cmd run test:e2e (28 tests), npm.cmd run build.
- Browser coverage includes 360px overflow, centered wide-screen phone layout, new controls, persistence and existing financial workflows.
- Saved all five 390px views and original/beta side-by-side comparisons to .cache/compare/after-*.png using the BC tester backup.
- All writes stayed in this worktree; reference was read-only; no git commands or personal reference data copied.
