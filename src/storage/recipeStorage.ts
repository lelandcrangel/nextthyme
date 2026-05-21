import { seedRecipes } from '../data/seedRecipes';
import type { Recipe } from '../types/recipe';

const RECIPES_STORAGE_KEY = 'next-thyme-recipes';

export type RecipeLoadResult = {
  recipes: Recipe[];
  storageRecovered: boolean;
};

function mergeSavedRecipes(savedRecipes: Recipe[]) {
  const seedRecipeIds = new Set(seedRecipes.map((recipe) => recipe.id));
  const customRecipes = savedRecipes.filter((recipe) => !seedRecipeIds.has(recipe.id));

  return [...seedRecipes, ...customRecipes];
}

export function loadRecipes(): RecipeLoadResult {
  if (typeof window === 'undefined') {
    return { recipes: seedRecipes, storageRecovered: false };
  }

  const savedRecipesJson = window.localStorage.getItem(RECIPES_STORAGE_KEY);

  if (!savedRecipesJson) {
    window.localStorage.setItem(RECIPES_STORAGE_KEY, JSON.stringify(seedRecipes));
    return { recipes: seedRecipes, storageRecovered: false };
  }

  try {
    const savedRecipes = JSON.parse(savedRecipesJson) as Recipe[];

    if (!Array.isArray(savedRecipes)) {
      throw new Error('Saved recipes were not an array.');
    }

    const mergedRecipes = mergeSavedRecipes(savedRecipes);
    window.localStorage.setItem(RECIPES_STORAGE_KEY, JSON.stringify(mergedRecipes));

    return { recipes: mergedRecipes, storageRecovered: false };
  } catch {
    window.localStorage.setItem(RECIPES_STORAGE_KEY, JSON.stringify(seedRecipes));
    return { recipes: seedRecipes, storageRecovered: true };
  }
}

export function saveRecipes(recipes: Recipe[]) {
  window.localStorage.setItem(RECIPES_STORAGE_KEY, JSON.stringify(recipes));
}

export function restoreSeedRecipes(): Recipe[] {
  window.localStorage.setItem(RECIPES_STORAGE_KEY, JSON.stringify(seedRecipes));
  return seedRecipes;
}
