```queue
project: C+D
tool: codex
tier: heavy
status: queued
interval: none
last_run: never
review: now
paid: no
```

# 001: Build v1 (release-ready PWA)

Tier: Heavy (gpt-6-astra, high)
Project folder: C:\Users\Kido\03-ventures\finance-plan-beta (stay inside it)

## Goal
Clean modular rebuild of `reference/tracker.html` as a public PWA, per `REQUIREMENTS.md`.

## Scope
- In: Vite (vanilla JS or Preact) app in `src/`; calc engine (`src/engine/`: tax, CPP/OAS, TFSA/RRSP, budget, projection, drawdown) separate from UI; all tabs + setup flow from the reference; localStorage persistence + JSON export/import; PWA manifest + service worker; Synthwave phone-first theme; Vitest unit tests porting reference engine tests + golden projection fixture; Playwright smoke test (setup → every tab); GitHub Actions: CI (test+build on PR) and deploy `dist/` to GitHub Pages on main; README for public users.
- Apply the UX-REVIEW fixes where they fit naturally.
- Out: Google Drive sync, Capacitor/Android, any personal data/keys, anything in `reference/` getting committed.

## Acceptance checklist
- [ ] `npm test` (unit) and `npm run test:e2e` (Playwright) pass
- [ ] `npm run build` succeeds; app works offline after first load
- [ ] Golden projection fixture matches reference numbers
- [ ] Fresh user can complete setup and see every tab with no console errors
- [ ] Work committed on branch `v1-build` (noreply identity per CLAUDE.md); do not push

## Rules
- Ask before: deleting files, working outside the project folder, paid/credit tools.
- Append your report below; 15 lines max.

## Codex report

## Opus review
Codex hit usage limits twice before writing a report (logged in CODEX-LOG). Final state verified by Opus 2026-10-30:
npm test 30/30, npm run test:e2e 16/16 (phone+desktop), npm run build OK (148 kB JS). CI + Pages workflows present. No personal data found.

## Opus review
Pass. Engine is thorough; UI modules are dense one-line templates (refactor candidate if testers hit UI bugs). Committed to v1-build, PR to main.
