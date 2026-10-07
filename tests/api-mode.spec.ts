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
