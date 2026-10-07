import { placeholderImage } from '../data/placeholderImage';
import { seedRecipes } from '../data/seedRecipes';
import type { Recipe } from '../types/recipe';

// The only module that knows where recipes come from. Components get a list
// and a few flags; none of them learn whether there is a server.
//
// VITE_RECIPES_API decides, at build time:
//   unset  the browser's own localStorage, exactly as before. A fresh clone,
//          `npm run dev` and the smoke tests need no database.
//   set    the recipe box on the server (e.g. /nextthyme/api/recipes.php).
//          Visitors read it; nothing in this mode writes yet.

const RECIPES_STORAGE_KEY = 'next-thyme-recipes';
const recipesApi = (import.meta.env.VITE_RECIPES_API ?? '').trim();

export const recipeSource: 'local' | 'api' = recipesApi ? 'api' : 'local';

export type RecipeLoadResult = {
  recipes: Recipe[];
  // localStorage held something unreadable and was reset to the samples.
  storageRecovered: boolean;
  // The server could not be reached, so the bundled samples are showing.
  apiUnavailable: boolean;
  // Edit controls are hidden. True for every visitor in api mode.
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

const cookingMethods: unknown[] = ['Oven', 'Stovetop', 'Microwave'];

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

  return list.map((recipe) => ({
    ...recipe,
    imageUrl: resolveImage(recipe.imageUrl),
    imageSmallUrl: resolveImage(recipe.imageSmallUrl ?? recipe.imageUrl),
  }));
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
