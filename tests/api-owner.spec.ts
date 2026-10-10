import { expect, test, type Page, type Request } from 'playwright/test';
import { readFileSync } from 'node:fs';

// The owner's side of api mode: signing in and writing. The API is answered
// here, so this proves the app sends the right requests and handles each
// answer. That the endpoints themselves behave is scripts/test-endpoints.mjs.

type ApiRecipe = Record<string, unknown> & { id: string; title: string; version: number };
const fixture = JSON.parse(readFileSync(new URL('./fixtures/api-recipes.json', import.meta.url), 'utf8')) as { recipes: ApiRecipe[] };

type Answer = { status: number; body: unknown };
type Server = {
  owner: boolean;
  signIn: (password: string) => Answer;
  write: (request: Request) => Answer;
  writes: Request[];
};

const json = (status: number, body: unknown): Answer => ({ status, body });

async function serve(page: Page, overrides: Partial<Server> = {}) {
  const server: Server = {
    owner: false,
    signIn: () => json(401, { error: 'password' }),
    write: () => json(500, { error: 'server' }),
    writes: [],
    ...overrides,
  };
  const fulfil = (answer: Answer) => ({ status: answer.status, contentType: 'application/json', body: JSON.stringify(answer.body) });

  await page.route('**/api/session.php', (route) => {
    const request = route.request();
    if (request.method() === 'GET') {
      return route.fulfill(fulfil(json(200, { owner: server.owner })));
    }
    if (request.method() === 'DELETE') {
      server.owner = false;
      return route.fulfill(fulfil(json(200, { owner: false })));
    }
    const answer = server.signIn((request.postDataJSON() as { password: string }).password);
    if (answer.status === 200) {
      server.owner = true;
    }
    return route.fulfill(fulfil(answer));
  });

  await page.route('**/api/recipes.php*', (route) => {
    const request = route.request();
    if (request.method() === 'GET') {
      return route.fulfill(fulfil(json(200, structuredClone(fixture))));
    }
    server.writes.push(request);
    return route.fulfill(fulfil(server.write(request)));
  });

  return server;
}

const potRoast = () => structuredClone(fixture.recipes.find((recipe) => recipe.id === 'pot-roast')!);
const meatloaf = () => structuredClone(fixture.recipes.find((recipe) => recipe.id === 'meatloaf-mashed-potatoes-green-beans')!);

test('the sign-in form is not on the public page', async ({ page }) => {
  await serve(page);
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Perfect Sunday Pot Roast' })).toBeVisible();
  await expect(page.getByLabel('Owner password')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Add recipe|Edit recipe|Delete recipe|Sign out/ })).toHaveCount(0);
});

test('signs in at #signin, and a wrong password says so', async ({ page }) => {
  await serve(page, { signIn: (password) => (password === 'correct horse' ? json(200, { owner: true }) : json(401, { error: 'password' })) });
  await page.goto('/#signin');

  await page.getByLabel('Owner password').fill('wrong');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert')).toHaveText('That password is not right.');
  await expect(page.getByRole('button', { name: /Add recipe/ })).toHaveCount(0);

  await page.getByLabel('Owner password').fill('correct horse');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByText('Signed in. You can edit.')).toBeVisible();
  await expect(page.getByRole('button', { name: /Add recipe/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Edit recipe/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Delete recipe/ })).toBeVisible();
  await expect(page.getByLabel('Owner password')).toHaveCount(0);
  expect(new URL(page.url()).hash).toBe('');
});

test('a rate-limited sign-in says to wait', async ({ page }) => {
  await serve(page, { signIn: () => json(429, { error: 'rate-limited' }) });
  await page.goto('/#signin');

  await page.getByLabel('Owner password').fill('anything');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert')).toContainText('Too many attempts');
});

test('signing out puts the edit controls away', async ({ page }) => {
  await serve(page, { owner: true });
  await page.goto('/');

  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('button', { name: /Add recipe|Edit recipe|Delete recipe/ })).toHaveCount(0);
  await expect(page.getByText('Signed in. You can edit.')).toHaveCount(0);
});

test('editing a title sends a PUT that leaves everything else as it was', async ({ page }) => {
  const server = await serve(page, {
    owner: true,
    write: (request) => json(200, { recipe: { ...(request.postDataJSON() as ApiRecipe), version: 2 } }),
  });
  await page.goto('/');

  await page.getByRole('button', { name: /Meatloaf with Mashed Potatoes/ }).click();
  await page.getByRole('button', { name: /Edit recipe/ }).click();
  // No upload field on the server: a photo cannot ride inside a recipe.
  await expect(page.getByLabel('Upload image')).toHaveCount(0);
  await page.getByLabel(/Title/i).fill('Sunday Meatloaf');
  await page.getByRole('button', { name: /Save changes/ }).click();

  await expect(page.getByRole('heading', { name: 'Sunday Meatloaf' })).toBeVisible();

  expect(server.writes).toHaveLength(1);
  const request = server.writes[0];
  const sent = request.postDataJSON() as ApiRecipe;
  const original = meatloaf();
  expect(request.method()).toBe('PUT');
  expect(new URL(request.url()).searchParams.get('id')).toBe(original.id);
  expect(request.headers()['content-type']).toBe('application/json');
  expect(sent.version).toBe(1);
  expect(sent.title).toBe('Sunday Meatloaf');
  // The four sections, the notes and "to taste" all survive an edit that did
  // not touch them. The form's textarea alone would have flattened them.
  expect(sent.ingredients).toEqual(original.ingredients);
  expect(sent.directions).toEqual(original.directions);
  expect(sent.tags).toEqual(original.tags);
  // No photo is NULL on the server, never the placeholder's data: URL.
  expect(sent.imageUrl).toBeNull();
  expect(sent.imageSmallUrl).toBeNull();
});

