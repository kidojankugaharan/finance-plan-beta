# Finance Plan Canada

A private, browser-based Canadian household budget and long-term projection app. No account, backend, analytics, or cloud sync. Your plan stays in your browser; JSON backups let you move it between devices.

This is a public beta for exploring assumptions, not a tax return or a guarantee of future outcomes. Use verified CRA contribution room before contributing to a TFSA or RRSP.

## Start a plan

Open the app and choose **Build my plan**. Setup covers your household, salary, expenses, January 1 balances, growth assumptions, retirement age, and public pensions. You can save an unfinished setup and resume it later.

- **Year:** monthly cash flow, balances, recurring extra income/expenses, payday schedules, tax refunds, and withdrawal plans.
- **Salary:** employment and estimated take-home income; per-year salary/growth overrides and retirement choices.
- **Budget:** expense categories, ownership, frequencies, dates, and Auto or by-year budgets.
- **Invest:** automatic contributions, verified or estimated contribution room, account priority, and return assumptions.
- **Goals:** portfolio milestones, account targets, and separate planned savings schedules. Dedicated goal savings do not reserve cash or check affordability.
- **Projection:** annual details, a net-worth chart, inflation-adjusted dollars, and CSV export.
- **More:** assumptions, pension settings, additional deductions, backups, recent changes with Revert, appearance, and help.

All money is CAD. Entry amounts round to whole dollars; calculations retain precision. Projections run from the chosen starting year through 2086. Shared retirement stops both salaries when the younger person reaches the selected age, unless a manual yearly choice keeps them working.

## Save, back up, and recover

The app distinguishes **Saved on device** from a downloaded backup. Export a JSON backup in More regularly and before clearing browser data. Backups contain your financial information; store them privately.

Import validates a Finance Plan Beta v1 backup and shows a preview before replacing anything. The five latest plan snapshots support Undo/Revert, including undoing an import. Corrupt saved data is preserved for recovery instead of being silently replaced. If storage is blocked or full, an error remains visible and you can still export the in-memory plan. A stale tab cannot overwrite a newer saved plan.

Backups from the separate private reference application are not imported automatically. This beta starts empty and contains no personal household data.

## Install and use offline

On the published HTTPS site, use your browser’s **Install app** command, or Safari’s **Share → Add to Home Screen**. Wait for **Ready offline** before disconnecting. The service worker caches only the app’s static files, not your plan. An update becomes active after older tabs close; reload after reopening to use it.

## Calculation scope

The Ontario model includes federal/provincial brackets, basic and age amounts, pension credits, CPP/CPP2, EI, health premium, surtax, RRSP refunds, and OAS recovery. Other provinces and territories have **simplified** provincial estimates (brackets, basic personal amounts, payroll credits, plus selected adjustments). Extra provincial senior, family, and low-income credits are not fully modelled. Quebec includes QPP payroll, EI, QPIP, the federal abatement and worker deduction; its Quebec Pension Plan (QPP) retirement benefit is approximated using the planner’s CPP calculation. QPP-specific benefit rules are not fully modelled, including deferral beyond age 70.

CPP depends on contribution history; the automatic estimate approximates past earnings from the starting salary. OAS assumes 40 years of Canadian residence after age 18. Public pension payments begin only after the shared retirement transition in this version. Employer pensions, GIS, child benefits, self-employment payroll, unregistered investments and fees are not modelled automatically. Enter known after-tax extra amounts in Year where appropriate.

See [calculation notes and official sources](docs/CALCULATIONS.md) for conventions and limitations. Future limits and returns are assumptions. The two synthetic Ontario household golden fixtures preserve all 122 reference projection rows exactly.

## Develop locally

Requires Node.js 24 and npm. Run from this project directory:

```sh
npm ci
npx playwright install chromium
npm run dev
```

On Windows PowerShell with script execution disabled, use `npm.cmd` / `npx.cmd`.

```sh
npm test
npm run test:e2e
npm run build
npm run preview
```

Vitest covers the engine, golden projections, persistence, validation and rendering. Playwright runs fresh setup, every tab, editing, backups, draft recovery and offline reload at phone and desktop sizes. Its server mounts the production build at `/finance-plan-beta/` to exercise GitHub Pages paths. Failed tests retain traces; successful smoke tests also save screenshots under `test-results/`. The same core assertions can run without installed packages using `node --test scripts/check-core.mjs`; that does not replace the required browser/build checks.

## Structure and hosting

`src/engine/` is independent of the DOM. `src/ui/` has one module per tab plus setup and shared controls. `src/state.js` owns browser persistence. Vite builds the static app into `dist/`; a build plugin generates a versioned offline cache from the actual output files.

CI tests pull requests. The Pages workflow tests and builds main, then deploys **only `dist/`**. Enable **Settings → Pages → Source: GitHub Actions** in the repository before the first deployment. This task does not publish anything locally. `reference/`, caches, local test results, environment files and keys are excluded from version control; the reference app is never bundled.
