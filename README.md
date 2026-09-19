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
3. In GitHub, open **Settings → Pages**, choose **GitHub Actions** as the source, and save.
4. GitHub will publish the site using `.github/workflows/pages.yml`.

The site is static and needs no server, database or account. Flow saves the current workspace in browser `localStorage`. Use **Settings → Export backup** before changing browsers or clearing browser data. The data model is versioned so a future authenticated, multi-workspace backend can replace the local repository without redesigning the screens.

## Source and branding

The supplied weekly plan, content ideas and growth projects are stored in `src/seed-data.js`. `docs/original-plan.md` keeps the recovered source conversation alongside the build. The accessible reference image was the circular Excedere parent mark; the Flow square mark in `assets/flow-mark.svg` follows the approved navy, cyan and electric-blue family identity.
