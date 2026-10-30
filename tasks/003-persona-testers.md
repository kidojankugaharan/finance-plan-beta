```queue
project: C+D
tool: codex
tier: standard
status: queued
after: 002-month-closeout-lessons.md
interval: none
last_run: never
review: now
paid: no
```

# 003: 10 persona tester agents

Tier: Standard (gpt-6.1-sol, medium) for the harness; each persona run = one Light Codex job
Project folder: C:\Users\Kido\03-ventures\finance-plan-beta (stay inside it)

## Goal
10 agents act as different Canadian households, use the app in a local headless browser, and log issues.

## Scope
- In:
  - `testers/personas.json`: 10 distinct personas (province, ages, single/couple, kids, income type incl. self-employed/pension/part-time, debt, goals, tech comfort). Cover QC, AB, BC, ON, Atlantic, and at least one near-retirement and one student.
  - `testers/<persona-id>/`: persona brief, run log, screenshots, exported backup JSON, `issues.md`.
  - `scripts/tester-run.mjs`: builds and serves `dist/`, opens Playwright (phone viewport) with a persistent profile per persona, and exposes simple commands an agent can drive (goto, click by text/label, fill, screenshot, read page text, console errors).
  - `testers/PROMPT.md`: instructions for a persona agent: complete setup as that person, use every tab, close a past month, export/import, try their own goals; log issues as `bug | confusing | wrong-number | idea` with steps, expected, actual, screenshot.
  - `scripts/file-issues.mjs`: dedupes `testers/*/issues.md` and creates GitHub issues (`gh issue create`, labels `tester`, type, persona). Dry-run by default; `--file` to create.
- Out: fixing the issues found (task 004).

## Acceptance checklist
- [ ] One persona run end-to-end produces log, screenshots, issues.md
- [ ] file-issues dry-run lists deduped issues
- [ ] `npm test`, `npm run test:e2e`, `npm run build` still pass

## Rules
- Ask before: deleting files, working outside the project folder, paid/credit tools. No git commands (Claude handles git).
- Append your report below; 15 lines max.

## Codex report

## Opus review
