import { expect, test, type Page } from 'playwright/test';
import { readFileSync } from 'node:fs';

// What public/api/recipes.php actually returns for the seeded database,
// captured from the endpoint (REQUEST_METHOD=GET php public/api/recipes.php)
// rather than written by hand, so the client is tested against the real shape.
const fixture = JSON.parse(readFileSync(new URL('./fixtures/api-recipes.json', import.meta.url), 'utf8')) as {
  recipes: Array<Record<string, unknown>>;
};

const FALLBACK_NOTICE = /could not be reached/i;

function answerRecipes(page: Page, respond: { status?: number; body?: unknown }) {
  return page.route('**/api/recipes.php', (route) =>
    route.fulfill({
      status: respond.status ?? 200,
      contentType: 'application/json',
      body: JSON.stringify(respond.body ?? {}),
    }),
  );
}

function copyOfFixture() {
  return structuredClone(fixture);
}

test('reads the recipe box from the API, read-only', async ({ page }) => {
  const body = copyOfFixture();
  body.recipes[0].title = 'Pot Roast, as the server has it';
  await answerRecipes(page, { body });
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Pot Roast, as the server has it' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Easy Lasagna Rolls/i })).toBeVisible();
  await expect(page.getByText(FALLBACK_NOTICE)).toBeHidden();

  // Non-ASCII survives the trip. The fixture once carried "275Â°F": the seed
  // had been imported through a latin1 client and PDO read the damage back.
  await expect(page.getByText(/Heat the oven to 275°F\./)).toBeVisible();
  await expect(page.getByText(/Â/)).toHaveCount(0);

  // A visitor cannot change anything.
  await expect(page.getByRole('button', { name: /Add recipe/i })).toBeHidden();
  await expect(page.getByRole('button', { name: /Edit recipe/i })).toBeHidden();
  await expect(page.getByRole('button', { name: /Restore samples/i })).toBeHidden();
});

test('resolves relative image paths, and draws the placeholder for none', async ({ page }) => {
  const body = copyOfFixture();
  body.recipes[1].imageUrl = null;
  body.recipes[1].imageSmallUrl = null;
  await answerRecipes(page, { body });
  await page.goto('/');

  const potRoast = page.getByRole('button', { name: /Perfect Sunday Pot Roast/i }).getByRole('img');
  await expect(potRoast).toHaveAttribute('src', '/images/recipes/pot-roast-640.webp');

  const noPhoto = page.getByRole('button', { name: /Cows-in-a-Blanket/i }).getByRole('img');
  await expect(noPhoto).toHaveAttribute('src', /^data:image\/svg\+xml,/);
});

test('shows a slow cooker recipe as a slow cooker recipe', async ({ page }) => {
  await answerRecipes(page, { body: copyOfFixture() });
  await page.goto('/');

  await page.getByRole('button', { name: /Slow Cooker Pot Roast/i }).click();

  // Before 'Slow cooker' was a method, a recipe naming none fell back to
  // "Stovetop". The stat tile reads label + value with no space between.
  await expect(page.getByRole('heading', { name: 'Slow Cooker Pot Roast' })).toBeVisible();
  await expect(page.getByText('MethodSlow cooker')).toBeVisible();
  await expect(page.getByText('Cook on low for 8–9 hours, or on high for 5–6 hours.')).toBeVisible();
  await expect(page.getByRole('button', { name: /Slow Cooker Pot Roast/i }).getByRole('img')).toHaveAttribute(
    'src',
    '/images/recipes/slow-cooker-pot-roast-640.webp',
  );
  // Credited to its photographer, with the licence, linking to the source.
  const credit = page.getByRole('link', { name: 'Photo by Melissa Doroquez, CC BY-SA 2.0 (cropped)' });
  await expect(credit).toHaveAttribute('href', 'https://www.flickr.com/photos/62967061@N00/2775536839/');
});

test('every recipe’s list photo is a file that exists', async ({ page }) => {
  await answerRecipes(page, { body: copyOfFixture() });
  await page.goto('/');

  const photos = page.getByLabel('Saved recipes').getByRole('img');
  await expect(photos).toHaveCount(fixture.recipes.length);
  let checked = 0;
  for (const photo of await photos.all()) {
    // Only this site's own files. One sample still links a photo on another
    // site's server, and a test should not fail because that site is slow.
    if (!(await photo.getAttribute('src'))?.startsWith('/images/')) {
      continue;
    }
    checked += 1;
    await photo.scrollIntoViewIfNeeded();
    // A path with no file behind it still gets a response from the dev
    // server, so the status is not the test: the browser decoding it is.
    await expect.poll(() => photo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0), { message: await photo.getAttribute('src') ?? '' }).toBe(true);
  }
  expect(checked).toBe(9);
});

test('falls back to the samples, read-only, when the API fails', async ({ page }) => {
  await answerRecipes(page, { status: 500, body: { error: 'server' } });
  await page.goto('/');

  await expect(page.getByText(FALLBACK_NOTICE)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Perfect Sunday Pot Roast' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Add recipe/i })).toBeHidden();
  await expect(page.getByRole('button', { name: /Edit recipe/i })).toBeHidden();
});

test('falls back when the API never answers', async ({ page }) => {
  // RECIPES_API_TIMEOUT_MS in recipeStorage.ts is 8 s; this waits past it.
  test.setTimeout(30_000);
  await page.route('**/api/recipes.php', () => {
    // Deliberately never fulfilled: a stalled PHP worker or MySQL connection.
  });
  await page.goto('/');

  await expect(page.getByText('Loading recipes…').first()).toBeVisible();
  await expect(page.getByText(FALLBACK_NOTICE)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('heading', { name: 'Perfect Sunday Pot Roast' })).toBeVisible();
});

test('falls back rather than crashing on a malformed recipe', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  // Valid JSON in the column, wrong shape: the database's JSON_VALID check
  // allows it, and RecipeDetail would call .join on it.
  const body = copyOfFixture();
  body.recipes[0].equipment = {};
  await answerRecipes(page, { body });
  await page.goto('/');

  await expect(page.getByText(FALLBACK_NOTICE)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Perfect Sunday Pot Roast' })).toBeVisible();
  expect(errors).toEqual([]);
});
