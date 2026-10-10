import { placeholderImage } from '../data/placeholderImage';
import { seedRecipes } from '../data/seedRecipes';
import { COOKING_METHODS, type Recipe } from '../types/recipe';

// The only module that knows where recipes come from. Components get a list
// and a few flags; none of them learn whether there is a server.
//
// VITE_RECIPES_API decides, at build time:
//   unset  the browser's own localStorage, exactly as before. A fresh clone,
//          `npm run dev` and the smoke tests need no database.
//   set    the recipe box on the server (e.g. /nextthyme/api/recipes.php).
//          Visitors read it. The owner signs in and writes through it.

const RECIPES_STORAGE_KEY = 'next-thyme-recipes';
const recipesApi = (import.meta.env.VITE_RECIPES_API ?? '').trim();

export const recipeSource: 'local' | 'api' = recipesApi ? 'api' : 'local';

// session.php sits beside recipes.php, so one variable configures both.
const sessionApi = recipesApi.replace(/[^/]*$/, 'session.php');

export type RecipeLoadResult = {
  recipes: Recipe[];
  // localStorage held something unreadable and was reset to the samples.
  storageRecovered: boolean;
  // The server could not be reached, so the bundled samples are showing.
  apiUnavailable: boolean;
  // Edit controls are hidden. True in api mode until the owner signs in.
  readOnly: boolean;
};

function mergeSavedRecipes(savedRecipes: Recipe[]) {
  const seedRecipeIds = new Set(seedRecipes.map((recipe) => recipe.id));
  const customRecipes = savedRecipes.filter((recipe) => !seedRecipeIds.has(recipe.id));

  return [...seedRecipes, ...customRecipes];
}

export function loadLocalRecipes(): RecipeLoadResult {
  const loaded = { apiUnavailable: false, readOnly: false };

  if (typeof window === 'undefined') {
    return { recipes: seedRecipes, storageRecovered: false, ...loaded };
  }

  const savedRecipesJson = window.localStorage.getItem(RECIPES_STORAGE_KEY);

  if (!savedRecipesJson) {
    window.localStorage.setItem(RECIPES_STORAGE_KEY, JSON.stringify(seedRecipes));
    return { recipes: seedRecipes, storageRecovered: false, ...loaded };
  }

  try {
    const savedRecipes = JSON.parse(savedRecipesJson) as Recipe[];

    if (!Array.isArray(savedRecipes)) {
      throw new Error('Saved recipes were not an array.');
    }

    const mergedRecipes = mergeSavedRecipes(savedRecipes);
    window.localStorage.setItem(RECIPES_STORAGE_KEY, JSON.stringify(mergedRecipes));

    return { recipes: mergedRecipes, storageRecovered: false, ...loaded };
  } catch {
    window.localStorage.setItem(RECIPES_STORAGE_KEY, JSON.stringify(seedRecipes));
    return { recipes: seedRecipes, storageRecovered: true, ...loaded };
  }
}

export function saveRecipes(recipes: Recipe[]) {
  if (recipeSource !== 'local') {
    return;
  }
  window.localStorage.setItem(RECIPES_STORAGE_KEY, JSON.stringify(recipes));
}

export function restoreSeedRecipes(): Recipe[] {
  window.localStorage.setItem(RECIPES_STORAGE_KEY, JSON.stringify(seedRecipes));
  return seedRecipes;
}

/**
 * The server stores image paths relative to the app's base, so one row works
 * under /nextthyme/ and under the dev server's /. Resolve them here, against
 * the same base the bundled images use. NULL means no photo.
 */
function resolveImage(path: string | null | undefined) {
  if (!path) {
    return placeholderImage;
  }
  if (/^(?:[a-z][a-z0-9+.-]*:|\/)/i.test(path)) {
    return path; // https:, data:, or already absolute
  }
  return `${import.meta.env.BASE_URL}${path}`;
}

type ApiRecipe = Omit<Recipe, 'imageUrl' | 'imageSmallUrl'> & {
  imageUrl: string | null;
  imageSmallUrl: string | null;
};

// The whole shape, nested members included. The database only guarantees that
// each JSON column is valid JSON, not that it is the right JSON: a row with
// `equipment = {}` would otherwise reach RecipeDetail and crash on `.join`,
// where a rejected response falls back to the samples instead.
type Shape = Record<string, unknown>;

const isObject = (value: unknown): value is Shape => typeof value === 'object' && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === 'string';
const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const isOptional = (value: unknown, check: (value: unknown) => boolean) => value === undefined || check(value);
const isStringList = (value: unknown) => Array.isArray(value) && value.every(isString);
const isNullableString = (value: unknown) => value === null || isString(value);

