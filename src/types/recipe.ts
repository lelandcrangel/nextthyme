export type Ingredient = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  notes?: string;
  section?: string;
};

export type DirectionStep = {
  id: string;
  order: number;
  instruction: string;
};

// One list, so the form's options, the API check and the type cannot drift.
// The database column is an ENUM of the same values: add one here and it
// needs a migration too (see db/migrations/003_slow_cooker_method.sql).
export const COOKING_METHODS = ['Oven', 'Stovetop', 'Microwave', 'Slow cooker'] as const;

export type CookingMethod = (typeof COOKING_METHODS)[number];

// Methods with no oven temperature to show or ask for.
export const METHODS_WITHOUT_TEMPERATURE: readonly CookingMethod[] = ['Microwave', 'Slow cooker'];

export type Recipe = {
  id: string;
  title: string;
  description: string;
  category: string;
  cuisine: string;
  difficulty: string;
  imageUrl: string;
  imageSmallUrl: string;
  imageAlt: string;
  imageCredit: string;
  imageCreditUrl: string;
  history: string;
  servings: number;
  yieldLabel: string;
  prepTimeMinutes: number;
  cookTimeMinutes: number;
  totalTimeMinutes: number;
  cookingMethod?: CookingMethod;
  ovenTempF?: number;
  tags: string[];
  equipment: string[];
  ingredients: Ingredient[];
  directions: DirectionStep[];
  tips: string[];
  nutrition: {
    calories: number;
    protein: string;
    fat: string;
    carbohydrates: string;
  };
  nextTimeNotes: string;
  leftoverStorage: string;
  similarRecipeIds: string[];
  // Set by the server: an update names the version it edited, and a stale one
  // is refused. Absent for recipes that only exist in localStorage.
  version?: number;
};
