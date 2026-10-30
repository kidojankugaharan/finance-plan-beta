# Issues

## [bug] Export backup does not produce a downloadable file
Dedupe-key: export-backup-download-timeout
Steps: 1. Open the persistent plan. 2. In More, run `{"op":"export"}`. 3. Wait for the harness download result.
Expected: A dated JSON backup downloads so the user can keep a copy and continue with import verification.
Actual: The harness timed out waiting for a browser download; no new backup file appeared. Existing older backups were present, but this session could not export a fresh one.
Screenshot: testers/pe-caregiver/screenshots/2026-10-30T16-31-51-803Z-assumptions.png
