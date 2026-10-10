-- Adds 'Slow cooker' to the cooking methods.
--
-- The app only knew Oven, Stovetop and Microwave, and falls back to
-- "Stovetop" when a recipe names none, so a slow cooker recipe would have been
-- labelled with the wrong appliance. The list lives in src/types/recipe.ts
-- (COOKING_METHODS); this column must carry the same values.
--
-- Numbered 003 because 002 is the seed (db/seed/002_seed_recipes.sql). Apply
-- this BEFORE re-importing that seed: the seed now contains a slow cooker
-- recipe, and its row is refused while the ENUM lacks the value.
--
-- Widening an ENUM at the end of its list rewrites no existing row. Select
-- the Next Thyme database in phpMyAdmin first; there is no USE here.

ALTER TABLE recipes
  MODIFY cooking_method ENUM('Oven', 'Stovetop', 'Microwave', 'Slow cooker') NULL;
