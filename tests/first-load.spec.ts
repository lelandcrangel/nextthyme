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
