# Next Thyme Web App

Next Thyme is a local-first recipe box built with React, TypeScript, Vite, and Tailwind CSS. It opens with sample recipes on a fresh machine, then persists recipe data in the browser with `localStorage`.

## Features

- Mobile-first recipe browsing with a horizontal recipe carousel
- Desktop recipe sidebar for larger screens
- Detailed recipe pages with hero image, metadata, ingredients, directions, notes, nutrition, and storage
- Ingredient scaling by serving count
- Checkable ingredient list
- Copyable shopping list
- Printable recipe view
- Searchable recipe box
- Restore sample recipes action when saved browser data cannot be loaded
- First-load sample recipe seeding for empty browsers
- Local optimized recipe images with responsive `srcSet` loading
- Lighthouse audit script for performance, accessibility, best practices, and SEO checks

## Local Persistence

Recipes are saved in browser `localStorage` under this key:

```text
next-thyme-recipes
```

On first load, the app seeds sample recipes from:

```text
src/data/seedRecipes.ts
```

If saved data is missing, the app seeds sample recipes automatically. If saved data is invalid, the app recovers with the sample recipes and shows a "Restore samples" button so the visitor can confirm a clean reset. If a newer sample recipe is missing from otherwise valid saved data, the storage helper merges it in automatically.

## Getting Started

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Then open the local URL printed by Vite, usually:

```bash
http://localhost:5173
```

## Verification

Build the production bundle:

```bash
npm run build
```

Run the smoke test:

```bash
npm run test:setup
npm run test:smoke
```

Preview the production build:

```bash
npm run preview
```

Build for Hostinger at `https://lelandrangel.com/nextthyme`:

```bash
npm run build:hostinger
```

Upload the contents of `dist` into the `nextthyme` folder on the server. The build includes `dist/.htaccess`, which handles client-side routing fallback and cache headers for static assets.

Run a local Lighthouse audit:

```bash
npm run audit:lighthouse
```

The audit builds the production bundle, serves it locally, and writes:

```text
lighthouse-report.html
```

## Portfolio Notes

This project is designed to work on a fresh clone without preexisting browser storage. The bundled seed recipes make the first screen useful immediately, while `localStorage` keeps later changes local to the visitor's browser.

Dependency versions are pinned in `package.json` to avoid future `latest` version drift breaking a first-run demo.

Recipe images are served from `public/images/recipes` instead of remote hosts so a fresh portfolio demo is faster, more reliable, and less likely to shift layout while loading.
