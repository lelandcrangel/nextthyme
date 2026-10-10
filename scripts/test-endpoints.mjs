// Exercises public/api/ for real: PHP, MariaDB, sessions, the lot.
//
//   npm run test:api
//
// The Playwright suite answers the API itself, so it proves the app and
// nothing about the endpoints. This is the other half. It needs the local
// setup in db/README.md ("Local development"), so it is not part of CI.
//
// It writes to the database the local config names, and refuses to run unless
// that name ends in _dev. Everything it creates is removed again, pass or
// fail, including the sign-in attempts it makes on purpose.

import { spawn, execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const configPath = path.resolve(root, '..', 'nextthyme-config.php');
const passwordPath = path.resolve(root, '..', 'nextthyme-dev-owner-password.txt');
const PORT = 8091;
const BASE = `http://127.0.0.1:${PORT}/api`;
const ORIGIN = 'http://127.0.0.1:5173';
const TEST_ID = `zz-endpoint-test-${Math.random().toString(36).slice(2, 10)}`;

function php(code) {
  return execFileSync('php', ['-r', code], { encoding: 'utf8', env: { ...process.env, NT_CONFIG: configPath } });
}

if (!existsSync(configPath)) {
  console.error(`No local config at ${configPath}. See db/README.md, "Local development".`);
  process.exit(2);
}
const dbName = php('$c = require getenv("NT_CONFIG"); echo $c["db"]["name"];');
if (!dbName.endsWith('_dev')) {
  console.error(`Refusing to run: the config names database "${dbName}", which is not a _dev database.`);
  process.exit(2);
}
const password = process.env.NT_OWNER_PASSWORD ?? (existsSync(passwordPath) ? readFileSync(passwordPath, 'utf8').trim() : '');
if (!password) {
  console.error(`No dev owner password. Set NT_OWNER_PASSWORD or create ${passwordPath}.`);
  process.exit(2);
}

const PDO = '$c = require getenv("NT_CONFIG"); $p = new PDO("mysql:host={$c["db"]["host"]};dbname={$c["db"]["name"]};charset=utf8mb4", $c["db"]["user"], $c["db"]["password"], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);';
function cleanUp() {
  php(`${PDO} $p->exec("DELETE FROM recipes WHERE id LIKE 'zz-endpoint-test-%'"); $p->exec("DELETE FROM login_attempts");`);
}

let cookie = '';
async function call(method, file, { body, origin = ORIGIN, type = 'application/json', sendCookie = true, raw } = {}) {
  const headers = {};
  if (origin) headers.Origin = origin;
  if (body !== undefined || raw !== undefined) headers['Content-Type'] = type;
  if (sendCookie && cookie) headers.Cookie = cookie;
  const response = await fetch(`${BASE}/${file}`, { method, headers, body: raw ?? (body === undefined ? undefined : JSON.stringify(body)) });
  const setCookie = response.headers.get('set-cookie') ?? '';
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // not JSON; the test that cares will fail on it
  }
  return { status: response.status, json, setCookie, headers: response.headers };
}

