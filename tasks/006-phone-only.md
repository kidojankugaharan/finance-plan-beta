# 006: Phone-only layout

Tier: Standard (gpt-6.1-sol, medium)
Project folder: C:\Users\Kido\03-ventures\finance-plan-beta\.cache\phone-only (git worktree, branch `phone-only`; stay inside it)

## Goal
Owner decision 2026-10-30: the app is phone-only. On any screen width (including desktop browsers) it must look and behave exactly like the phone version: one centered phone-width column, phone header, bottom tab bar. No desktop layout.

## Scope
- In:
  - `src/ui/base.css` / `src/style.css` / `index.html`: remove the desktop layout (`min-width:1000px` rules, top nav, `.desktop-tab`). The phone rules (now under `max-width:760px` / `430px`) become the base styles. App column max-width ~430px, centered; outside the column a plain theme background. Bottom nav fixed and limited to the column width.
  - Navigation: every page must be reachable on phone. Fixes #44: Goals and Projection & analysis are plain text in More > Explore and their tabs are desktop-only. Make them real buttons in More (or bottom tabs if they fit; max 5 bottom tabs).
  - Charts, tables, dialogs fit the column with no horizontal page scroll (tables may scroll inside their own box).
  - `REQUIREMENTS.md`: add one line "Phone-only layout at every screen width (owner 2026-10-30)".
  - Playwright: run every e2e on phone; replace desktop-project tests with a "wide screen still shows the phone layout" test (1440px viewport: column width <= 430px, bottom nav visible, Goals and Projection reachable).
- Out: new features, theme/colour changes, calc engine.

## Acceptance checklist
- [x] At 1440px and 390px the app looks the same (phone column, bottom nav)
- [x] Goals and Projection reachable from phone nav (regression test)
- [x] No horizontal page scroll at 360px on any tab
- [x] `npm test`, `npm run test:e2e`, `npm run build` pass

## Rules
- Ask before: deleting files, working outside the project folder, paid/credit tools. No git commands (Claude handles git); node_modules is a linked folder, no installs.
- Use `npm.cmd`. Append your report below; 15 lines max.

## Codex report

- Implemented a centered column capped at 430px with phone styles at every viewport width.
- Removed the desktop top navigation and desktop-only tab classes; five fixed bottom tabs remain.
- More > Explore now has real Goals and Projection & analysis buttons; More stays active on those pages.
- Constrained dialogs and notices to the phone column; tables scroll inside their own boxes.
- Added the owner-approved phone-only requirement to REQUIREMENTS.md.
- Playwright now uses only the phone project, with an explicit 1440px phone-layout regression test.
- Added 360px checks for all pages, chart/table containment, and representative editors.
- Visually reviewed wide-screen and 360px projection screenshots.
- Validation: npm.cmd test (90 passed), npm.cmd run test:e2e (24 passed), npm.cmd run build passed.
- All work stayed inside this folder; no git commands or installs.
