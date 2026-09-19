# EXCEDERE | FLOW

Plan. Create. Grow.

Flow V1 is a deliberately simple business workspace. It opens on today’s work, then gives you a weekly schedule, ideas, projects and a few settings. It works for marketing, sales, finance, operations, clients, recruitment, admin, or any custom area you add.

## Run it locally

Open `index.html` through a local web server. For example, with Python installed:

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173` from this folder. No package installation or build step is required.

Run the model checks with Node 20 or newer:

```bash
npm test
```

## Publish on GitHub Pages

1. Create a new GitHub repository and copy the contents of this folder into its root.
2. Push the files to the default branch.
3. In GitHub, open **Settings → Pages**, choose **Deploy from a branch**, **main**, **/(root)** and save.
4. Wait for the Pages deployment to succeed, then refresh the site. Keep subfolders intact when uploading files.

The site is static and needs no server, database or account. Flow saves the current workspace in browser `localStorage`. Use **Settings → Export backup** before changing browsers or clearing browser data. The data model is versioned so a future authenticated, multi-workspace backend can replace the local repository without redesigning the screens.

## Source and branding

The supplied weekly plan, content ideas and growth projects are stored in `src/seed-data.js`. `docs/original-plan.md` keeps the recovered source conversation alongside the build. The approved original logo is now used from `assets/flow-approved.png`.

## Version 1.1 update

Task titles and arrows open a walkthrough with saved steps, working notes and useful links. Each weekly occurrence keeps its own ticks. Customise steps in Edit task and destination links in Settings. Google Business and Meta links open their managers; select Excedere after signing in. Add your exact X and Instagram links in Settings.

The header shows the live date, time and workspace timezone. Existing browser data and backup files remain compatible. Export a backup before publishing updates.

Secure accounts and cloud persistence are prepared but **not enabled** until a Supabase project is connected. Follow `docs/ACCOUNTS.md`, including the live acceptance checks. No service credentials are included. Default local mode continues to work without an account. In account mode, successful edits save to the server; other devices receive changes on opening or reloading. Concurrent saves are rejected rather than silently overwriting newer work.