function isIngredient(value: unknown) {
  return (
    isObject(value) &&
    isString(value.id) &&
    isString(value.name) &&
    isNumber(value.quantity) &&
    isString(value.unit) &&
    isOptional(value.notes, isString) &&
    isOptional(value.section, isString)
  );
}

function isDirectionStep(value: unknown) {
  return isObject(value) && isString(value.id) && isNumber(value.order) && isString(value.instruction);
}

function isNutrition(value: unknown) {
  return (
    isObject(value) &&
    isNumber(value.calories) &&
    isString(value.protein) &&
    isString(value.fat) &&
    isString(value.carbohydrates)
  );
}

const cookingMethods: readonly unknown[] = COOKING_METHODS;

function isApiRecipe(value: unknown): value is ApiRecipe {
  if (!isObject(value)) {
    return false;
  }
  const textFields = [
    'id', 'title', 'description', 'category', 'cuisine', 'difficulty', 'imageAlt', 'imageCredit',
    'imageCreditUrl', 'history', 'yieldLabel', 'nextTimeNotes', 'leftoverStorage',
  ];
  const numberFields = ['servings', 'prepTimeMinutes', 'cookTimeMinutes', 'totalTimeMinutes'];

  return (
    textFields.every((field) => isString(value[field])) &&
    numberFields.every((field) => isNumber(value[field])) &&
    isNullableString(value.imageUrl) &&
    isNullableString(value.imageSmallUrl) &&
    isOptional(value.cookingMethod, (method) => cookingMethods.includes(method)) &&
    isOptional(value.ovenTempF, isNumber) &&
    isOptional(value.version, isNumber) &&
    isStringList(value.tags) &&
    isStringList(value.equipment) &&
    isStringList(value.tips) &&
    isStringList(value.similarRecipeIds) &&
    Array.isArray(value.ingredients) &&
    value.ingredients.every(isIngredient) &&
    Array.isArray(value.directions) &&
    value.directions.every(isDirectionStep) &&
    isNutrition(value.nutrition)
  );
}

// A server that fails answers quickly; one that hangs (a stuck PHP worker, a
// MySQL connection that never completes) would otherwise leave the page on
// "Loading recipes…" for good. Past this, give up and show the samples. It
// covers reading the body too, since a response can stall halfway.
export const RECIPES_API_TIMEOUT_MS = 8000;

