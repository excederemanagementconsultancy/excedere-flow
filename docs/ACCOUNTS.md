# Enable real accounts

Account support is prepared but is **not enabled** until a Supabase project is connected and the acceptance checks below pass. Local mode continues to work with the existing browser data. There is no pretend password lock.

1. Create a Supabase project in your own account. Keep your database password private.
2. Run `supabase/schema.sql` once in its SQL editor. It creates a per-user workspace table, row-level access policies, and a save function that detects competing device edits.
3. Enable email/password authentication and email confirmation. Configure your production email delivery before inviting other users. Set a minimum password length of 12 in the authentication settings.
4. Set Site URL and allowed redirect URL to `https://excederemanagementconsultancy.github.io/excedere-flow/`. Add your local development URL only when testing.
5. Put the project URL and **publishable key** (or legacy anon key) in `src/config.js`. These are public browser settings. Never use a service-role key, secret key, database password, or personal access token.
6. Publish the updated files. The app now opens with login, create-account and password-reset options. Login sessions are held in session storage. Workspaces are fetched from the server, not persisted as new local browser copies.

## Existing work

On the first login to an empty account, choose **Copy my browser work** while using the same browser and site address as your existing Flow workspace. It copies that data only after your explicit selection. Your existing local copy is retained for recovery. An existing account workspace is never automatically overwritten by local data. Export an extra backup before migration. After verifying the account on a second device, you can clear the old browser data yourself if needed.

## Sync behaviour

Each successful edit saves to your account. Another device receives it when Flow opens or reloads. Simultaneous changes produce a conflict message rather than silently overwriting newer work. Export any work you need before reloading after a conflict. This release does not merge simultaneous edits or provide offline cloud editing.

## Required acceptance checks before enabling for others

- Sign up and confirm email; log in and log out; reload after logout and check no private workspace is visible.
- Request a reset email, open the link, enter and confirm a new password, then log in.
- Migrate an existing browser workspace; confirm tasks, ticks, notes and history on a second device.
- With two test accounts, confirm neither can read or write the other's workspace through the database API. Anonymous requests must be rejected.
- Save competing edits from two devices and confirm the second gets a conflict with no overwrite.
- Disconnect the network while saving and confirm no success is reported and the editor remains available.

These live backend checks have not yet been performed because no Supabase project is connected. The JavaScript client is loaded only in account mode from the pinned `@supabase/supabase-js@2.57.4` package on esm.sh.

References: [Supabase password authentication](https://supabase.com/docs/guides/auth/passwords), [row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security).
