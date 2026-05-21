import { expect, test } from 'playwright/test';

test('seeds and renders recipes on a fresh browser profile', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Recipe Box' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Perfect Sunday Pot Roast/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Cows-in-a-Blanket/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Easy Lasagna Rolls/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Restore samples/i })).toBeHidden();

  await page.getByRole('button', { name: /Beef Brisket Taquitos/i }).click();

  await expect(page.getByRole('heading', { name: 'Beef Brisket Taquitos' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Ingredients' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Directions' })).toBeVisible();
  await expect(page.getByText('cooked smoked beef brisket').first()).toBeVisible();
  await expect(page.getByText(/Place taquitos seam-side down/i)).toBeVisible();

  await page.getByRole('button', { name: /Easy Lasagna Rolls/i }).click();

  await expect(page.getByRole('heading', { name: 'Easy Lasagna Rolls' })).toBeVisible();
  await expect(page.getByText('MethodMicrowave')).toBeVisible();
  await expect(page.getByText('2 eggs').first()).toBeVisible();
  await expect(page.getByText('509')).toBeVisible();
  await expect(page.getByText('30.9 g')).toBeVisible();
  await expect(page.getByText('182 g')).toBeVisible();
  await expect(page.getByText('49.2 g')).toBeVisible();
  await expect(page.getByText(/Microwave on high until the rolls are hot/i)).toBeVisible();
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
  await page.getByLabel(/Ingredients/i).fill('8 oz spaghetti\n2 tbsp olive oil\n2 eggs\n1 lemon, zested and juiced');
  await page.getByLabel(/Directions/i).fill('Boil the pasta.\nToss with olive oil and lemon.\nServe warm.');
  await page.getByRole('button', { name: /Save recipe/i }).click();

  await expect(page.getByRole('button', { name: /Weeknight Lemon Pasta/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Weeknight Lemon Pasta' })).toBeVisible();
  await expect(page.getByLabel('Weeknight Lemon Pasta').getByText('A bright, simple pasta for busy nights.')).toBeVisible();
  await expect(page.getByText('spaghetti').first()).toBeVisible();
  await expect(page.getByText('2 eggs').first()).toBeVisible();
  await expect(page.getByText('12 eggs')).toBeHidden();
  await expect(page.getByText('Toss with olive oil and lemon.')).toBeVisible();
});

test('edits the selected recipe', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto('/');

  await page.getByRole('button', { name: /Edit recipe/i }).click();
  await expect(page.getByRole('heading', { name: /Edit Perfect Sunday Pot Roast/i })).toBeVisible();
  await expect(page.getByLabel(/Cook hours/i)).toHaveValue('4');
  await expect(page.getByLabel(/Cook minutes/i)).toHaveValue('0');

  await page.getByLabel(/Title/i).fill('Perfect Saturday Pot Roast');
  await page.getByLabel(/Description/i).fill('A cozy roast shifted to Saturday dinner.');
  await page.getByLabel(/Cook hours/i).fill('1');
  await page.getByLabel(/Cook minutes/i).fill('20');
  await page.getByLabel(/Cooking method/i).selectOption('Microwave');
  await expect(page.getByLabel(/Oven °F/i)).toBeHidden();
  await page.getByRole('button', { name: /Save changes/i }).click();

  await expect(page.getByRole('button', { name: /Perfect Saturday Pot Roast/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Perfect Saturday Pot Roast' })).toBeVisible();
  await expect(page.getByLabel('Perfect Saturday Pot Roast').getByText('A cozy roast shifted to Saturday dinner.')).toBeVisible();
  await expect(page.getByText('Cook1 hr 20 min')).toBeVisible();
  await expect(page.getByText('MethodMicrowave')).toBeVisible();
  await expect(page.getByRole('button', { name: /Perfect Sunday Pot Roast/i })).toBeHidden();
});
