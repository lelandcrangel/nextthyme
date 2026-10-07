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

function isApiRecipe(value: unknown): value is ApiRecipe {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const recipe = value as Record<string, unknown>;
  return (
    typeof recipe.id === 'string' &&
    typeof recipe.title === 'string' &&
    typeof recipe.servings === 'number' &&
    Array.isArray(recipe.ingredients) &&
    Array.isArray(recipe.directions) &&
    Array.isArray(recipe.tags)
  );
}

async function fetchApiRecipes(): Promise<Recipe[]> {
  const response = await fetch(recipesApi, {
    headers: { Accept: 'application/json' },
    credentials: 'same-origin',
  });
  if (!response.ok) {
    throw new Error(`Recipe API answered ${response.status}.`);
  }

  const body: unknown = await response.json();
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
