# Issues

## [confusing] Assumption choice cannot be selected by its visible prompt
Dedupe-key: assumption-choice-select-missing-accessible-label-confusing
Steps: 1. Start a new plan and complete setup steps 1–4. 2. On Assumptions, try to choose “Same pay” or select a choice using the visible “Choose an assumption” prompt. 3. Observe that the harness cannot find a select labelled by that prompt, while clicking “Same pay” resolves to a hidden option and times out.
Expected: The assumption control should be selectable through its visible prompt so a household can continue setup.
Actual: Setup remains on step 5 with “Choose how your pay should change.” The visible prompt is not associated with the select in a way the harness can use; the listed choice is a hidden `<option>`. Later setup and features could not be reviewed.
Screenshot: testers/ns-near-retirement/screenshots/2026-10-30T14-55-22-341Z-setup-assumptions-blocked.png
