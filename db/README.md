# Next Thyme database

MySQL behind the recipe box. Visitors read; only the owner writes. The plan and
the reasoning behind it are in `docs/db-plan.md`.

## Which database

`u334379448_recipies` on lelandrangel.com (spelled as Hostinger has it; it was
created that way on 2026-09-22), with its own user, `u334379448_recipies`.
It is **separate from the portfolio's, the contact form's and the playtest's
databases**. It holds no personal data (recipes, uploaded photos, and salted
hashes of login attempts), but it is the first database on the account that
the public can cause writes to, via the login endpoint. So it gets its own
credentials.

**The user has every privilege on this database, including DROP.** That is
how Hostinger's shared hosting creates database users; there is no way to
narrow it from hPanel, and every other database on the account is the same.
The boundary that holds is the database itself: this user cannot reach the
other three. The endpoints only ever SELECT, INSERT and UPDATE recipes, and
DELETE only from `login_attempts`. Locally, the dev user is given just those
four grants, so a query that needs more fails in development first.

## Applying it

There is no migration runner. Apply through phpMyAdmin:

> hPanel → Databases → phpMyAdmin → **select `u334379448_recipies` first** →
> Import → each file below, in order → Go

1. `db/migrations/001_recipes.sql`: the tables
2. `db/seed/002_seed_recipes.sql`: the six sample recipes

The files contain no `CREATE DATABASE` and no `USE`, so they load into whatever
database is selected. Selecting it first is the step that is easy to skip.

Migrations are append-only once applied. Add a new numbered file rather than
editing one that has run.

The seed file is **generated** from `src/data/seedRecipes.ts` by
`npm run db:seed-sql`, and `npm run db:seed-sql:check` fails if it is stale.
Re-importing it is safe: an id that already exists is left untouched, so it
never overwrites a recipe edited since.

## What is in it

**`recipes`**: one row per recipe. Scalar fields are columns; the nested parts
of `Recipe` (ingredients, directions, tags, equipment, tips, nutrition,
similar ids) are JSON columns, because search happens in the browser and
nothing queries inside them. `version` increments on every update and an edit
naming a stale version is refused. `deleted_at` hides a recipe; clearing it
brings the recipe back.

Image paths are stored **relative to the app's base** (`images/recipes/…`,
`api/image.php?id=…`) so a row works under `/nextthyme/` and under the dev
server alike. `NULL` means no image; the app draws its placeholder.

**`recipe_images`**: uploaded photos as bytes, re-encoded to WebP at 1200 and
640 px. In the database rather than on disk because a directory of uploads
under `public_html` is one delete-enabled FTPS sync from being wiped. The seed
recipes' photos are not here; they are static files deployed with the build.

**`login_attempts`**: salted IP hash, success flag, timestamp. For rate
limiting the owner login and nothing else. Safe to truncate at any time.

## Handy statements

Undo a delete:

```sql
UPDATE recipes SET deleted_at = NULL WHERE id = 'pot-roast';
```

Prune old login attempts:

```sql
DELETE FROM login_attempts WHERE created_at < UTC_TIMESTAMP() - INTERVAL 7 DAY;
```

Find uploads no recipe uses any more:

```sql
SELECT id, width, LENGTH(bytes) AS size, created_at
FROM recipe_images WHERE recipe_id IS NULL;
```

## Local development

Homebrew PHP and MariaDB, no Docker:

```bash
brew install php mariadb
brew services run mariadb        # this session only; `start` also starts at login
```

Create the database and a user. Locally the user gets only the four
privileges the endpoints use. That is narrower than production, where
Hostinger grants every privilege (see "Which database"); it is deliberate, so
a query that needs more fails here first. `mariadb` as your macOS user
connects as an administrator through the socket:

```sql
CREATE DATABASE nextthyme_dev CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'nextthyme'@'127.0.0.1' IDENTIFIED BY '<generated>';
GRANT SELECT, INSERT, UPDATE, DELETE ON nextthyme_dev.* TO 'nextthyme'@'127.0.0.1';
```

Load the schema and seed:

```bash
mariadb nextthyme_dev < db/migrations/001_recipes.sql
mariadb nextthyme_dev < db/seed/002_seed_recipes.sql
```

The config goes where the endpoints look for it: three directories above
`public/api`, which from this repo is `../nextthyme-config.php` (i.e.
`Development/lelandrangel.com/nextthyme-config.php`). It is outside every
repository. Copy `config.example.php` there, point `db` at `127.0.0.1` /
`nextthyme_dev`, and set `allowed_origins` to `http://localhost:5173`.

Then run the two servers side by side:

```bash
npm run api       # php -S 127.0.0.1:8080 -t public
npm run dev:api   # Vite on :5173 reading the database through /api
```

Plain `npm run dev` still reads localStorage and needs neither server.

Resetting is a drop and re-import:

```bash
mariadb -e "DROP DATABASE nextthyme_dev; CREATE DATABASE nextthyme_dev CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```
