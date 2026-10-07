-- Next Thyme recipe box: the first schema.
--
-- See docs/db-plan.md. Visitors read; only the owner writes, through a session
-- established against a password hash that lives in the server config, not
-- here. So there is no users table — there is exactly one writer.
--
-- Deliberately contains no CREATE DATABASE and no USE, matching the other
-- projects on this account: in phpMyAdmin you select the database first and
-- then Import, and Hostinger names the database for you.
--
-- Written for MariaDB 10.x and MySQL 8 alike. JSON is an alias for LONGTEXT
-- on MariaDB, so each JSON column carries its own JSON_VALID check rather than
-- relying on the type to enforce it.

CREATE TABLE recipes (
  -- The string ids the app already uses: `pot-roast` for the seeds,
  -- `custom-<slug>-<8 hex>` for recipes made in the form. Kept rather than
  -- replaced with an integer so links and similar_recipe_ids stay valid.
  id                 VARCHAR(128) NOT NULL,
  title              VARCHAR(200) NOT NULL,
  description        TEXT         NOT NULL,
  category           VARCHAR(80)  NOT NULL,
  cuisine            VARCHAR(80)  NOT NULL,
  difficulty         VARCHAR(40)  NOT NULL,
  -- Paths relative to the app's base (`images/recipes/pot-roast-1200.webp`,
  -- `api/image.php?id=…`), so the same row works under /nextthyme/ and under
  -- the dev server's /. NULL means "no image"; the app draws its placeholder.
  -- Never a data: URL — images live in recipe_images, not in this row.
  image_url          VARCHAR(512) NULL,
  image_small_url    VARCHAR(512) NULL,
  image_alt          VARCHAR(300) NOT NULL DEFAULT '',
  image_credit       VARCHAR(300) NOT NULL DEFAULT '',
  image_credit_url   VARCHAR(512) NOT NULL DEFAULT '',
  history            TEXT         NOT NULL,
  servings           SMALLINT UNSIGNED NOT NULL,
  yield_label        VARCHAR(120) NOT NULL DEFAULT '',
  prep_time_minutes  SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  cook_time_minutes  SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  total_time_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  cooking_method     ENUM('Oven', 'Stovetop', 'Microwave') NULL,
  oven_temp_f        SMALLINT UNSIGNED NULL,
  -- The nested parts of `Recipe`. Search happens in the browser over the
  -- whole list, so nothing queries inside these; splitting them into tables
  -- would buy joins and nothing else.
  tags               JSON NOT NULL CHECK (JSON_VALID(tags)),
  equipment          JSON NOT NULL CHECK (JSON_VALID(equipment)),
  ingredients        JSON NOT NULL CHECK (JSON_VALID(ingredients)),
  directions         JSON NOT NULL CHECK (JSON_VALID(directions)),
  tips               JSON NOT NULL CHECK (JSON_VALID(tips)),
  nutrition          JSON NOT NULL CHECK (JSON_VALID(nutrition)),
  similar_recipe_ids JSON NOT NULL CHECK (JSON_VALID(similar_recipe_ids)),
  next_time_notes    TEXT         NOT NULL,
  leftover_storage   TEXT         NOT NULL,
  -- Optimistic concurrency: an update names the version it was editing and
  -- is refused if the row has moved on, so a stale tab cannot silently
  -- overwrite a newer edit.
  version            INT UNSIGNED NOT NULL DEFAULT 1,
  -- Display order in the list; the seeds keep the order they have today.
  sort_order         INT          NOT NULL DEFAULT 0,
  created_at         DATETIME     NOT NULL,
  updated_at         DATETIME     NOT NULL,
  -- Delete hides; it does not destroy. Undo is setting this back to NULL.
  deleted_at         DATETIME     NULL,
  PRIMARY KEY (id),
  KEY idx_recipes_live (deleted_at, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Uploaded images, as bytes in the database rather than files on disk.
--
-- A directory of uploads anywhere under public_html is one FTPS sync with
-- delete enabled away from being wiped — the failure this account keeps
-- having. In here they are deploy-proof and ride along with the database
-- backup. The endpoint re-encodes every upload to WebP server-side at two
-- widths, matching imageUrl / imageSmallUrl, so a row is ~50–200 KB.
--
-- The seed recipes' photos are NOT in here: they are static files under
-- public/images/recipes, committed and deployed with the build.
CREATE TABLE recipe_images (
  id          CHAR(32)     NOT NULL,          -- random hex, used in the URL
  -- NULL while an upload belongs to a recipe that has not been saved yet.
  recipe_id   VARCHAR(128) NULL,
  width       SMALLINT UNSIGNED NOT NULL,     -- 1200 or 640
  mime        VARCHAR(40)  NOT NULL,          -- image/webp
  sha256      CHAR(64)     NOT NULL,          -- doubles as the ETag
  bytes       MEDIUMBLOB   NOT NULL,          -- 16 MB ceiling; WebP is far under
  created_at  DATETIME     NOT NULL,
  PRIMARY KEY (id),
  KEY idx_recipe_images_recipe (recipe_id),
  CONSTRAINT fk_recipe_images_recipe
    FOREIGN KEY (recipe_id) REFERENCES recipes (id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Login attempts, for rate limiting the one password this site has. Same
-- shape as the playtest endpoint's attempts table: a salted hash of the
-- address, never the address, and no person in it — truncate whenever.
CREATE TABLE login_attempts (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  ip_hash     CHAR(64)     NOT NULL,
  succeeded   TINYINT(1)   NOT NULL,
  created_at  DATETIME     NOT NULL,
  PRIMARY KEY (id),
  KEY idx_login_attempts_ip (ip_hash, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
