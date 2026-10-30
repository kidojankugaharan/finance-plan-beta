```queue
project: C+D
tool: codex
tier: standard
status: queued
after: 001-build-v1.md
interval: none
last_run: never
review: now
paid: no
```

# 002: Month close-out + Lessons learned

Tier: Standard (gpt-6.1-sol, medium)
Project folder: C:\Users\Kido\03-ventures\finance-plan-beta (stay inside it)

## Goal
Checking off a month (Year-by-Year "Month completed", reference/tracker.html ~line 16223) becomes a close-out with a reflection, and the month leaves the view.

## Scope
- In:
  - Check-off opens a popup: "Notes / lessons learned — any takeaways for future budgeting?" (optional text, Save / Skip / Cancel). Cancel = month not closed.
  - Saved notes go to a new **More → Lessons learned** page: list newest first (month, date, note), editable/deletable.
  - Closed months are hidden from Year-by-Year and budget month views. Their data stays stored and still counts in projections/totals.
  - Future months and the current month cannot be checked off: control disabled, tap shows "You can close this month after it ends."
  - Ended months not yet closed get a reminder (banner/badge) until closed.
  - Included in JSON export/import.
- Out: undo UI for closed months (data kept, so it can be added later).

## Acceptance checklist
- [ ] Unit + Playwright tests for: popup flow, note saved to Lessons learned, closed month hidden, future/current month blocked, reminder shown for ended open months, export/import round-trip
- [ ] `npm test`, `npm run test:e2e`, `npm run build` pass
- [ ] Branch `month-closeout` → PR (auto-merge on green CI)

## Rules
- Ask before: deleting files, working outside the project folder, paid/credit tools.
- Append your report below; 15 lines max.

## Codex report

## Opus review
