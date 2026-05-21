import { expect, test } from 'playwright/test';

test('seeds and renders recipes on a fresh browser profile', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Recipe Box' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Perfect Sunday Pot Roast/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Cows-in-a-Blanket/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Restore samples/i })).toBeHidden();

  await page.getByRole('button', { name: /Beef Brisket Taquitos/i }).click();

  await expect(page.getByRole('heading', { name: 'Beef Brisket Taquitos' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Ingredients' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Directions' })).toBeVisible();
  await expect(page.getByText('cooked smoked beef brisket').first()).toBeVisible();
  await expect(page.getByText(/Place taquitos seam-side down/i)).toBeVisible();
});

test('shows restore samples when saved recipes are invalid', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem('next-thyme-recipes', '{not-json'));
  await page.goto('/');

  await expect(page.getByRole('button', { name: /Restore samples/i })).toBeVisible();

  await page.getByRole('button', { name: /Restore samples/i }).click();

  await expect(page.getByRole('button', { name: /Restore samples/i })).toBeHidden();
  await expect(page.getByRole('button', { name: /Perfect Sunday Pot Roast/i })).toBeVisible();
});

test('adds a custom recipe', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto('/');

  await page.getByRole('button', { name: /Add recipe/i }).click();
  await page.getByLabel(/Title/i).fill('Weeknight Lemon Pasta');
  await page.getByLabel(/Description/i).fill('A bright, simple pasta for busy nights.');
  await page.getByLabel(/Cuisine/i).fill('Italian-ish');
  await page.getByLabel(/Ingredients/i).fill('8 oz spaghetti\n2 tbsp olive oil\n1 lemon, zested and juiced');
  await page.getByLabel(/Directions/i).fill('Boil the pasta.\nToss with olive oil and lemon.\nServe warm.');
  await page.getByRole('button', { name: /Save recipe/i }).click();

  await expect(page.getByRole('button', { name: /Weeknight Lemon Pasta/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Weeknight Lemon Pasta' })).toBeVisible();
  await expect(page.getByLabel('Weeknight Lemon Pasta').getByText('A bright, simple pasta for busy nights.')).toBeVisible();
  await expect(page.getByText('spaghetti').first()).toBeVisible();
  await expect(page.getByText('Toss with olive oil and lemon.')).toBeVisible();
});
