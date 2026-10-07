# Moving Next Thyme to MySQL on Hostinger

Status: phases 1 and 2 done on `claude/mysql-backend`; phase 3 next.

## Decisions

- **Only the owner writes; everyone else reads.** The public sees the owner's
  recipe box, read-only. Add, edit and delete appear only after logging in.
  There are no visitor accounts, no password resets, and no mail sent.
- **Visitors get a read-only box.** They get no private local sandbox on top of it.
- **Flutter app: decided later.** It uses local-only storage (Hive) today.
  The API returns plain JSON, so it could serve the app, but that would need
  token-based login alongside the cookie. Nothing here depends on that choice.

## Where it started

- `src/storage/recipeStorage.ts` kept the whole array in `localStorage`
  (`next-thyme-recipes`). `App.tsx` loaded it synchronously and wrote the
  whole array back on every change.
- The six seed recipes are compiled into the bundle. Their photos (696 KB)
  are in `public/images/recipes`, except the lasagna rolls, which hotlinks
  Food.com's CDN.
- Form uploads became WebP data URLs inside `localStorage`, so the ~5 MB
  quota ran out after a handful of photos.
- There was no delete. Deploys were a hand upload of `dist/`. The portfolio's
  deploy excludes `nextthyme/**`.

## Architecture

PHP + MySQL, the pattern `extraction-point/api/signup.php` and the portfolio's
`contact.php` already use on this account. Node on Hostinger would need its own
website entry and cannot sit under `/nextthyme/`.

- **Endpoints live in `public/api/`**, so Vite copies them into `dist/` and they
  deploy and are removed together with the build. A PHP file uploaded by hand
  is invisible to a sync.
- **The config lives above the web root:**
  `~/domains/lelandrangel.com/nextthyme-config.php`. That is the directory
  that contains `public_html`, **not `~`**. The endpoints find it by going three
  directories up from their own location. Locally the same rule lands on
  `Development/lelandrangel.com/nextthyme-config.php`, outside every repository,
  so dev and production resolve the config identically. The template is
  `config.example.php`.
- **It gets its own database and user** (`u334379448_nextthyme`), with no
  privileges on the portfolio or playtest databases.
- **The app connects to `localhost`.** Hostinger's `srvNNNN.hstgr.io` host is
  only for connections from outside Hostinger.

Schema: `db/migrations/001_recipes.sql`. Why it is shaped the way it is:
`db/README.md`.

- **The schema mixes columns and JSON.** Scalar fields are columns. Nested
  arrays and objects are JSON columns, because search is client-side and
  nothing queries inside them.
- **Optimistic concurrency.** `version` increments on every update, and a
  `PUT` that names a stale version gets a `409`.
- **Deletes are soft.** They set `deleted_at`, and clearing it undoes the delete.
- **Uploaded images are stored in the database,** in `recipe_images`, not on
  disk. A directory of uploads under `public_html` is one delete-enabled FTPS
  sync from being wiped. The server re-encodes every upload to WebP at 1200
  and 640 px and checks it with `finfo`. It never trusts the browser's file
  name or type.
- **Image paths are relative to the app's base,** so the same row works under
  `/nextthyme/` and under the dev server.

### API

| Method | Path | Auth |
|---|---|---|
| GET | `api/recipes.php`: all live recipes | none |
| POST | `api/recipes.php`: create | owner |
| PUT | `api/recipes.php?id=`: update; `409` on a stale `version` | owner |
| DELETE | `api/recipes.php?id=`: soft delete | owner |
| POST | `api/image.php`: upload, returns both URLs | owner |
| GET | `api/image.php?id=`: serves the bytes, long cache, ETag = sha256 | none |
| GET / POST / DELETE | `api/session.php`: whether you're logged in, log in, log out | – |

- **Cookie:** `HttpOnly; Secure; SameSite=Strict; Path=/nextthyme/`.
- **Writes:** every write checks `Origin` against `allowed_origins` and
  requires `Content-Type: application/json`, except the image upload, which is
  multipart but still checks `Origin`.
- **Login:** rate-limited per salted IP hash (`login_attempts`).
- **Caching:** API responses are sent as `Cache-Control: no-store`.

### Frontend

- `recipeStorage.ts` stays the only module that knows where recipes come from.
  The same boundary `playtest.ts` keeps in extraction-point. It becomes async.
- `App.tsx` gets loading and error states and saves one recipe at a time
  rather than rewriting the whole array.
- The edit UI renders only for a logged-in session. It gains a delete button.
- `VITE_RECIPES_API`:
  - **unset:** the current `localStorage` behaviour, so a fresh clone,
    `npm run dev` and the Playwright smoke test need no database.
  - **set:** the app uses the API. If the API is unreachable, it shows the
    bundled seeds read-only with a notice rather than a blank page.

## Phases

1. **Schema and local setup.**
   - [x] `db/migrations/001_recipes.sql`
   - [x] `scripts/generate-seed-sql.mjs`, which writes `db/seed/002_seed_recipes.sql`
   - [x] `config.example.php`, `db/README.md`
   - [x] local PHP 8.5 + MariaDB, a `php -S` dev server (`npm run api`), and a
     Vite proxy that sends `/api` to it. See "Local development" in `db/README.md`
2. **Reading from the database.** This phase can go live alone, because
   nothing can be written yet.
   - [x] `public/api/bootstrap.php`: config found and checked where it is loaded,
     PDO with real prepared statements, JSON responses with `no-store`, errors
     to the log and never into a body. Requested directly it is a 404.
   - [x] `public/api/recipes.php`: `GET` only; every other method is a 405
   - [x] `.htaccess`: `api/` passes straight through, and `bootstrap.php` returns a 404
   - [x] `recipeStorage.ts` reads the API when `VITE_RECIPES_API` is set
     (`npm run dev:api`), read-only, and falls back to the bundled samples
     with a notice when it cannot. Unset, it behaves exactly as before.
   - [x] Verified locally: the four existing smoke tests pass, a title changed in
     MariaDB shows on reload, stopping the API shows the fallback, and a
     missing config gives a bare 500 with the path in the log.
3. **Login and writing.** `session.php`, create/update/delete, the `409`
   handling in the form, and a delete button. The form's generated ids have
   an unbounded slug, so clamp them to fit `VARCHAR(128)`.
4. **Images.** `image.php`. The form uploads the file instead of building a
   data URL, and a saved recipe claims its upload rows.
5. **Bringing over the owner's recipes.** When logged in and the browser still
   has custom recipes the database lacks, a one-time "Import local recipes"
   button uploads them, data-URL images included. Nobody else's
   `localStorage` is worth migrating.
6. **Deploy and docs.**
   - `.github/workflows/deploy.yml`, modelled on extraction-point's: the real
     `domains/…` server path, each sync attempted twice, and a live check
     afterwards
   - an explicit `api/` rule in `.htaccess`
   - a `CLAUDE.md` for this repo

## Hostinger setup (owner's go-ahead needed for each)

1. Create the database and user (hPanel, or the Hostinger API).
2. phpMyAdmin: import `001_recipes.sql`, then `002_seed_recipes.sql`.
3. Copy `config.example.php` to `~/domains/lelandrangel.com/nextthyme-config.php`
   and fill it in. The owner generates the password hash and pastes it in by
   hand.
4. Build with `VITE_RECIPES_API=/nextthyme/api/recipes.php`, then deploy. The
   deploy workflow does not set it yet. Add it only after steps 1–3, or every
   visitor sees the fallback notice.