let failed = 0;
let passed = 0;
function check(name, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  ok   ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL ${name}${detail ? `\n       ${detail}` : ''}`);
  }
}
const show = (r) => `got ${r.status} ${JSON.stringify(r.json)}`;

function recipe(overrides = {}) {
  return {
    id: TEST_ID,
    title: 'Endpoint test: 275°F, 6–8 minutes',
    description: 'Written by scripts/test-endpoints.mjs and removed again.',
    category: 'Dinner',
    cuisine: 'Test kitchen',
    difficulty: 'Easy',
    imageUrl: null,
    imageSmallUrl: null,
    imageAlt: 'Endpoint test recipe',
    imageCredit: 'Next Thyme placeholder',
    imageCreditUrl: '#',
    history: '',
    servings: 4,
    yieldLabel: '4 servings',
    prepTimeMinutes: 5,
    cookTimeMinutes: 10,
    totalTimeMinutes: 15,
    cookingMethod: 'Slow cooker',
    tags: ['Test'],
    equipment: [],
    ingredients: [{ id: 'i1', name: 'water', quantity: 0.5, unit: 'cup', notes: 'cold' }],
    directions: [{ id: 's1', order: 1, instruction: 'Boil.' }],
    tips: [],
    nutrition: { calories: 0, protein: 'Not added', fat: 'Not added', carbohydrates: 'Not added' },
    nextTimeNotes: '',
    leftoverStorage: '',
    similarRecipeIds: [],
    ...overrides,
  };
}

const server = spawn('php', ['-S', `127.0.0.1:${PORT}`, '-t', path.join(root, 'public')], { stdio: ['ignore', 'ignore', 'pipe'] });
let serverLog = '';
server.stderr.on('data', (chunk) => (serverLog += chunk));

try {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      await fetch(`${BASE}/recipes.php`);
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  cleanUp();

  console.log('Visitors');
  let r = await call('GET', 'recipes.php', { origin: null });
  const before = r.json?.recipes?.length ?? -1;
  check('GET recipes is public', r.status === 200 && before > 0, show(r));
  r = await call('GET', 'session.php', { origin: null });
  check('a visitor is not the owner', r.status === 200 && r.json?.owner === false, show(r));
  check('a visitor is given no session cookie', r.setCookie === '', r.setCookie);

  const sessionFiles = () => Number(php(`echo count(glob(dirname(getenv("NT_CONFIG")) . "/nextthyme-sessions/sess_*"));`));
  const filesBefore = sessionFiles();
  cookie = 'nt_session=abcdefghijklmnopqrstuvwxyz012345';
  r = await call('GET', 'session.php', { origin: null });
  check('a made-up cookie is not the owner', r.json?.owner === false && r.setCookie === '', show(r));
  r = await call('POST', 'recipes.php', { body: recipe() });
  check('a made-up cookie cannot write: 401', r.status === 401, show(r));
  check('and creates no session file', sessionFiles() === filesBefore, `${filesBefore} -> ${sessionFiles()}`);
  cookie = 'nt_session=../../etc/passwd';
  r = await call('GET', 'session.php', { origin: null });
  check('a path in the cookie is ignored', r.status === 200 && r.json?.owner === false, show(r));
  cookie = '';

  console.log('Writes are refused before sign-in');
  r = await call('POST', 'recipes.php', { body: recipe(), origin: null });
  check('no Origin header: 403', r.status === 403, show(r));
  r = await call('POST', 'recipes.php', { body: recipe(), origin: 'https://evil.example' });
  check('a foreign Origin: 403', r.status === 403, show(r));
  r = await call('POST', 'recipes.php', { body: recipe() });
  check('right Origin, signed out: 401', r.status === 401, show(r));
  r = await call('PUT', `recipes.php?id=pot-roast`, { body: recipe({ id: 'pot-roast', version: 1 }) });
  check('PUT signed out: 401', r.status === 401, show(r));
  r = await call('DELETE', `recipes.php?id=pot-roast`);
  check('DELETE signed out: 401', r.status === 401, show(r));
  r = await call('PATCH', 'recipes.php', { body: {} });
  check('PATCH: 405', r.status === 405, show(r));

  console.log('Signing in');
  r = await call('POST', 'session.php', { body: { password }, origin: 'https://evil.example' });
  check('sign-in from a foreign Origin: 403', r.status === 403, show(r));
  r = await call('POST', 'session.php', { raw: `password=${encodeURIComponent(password)}`, type: 'application/x-www-form-urlencoded' });
  check('sign-in as a form post: 415', r.status === 415, show(r));
  r = await call('POST', 'session.php', { body: { password: `${password}x` } });
  check('wrong password: 401', r.status === 401 && r.setCookie === '', show(r));
  r = await call('POST', 'session.php', { body: { password } });
  check('right password: 200', r.status === 200 && r.json?.owner === true, show(r));
  check('cookie is HttpOnly', /;\s*HttpOnly/i.test(r.setCookie), r.setCookie.replace(/=[^;]+/, '=…'));
  check('cookie is SameSite=Strict', /;\s*SameSite=Strict/i.test(r.setCookie), r.setCookie.replace(/=[^;]+/, '=…'));
  check('cookie is scoped to the app path', /;\s*path=\//i.test(r.setCookie), r.setCookie.replace(/=[^;]+/, '=…'));
  cookie = r.setCookie.split(';')[0];
  r = await call('GET', 'session.php', { origin: null });
  check('the session is recognised', r.json?.owner === true, show(r));

  console.log('Creating');
  r = await call('POST', 'recipes.php', { body: recipe() });
  check('create: 201, version 1', r.status === 201 && r.json?.recipe?.version === 1, show(r));
  check('non-ASCII survives', r.json?.recipe?.title === 'Endpoint test: 275°F, 6–8 minutes', r.json?.recipe?.title);
  check('decimals survive', r.json?.recipe?.ingredients?.[0]?.quantity === 0.5, JSON.stringify(r.json?.recipe?.ingredients));
  check('the new method is stored', r.json?.recipe?.cookingMethod === 'Slow cooker', r.json?.recipe?.cookingMethod);
  r = await call('GET', 'recipes.php', { origin: null });
  check('it is listed last', r.json?.recipes?.length === before + 1 && r.json.recipes.at(-1).id === TEST_ID, show({ status: r.status, json: r.json?.recipes?.length }));
  r = await call('POST', 'recipes.php', { body: recipe() });
  check('the same id again: 409 exists', r.status === 409 && r.json?.error === 'exists', show(r));

  console.log('Validation');
  r = await call('POST', 'recipes.php', {
    body: recipe({
      id: `${TEST_ID}-bad`,
      title: '   ',
      servings: 0,
      imageUrl: 'data:image/png;base64,AAAA',
      imageCreditUrl: 'javascript:alert(1)',
      cookingMethod: 'Grill',
      ingredients: [{ id: 'i1', name: 'water', quantity: 'lots', unit: 'cup' }],
      tags: 'Test',
    }),
  });
  const fields = r.json?.fields ?? [];
  check('a bad recipe: 422', r.status === 422, show(r));
  for (const field of ['title', 'servings', 'imageUrl', 'imageCreditUrl', 'cookingMethod', 'ingredients', 'tags']) {
    check(`  names ${field}`, fields.includes(field), JSON.stringify(fields));
  }
  r = await call('POST', 'recipes.php', { body: recipe({ id: 'Not A Slug!' }) });
  check('a bad id: 422', r.status === 422 && r.json?.fields?.includes('id'), show(r));
  r = await call('POST', 'recipes.php', { raw: '{not json' });
  check('a broken body: 400', r.status === 400, show(r));
  r = await call('GET', 'recipes.php', { origin: null });
  check('nothing was written by any of those', r.json?.recipes?.length === before + 1, String(r.json?.recipes?.length));

  console.log('Updating');
  r = await call('PUT', `recipes.php?id=${TEST_ID}`, { body: recipe({ title: 'Edited once', version: 1 }) });
  check('update at version 1: 200, now version 2', r.status === 200 && r.json?.recipe?.version === 2 && r.json.recipe.title === 'Edited once', show(r));
  r = await call('PUT', `recipes.php?id=${TEST_ID}`, { body: recipe({ title: 'A stale tab', version: 1 }) });
  check('a stale version: 409 conflict', r.status === 409 && r.json?.error === 'conflict', show(r));
  check('the conflict returns the current copy', r.json?.recipe?.version === 2 && r.json.recipe.title === 'Edited once', JSON.stringify(r.json?.recipe?.title));
  r = await call('PUT', `recipes.php?id=pot-roast`, { body: recipe({ version: 2 }) });
  check('id in the URL and body disagree: 400', r.status === 400, show(r));
  r = await call('PUT', `recipes.php?id=${TEST_ID}`, { body: recipe({ version: 2 }), origin: 'https://evil.example' });
  check('signed in but a foreign Origin: 403', r.status === 403, show(r));
  r = await call('PUT', `recipes.php?id=${TEST_ID}`, { body: recipe() });
  check('no version: 422', r.status === 422 && r.json?.fields?.includes('version'), show(r));

  console.log('Deleting');
  r = await call('DELETE', `recipes.php?id=${TEST_ID}`);
  check('delete: 200', r.status === 200, show(r));
  r = await call('GET', 'recipes.php', { origin: null });
  check('it is gone from the list', r.json?.recipes?.length === before && !r.json.recipes.some((x) => x.id === TEST_ID), String(r.json?.recipes?.length));
  const kept = php(`${PDO} echo $p->query("SELECT COUNT(*) FROM recipes WHERE id = '${TEST_ID}' AND deleted_at IS NOT NULL")->fetchColumn();`);
  check('the row is kept, only hidden', kept === '1', kept);
  r = await call('DELETE', `recipes.php?id=${TEST_ID}`);
  check('deleting it again: 404', r.status === 404, show(r));
  r = await call('POST', 'recipes.php', { body: recipe() });
  check('its id stays taken: 409', r.status === 409, show(r));

  console.log('Signing out');
  r = await call('DELETE', 'session.php');
  check('sign out: 200', r.status === 200 && r.json?.owner === false, show(r));
  r = await call('POST', 'recipes.php', { body: recipe({ id: `${TEST_ID}-after` }) });
  check('the old cookie no longer writes: 401', r.status === 401, show(r));

  console.log('Rate limiting');
  cookie = '';
  cleanUp();
  const limit = Number(php('$c = require getenv("NT_CONFIG"); echo $c["login_rate_limit"]["max_failures"] ?? 5;'));
  let statuses = [];
  for (let i = 0; i < limit; i += 1) {
    statuses.push((await call('POST', 'session.php', { body: { password: 'wrong' } })).status);
  }
  check(`${limit} wrong passwords are each a 401`, statuses.every((s) => s === 401), statuses.join(','));
  r = await call('POST', 'session.php', { body: { password: 'wrong' } });
  check('the next is a 429 with Retry-After', r.status === 429 && Number(r.headers.get('retry-after')) > 0, show(r));
  r = await call('POST', 'session.php', { body: { password } });
  check('even the right password waits: 429', r.status === 429 && r.setCookie === '', show(r));
  r = await call('GET', 'recipes.php', { origin: null });
  check('reading is unaffected', r.status === 200, show(r));
} finally {
  try {
    cleanUp();
  } finally {
    server.kill();
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  const log = serverLog.split('\n').filter((line) => line.includes('nextthyme:')).slice(-10).join('\n');
  if (log) console.log(`\nServer log:\n${log}`);
  process.exit(1);
}
