# Issues

## [bug] Assumptions choice has no associated accessible label
Dedupe-key: assumptions-choice-missing-accessible-label
Steps: 1. Open the saved plan, which resumes at setup step 5 of 7. 2. Inspect the “Choose an assumption” control. 3. Try selecting “Not sure — use 0% provisionally” by the visible label.
Expected: The select control is programmatically associated with its visible label so it can be identified and operated by label.
Actual: The harness could not find a control labelled “Choose an assumption”; the displayed text comes from the placeholder option, and clicking the option itself times out because the option is not visible. Setup could not advance through this flow in this session. Later app areas and the requested household journey remain untested.
Screenshot: testers/qc-self-employed-family/screenshots/2026-10-30T14-53-55-518Z-setup-assumptions.png
