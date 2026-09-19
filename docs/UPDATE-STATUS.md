# Update checkpoint, 19 September 2026

Paused to respect the user's five-hour usage reserve of approximately 10% remaining.

## Implemented locally

- Clickable task arrows and titles open a task walkthrough.
- Practical saved checklists for the 16 seeded weekly tasks; per-occurrence ticks and notes, editable custom steps.
- Configurable useful links, original approved logo, live clock/date/timezone.
- Optional Supabase account UI and cloud repository, schema and setup instructions. Not configured or live-tested. Local mode stays enabled.
- Nine automated model, migration, recurrence and repository tests passed; JavaScript syntax checks passed.

## GitHub

Update branch: `flow-v1-1-update` in `excederemanagementconsultancy/excedere-flow`.
Uploaded root files: index.html, update.css, README.md, package.json.
Uploaded src files: app.js, model.js, storage.js, task-guides.js, accounts.js, cloud-storage.js, config.js.
Uploaded assets/flow-approved.png. Verify final commit completed before continuing.
Still upload docs/ACCOUNTS.md, supabase/schema.sql, tests/guides.test.js and tests/cloud.test.js. The existing main branch and live Pages site are unchanged. No pull request created yet.

## Next session

1. Verify branch contents against local files and upload remaining setup/test files.
2. Browser-test desktop and mobile, task arrow/title popup, tick persistence after refresh, next-week isolation, notes, task editing, and existing data retention. Local HTTP serving is blocked by sandbox permissions; file navigation was denied by browser policy. Do not bypass either restriction. Find an approved preview route or perform controlled deployment with a rollback point.
3. Review account edge cases before enabling: password recovery events, signout during saves, migration/logout race, error-state retry, restore while no workspace is loaded. Current recovery-file restoration uses mutate which requires state and needs repair before release.
4. Connect the user's Supabase project when available, apply schema, configure email redirects and public keys, then run live security and auth acceptance checks from ACCOUNTS.md. Never publish secrets or represent account mode as tested before this.
5. Create/review the completed PR, publish, and test the live app. Preserve all browser work and export a backup first.

Browser upload works using the user's Chrome profile 4, tab 1731040260, through filechooser.setFiles with timeoutMs 15000. First upload was unusually slow; subsequent batches succeeded. Other Chrome profiles were previously the wrong user window.
