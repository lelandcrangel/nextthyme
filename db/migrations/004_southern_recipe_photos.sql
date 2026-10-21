-- Gives the four Southern recipes their photos.
--
-- The seed (db/seed/002_seed_recipes.sql) now carries these values, but it
-- never touches a row that already exists, and these four were imported
-- before they had photos. So a database seeded earlier needs this once.
-- A database seeded fresh from the current seed does not: every statement
-- here is a no-op there, because of the last line of each WHERE.
--
-- `image_url IS NULL` also means a photo the owner has since set by hand is
-- never replaced. `version` moves on, so a form left open on one of these
-- recipes is refused rather than saving the old image fields back.
--
-- The files themselves are in public/images/recipes and arrive with a deploy.
-- Run the deploy first, or the page asks for images that are not there yet.
-- Select the Next Thyme database in phpMyAdmin first; there is no USE here.

SET NAMES utf8mb4;

UPDATE recipes
   SET image_url = 'images/recipes/chicken-rice-casserole-1200.webp',
       image_small_url = 'images/recipes/chicken-rice-casserole-640.webp',
       image_alt = 'Cheesy baked chicken casserole with a golden, bubbly top in a glass baking dish',
       image_credit = 'Photo by David Kessler, CC BY-SA 2.0 (cropped)',
       image_credit_url = 'https://www.flickr.com/photos/31474531@N00/5439411637/',
       version = version + 1,
       updated_at = UTC_TIMESTAMP()
 WHERE id = 'chicken-rice-casserole'
   AND image_url IS NULL;

UPDATE recipes
   SET image_url = 'images/recipes/creamy-smoked-sausage-tortellini-1200.webp',
       image_small_url = 'images/recipes/creamy-smoked-sausage-tortellini-640.webp',
       image_alt = 'Tortellini in cream sauce in a dark bowl',
       image_credit = 'Photo by Pietro Luca Cassarino, CC BY-SA 4.0 (cropped)',
       image_credit_url = 'https://commons.wikimedia.org/wiki/File:Tortellini_con_la_panna.jpg',
       version = version + 1,
       updated_at = UTC_TIMESTAMP()
 WHERE id = 'creamy-smoked-sausage-tortellini'
   AND image_url IS NULL;

UPDATE recipes
   SET image_url = 'images/recipes/slow-cooker-pot-roast-1200.webp',
       image_small_url = 'images/recipes/slow-cooker-pot-roast-640.webp',
       image_alt = 'Shredded pot roast with carrots and potatoes in a dark roasting pot, with two serving utensils',
       image_credit = 'Photo by Melissa Doroquez, CC BY-SA 2.0 (cropped)',
       image_credit_url = 'https://www.flickr.com/photos/62967061@N00/2775536839/',
       version = version + 1,
       updated_at = UTC_TIMESTAMP()
 WHERE id = 'slow-cooker-pot-roast'
   AND image_url IS NULL;

UPDATE recipes
   SET image_url = 'images/recipes/meatloaf-mashed-potatoes-green-beans-1200.webp',
       image_small_url = 'images/recipes/meatloaf-mashed-potatoes-green-beans-640.webp',
       image_alt = 'Plate of tomato-glazed meatloaf slices, mashed potatoes topped with tomato sauce, and green beans',
       image_credit = 'Photo by F Delventhal, CC BY 2.0 (cropped)',
       image_credit_url = 'https://www.flickr.com/photos/13194817@N00/52547979633/',
       version = version + 1,
       updated_at = UTC_TIMESTAMP()
 WHERE id = 'meatloaf-mashed-potatoes-green-beans'
   AND image_url IS NULL;
