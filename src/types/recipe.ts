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
};
