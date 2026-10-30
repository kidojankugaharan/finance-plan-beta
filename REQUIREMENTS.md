# Finance Plan Beta — Requirements (agreed 2026-10-29)

## Product
- Public beta of the household finance/projection app. Personal app (`~/03-ventures/Finance-Plan`, private) stays separate.
- **Canada only**: TFSA/RRSP, CPP/OAS, federal + provincial tax.
- v1 = feature parity with the personal app (setup, salary, budget, invest, goals, projection, More), minus Google Drive sync and any personal data/keys.
- Apply the beginner-UX plan in `reference/UX-REVIEW-2026-10-26.md` where it fits.

- Phone-only layout at every screen width (owner 2026-10-30)

## Platform & data
- Web app / PWA, hosted on GitHub Pages from the public repo `finance-plan-beta`.
- No accounts, no backend. Data saved in the browser (localStorage/IndexedDB) + JSON export/import.

## Code
- Clean modular rebuild; `reference/tracker.html` is reference only (gitignored, never published).
- Split files (UI per tab, calc engine separate from UI). Calc engine unit-tested; projection golden fixture from reference must match.
- Phone-first layout, Synthwave theme like the reference.

## Auto-development loop
1. Build v1 until release-ready (all tabs work, tests green).
2. **10 Codex tester agents**, each a different Canadian household persona, use the app locally in a headless browser (Playwright). Their data/logs live in `testers/<persona>/`.
3. Each tester files GitHub issues for problems found (bug, confusion, wrong number).
4. An agent fixes each issue on a branch → PR → CI tests → **auto-merge if green**.
5. Testers rerun; repeat until a full round finds no new issues. Then continue iterative improvement from the backlog.

## Out of scope (v1)
- US/other countries, Android/iOS store builds, cloud sync, real-user analytics.