async function fetchApiRecipes(): Promise<Recipe[]> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), RECIPES_API_TIMEOUT_MS);

  let body: unknown;
  try {
    const response = await fetch(recipesApi, {
      headers: { Accept: 'application/json' },
      credentials: 'same-origin',
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Recipe API answered ${response.status}.`);
    }
    body = await response.json();
  } finally {
    window.clearTimeout(timer);
  }

  const list = (body as { recipes?: unknown })?.recipes;
  if (!Array.isArray(list) || !list.every(isApiRecipe)) {
    throw new Error('Recipe API returned something that is not a recipe list.');
  }

  return list.map(fromApiRecipe);
}

/**
 * Loads from wherever this build reads. In api mode a failure is not a blank
 * page: the bundled samples show, read-only, with a notice, so a visitor
 * still gets a recipe box while the server is down.
 */
export async function loadRecipes(): Promise<RecipeLoadResult> {
  if (recipeSource === 'local') {
    return loadLocalRecipes();
  }

  try {
    const recipes = await fetchApiRecipes();
    return { recipes, storageRecovered: false, apiUnavailable: false, readOnly: true };
  } catch (error) {
    console.error(error);
    return { recipes: seedRecipes, storageRecovered: false, apiUnavailable: true, readOnly: true };
  }
}

// ── The owner's writes (api mode only) ────────────────────────────────────

/** Why a write did not happen, in words the form can show as they are. */
export class RecipeWriteError extends Error {
  constructor(
    message: string,
    readonly kind: 'conflict' | 'signed-out' | 'invalid' | 'exists' | 'failed',
    // For a conflict: the copy the server has now.
    readonly current?: Recipe,
  ) {
    super(message);
  }
}

/**
 * The reverse of resolveImage: what the server stores. The placeholder is
 * "no image", and this app's own paths go back to being relative.
 */
function storedImage(url: string): string | null {
  if (!url || url === placeholderImage) {
    return null;
  }
  const base = import.meta.env.BASE_URL;
  if (base && url.startsWith(base) && !/^[a-z][a-z0-9+.-]*:/i.test(url)) {
    return url.slice(base.length);
  }
  return url;
}

// The server takes whole numbers for these and refuses anything else. A
// number input can hand back 4.5 or NaN, so they are settled here.
const whole = (value: number, minimum = 0) => Math.max(minimum, Math.round(Number.isFinite(value) ? value : minimum));

function toApiRecipe(recipe: Recipe) {
  return {
    ...recipe,
    imageUrl: storedImage(recipe.imageUrl),
    imageSmallUrl: storedImage(recipe.imageSmallUrl),
    servings: whole(recipe.servings, 1),
    prepTimeMinutes: whole(recipe.prepTimeMinutes),
    cookTimeMinutes: whole(recipe.cookTimeMinutes),
    totalTimeMinutes: whole(recipe.totalTimeMinutes),
    ...(recipe.ovenTempF === undefined ? {} : { ovenTempF: whole(recipe.ovenTempF) }),
  };
}

function fromApiRecipe(recipe: ApiRecipe): Recipe {
  return {
    ...recipe,
    imageUrl: resolveImage(recipe.imageUrl),
    imageSmallUrl: resolveImage(recipe.imageSmallUrl ?? recipe.imageUrl),
  };
}

async function send(url: string, method: string, body?: unknown) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), RECIPES_API_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method,
      headers: { Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      credentials: 'same-origin',
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    const data: unknown = await response.json().catch(() => null);
    return { status: response.status, data: (data ?? {}) as Record<string, unknown> };
  } finally {
    window.clearTimeout(timer);
  }
}

/** Whether this browser is signed in as the owner. Never throws. */
export async function isSignedIn(): Promise<boolean> {
  if (recipeSource !== 'api') {
    return false;
  }
  try {
    const { status, data } = await send(sessionApi, 'GET');
    return status === 200 && data.owner === true;
  } catch {
    return false;
  }
}

/** Resolves to nothing on success, or to the sentence to show. */
export async function signIn(password: string): Promise<string | void> {
  try {
    const { status, data } = await send(sessionApi, 'POST', { password });
    if (status === 200 && data.owner === true) {
      return;
    }
    if (status === 429) {
      return 'Too many attempts. Wait a quarter of an hour and try again.';
    }
    if (status === 401 || status === 400) {
      return 'That password is not right.';
    }
    return 'Sign-in is not working right now.';
  } catch {
    return 'The server could not be reached.';
  }
}

export async function signOut(): Promise<void> {
  try {
    await send(sessionApi, 'DELETE');
  } catch {
    // Signed out locally either way; the cookie expires on its own.
  }
}

function writeFailure(status: number, data: Record<string, unknown>): RecipeWriteError {
  if (status === 409 && data.error === 'conflict') {
    const current = isApiRecipe(data.recipe) ? fromApiRecipe(data.recipe) : undefined;
    return new RecipeWriteError(
      'This recipe was changed somewhere else after you opened it, so nothing was saved. Your edits are still in this form: copy anything you want to keep, then cancel and open the recipe again.',
      'conflict',
      current,
    );
  }
  if (status === 409) {
    return new RecipeWriteError('A recipe with this name already exists, or was deleted. Change the title and save again.', 'exists');
  }
  if (status === 401) {
    return new RecipeWriteError(
      'You are signed out, so nothing was saved. Open this site in another tab, sign in there, then save again here.',
      'signed-out',
    );
  }
  if (status === 422 && Array.isArray(data.fields)) {
    return new RecipeWriteError(`The server did not accept: ${data.fields.join(', ')}.`, 'invalid');
  }
  return new RecipeWriteError('The server could not save this right now. Nothing was changed; try again in a moment.', 'failed');
}

/**
 * Creates the recipe, or replaces it if the server already has it (it
 * carries a version). Resolves to the saved copy, with its new version.
 */
export async function saveRecipeToServer(recipe: Recipe): Promise<Recipe> {
  const isNew = recipe.version === undefined;
  let result;
  try {
    result = isNew
      ? await send(recipesApi, 'POST', toApiRecipe(recipe))
      : await send(`${recipesApi}?id=${encodeURIComponent(recipe.id)}`, 'PUT', toApiRecipe(recipe));
  } catch {
    throw new RecipeWriteError('The server could not be reached. Nothing was saved; try again in a moment.', 'failed');
  }

  if ((result.status === 200 || result.status === 201) && isApiRecipe(result.data.recipe)) {
    return fromApiRecipe(result.data.recipe);
  }
  throw writeFailure(result.status, result.data);
}

export async function deleteRecipeOnServer(recipeId: string): Promise<void> {
  let result;
  try {
    result = await send(`${recipesApi}?id=${encodeURIComponent(recipeId)}`, 'DELETE');
  } catch {
    throw new RecipeWriteError('The server could not be reached. Nothing was deleted.', 'failed');
  }
  // Already gone is the outcome that was asked for.
  if (result.status !== 200 && result.status !== 404) {
    throw writeFailure(result.status, result.data);
  }
}
