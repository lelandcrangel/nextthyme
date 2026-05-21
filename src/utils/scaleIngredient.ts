import type { Ingredient } from '../types/recipe';

export function scaleIngredient(ingredient: Ingredient, originalServings: number, desiredServings: number): Ingredient {
  if (
    ingredient.unit === 'to taste'
    || ingredient.unit === 'as needed'
    || !Number.isFinite(ingredient.quantity)
    || originalServings <= 0
    || desiredServings <= 0
  ) {
    return ingredient;
  }

  const scaledQuantity = ingredient.quantity * (desiredServings / originalServings);

  return {
    ...ingredient,
    quantity: Number(scaledQuantity.toFixed(2)),
  };
}

export function formatQuantity(quantity: number): string {
  if (Number.isInteger(quantity)) return String(quantity);
  return String(quantity).replace(/\.00$/, '');
}

export function formatIngredientAmount(ingredient: Ingredient): string {
  if (ingredient.unit === 'to taste') {
    return 'To taste';
  }

  if (ingredient.unit === 'as needed') {
    return 'As needed';
  }

  return [formatQuantity(ingredient.quantity), ingredient.unit].filter(Boolean).join(' ');
}