test('an edit keeps a recipe’s own image paths relative, small one included', async ({ page }) => {
  const server = await serve(page, {
    owner: true,
    write: (request) => json(200, { recipe: { ...(request.postDataJSON() as ApiRecipe), version: 2 } }),
  });
  await page.goto('/');

  await page.getByRole('button', { name: /Edit recipe/ }).click();
  await page.getByLabel(/Description/i).fill('Edited.');
  await page.getByRole('button', { name: /Save changes/ }).click();
  await expect(page.getByText('Edited.').first()).toBeVisible();

  const sent = server.writes[0].postDataJSON() as ApiRecipe;
  const original = potRoast();
  expect(sent.imageUrl).toBe('images/recipes/pot-roast-1200.webp');
  expect(sent.imageSmallUrl).toBe('images/recipes/pot-roast-640.webp');
  expect(sent.imageAlt).toBe(original.imageAlt);
  expect(sent.imageCredit).toBe(original.imageCredit);
});

test('a stale edit is refused, keeps the form, and shows the newer copy on cancel', async ({ page }) => {
  const newer = { ...potRoast(), title: 'Pot Roast, changed elsewhere', version: 2 };
  const server = await serve(page, { owner: true, write: () => json(409, { error: 'conflict', recipe: newer }) });
  await page.goto('/');

  await page.getByRole('button', { name: /Edit recipe/ }).click();
  await page.getByLabel(/Title/i).fill('My stale title');
  await page.getByRole('button', { name: /Save changes/ }).click();

  await expect(page.getByRole('alert')).toContainText('changed somewhere else');
  // The owner's edits are still there to copy from.
  await expect(page.getByLabel(/Title/i)).toHaveValue('My stale title');

  // A second click must not quietly win: it still names the old version.
  await page.getByRole('button', { name: /Save changes/ }).click();
  await expect(page.getByRole('alert')).toContainText('changed somewhere else');
  expect(server.writes.map((request) => (request.postDataJSON() as ApiRecipe).version)).toEqual([1, 1]);

  await page.getByRole('button', { name: /Cancel/ }).click();
  await expect(page.getByRole('heading', { name: 'Pot Roast, changed elsewhere' })).toBeVisible();
});

test('a save while signed out says so and loses nothing', async ({ page }) => {
  await serve(page, { owner: true, write: () => json(401, { error: 'signed-out' }) });
  await page.goto('/');

  await page.getByRole('button', { name: /Edit recipe/ }).click();
  await page.getByLabel(/Title/i).fill('Typed before the session ended');
  await page.getByRole('button', { name: /Save changes/ }).click();

  await expect(page.getByRole('alert')).toContainText('You are signed out');
  await expect(page.getByLabel(/Title/i)).toHaveValue('Typed before the session ended');
});

test('adding a recipe sends a POST with no version and no data: image', async ({ page }) => {
  const server = await serve(page, {
    owner: true,
    write: (request) => json(201, { recipe: { ...(request.postDataJSON() as ApiRecipe), version: 1 } }),
  });
  await page.goto('/');

  await page.getByRole('button', { name: /Add recipe/ }).click();
  await page.getByLabel(/Title/i).fill('Weeknight Lemon Pasta');
  await page.getByLabel(/Description/i).fill('A bright, simple pasta for busy nights.');
  await page.getByLabel(/Ingredients/i).fill('8 oz spaghetti\n2 tbsp olive oil');
  await page.getByLabel(/Directions/i).fill('Boil the pasta.\nToss with olive oil.');
  await page.getByRole('button', { name: /Save recipe/ }).click();

  await expect(page.getByRole('heading', { name: 'Weeknight Lemon Pasta' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Weeknight Lemon Pasta/ })).toBeVisible();

  const request = server.writes[0];
  const sent = request.postDataJSON() as ApiRecipe;
  expect(request.method()).toBe('POST');
  expect(new URL(request.url()).search).toBe('');
  expect(sent).not.toHaveProperty('version');
  expect(sent.id).toMatch(/^custom-weeknight-lemon-pasta-[a-z0-9]{8}$/);
  expect(sent.imageUrl).toBeNull();
  expect(Number.isInteger(sent.servings)).toBe(true);
});

test('deleting asks first, then removes the recipe', async ({ page }) => {
  const server = await serve(page, { owner: true, write: () => json(200, { deleted: 'pot-roast' }) });
  await page.goto('/');

  // Declined: nothing is sent.
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: /Delete recipe/ }).click();
  await expect(page.getByRole('heading', { name: 'Perfect Sunday Pot Roast' })).toBeVisible();
  expect(server.writes).toHaveLength(0);

  let question = '';
  page.once('dialog', (dialog) => {
    question = dialog.message();
    return dialog.accept();
  });
  await page.getByRole('button', { name: /Delete recipe/ }).click();

  await expect(page.getByRole('button', { name: /Perfect Sunday Pot Roast/ })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Cows-in-a-Blanket' })).toBeVisible();
  expect(question).toContain('Perfect Sunday Pot Roast');
  expect(server.writes).toHaveLength(1);
  expect(server.writes[0].method()).toBe('DELETE');
  expect(new URL(server.writes[0].url()).searchParams.get('id')).toBe('pot-roast');
});
