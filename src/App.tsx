import { useEffect, useMemo, useState } from 'react';
import { RecipeDetail } from './components/RecipeDetail';
import { RecipeForm } from './components/RecipeForm';
import { RecipeList } from './components/RecipeList';
import { loadRecipes, restoreSeedRecipes, saveRecipes } from './storage/recipeStorage';
import type { Recipe } from './types/recipe';

export default function App() {
  const [initialRecipeState] = useState(loadRecipes);
  const [recipes, setRecipes] = useState(initialRecipeState.recipes);
  const [showRestoreRecipes, setShowRestoreRecipes] = useState(initialRecipeState.storageRecovered);
  const [selectedRecipeId, setSelectedRecipeId] = useState(recipes[0]?.id ?? '');
  const [isAddingRecipe, setIsAddingRecipe] = useState(false);

  const selectedRecipe = useMemo(
    () => recipes.find((recipe) => recipe.id === selectedRecipeId) ?? recipes[0],
    [recipes, selectedRecipeId],
  );

  useEffect(() => {
    saveRecipes(recipes);
  }, [recipes]);

  function handleRestoreRecipes() {
    const restoredRecipes = restoreSeedRecipes();
    setRecipes(restoredRecipes);
    setShowRestoreRecipes(false);
    setSelectedRecipeId(restoredRecipes[0]?.id ?? '');
    setIsAddingRecipe(false);
  }

  function handleSelectRecipe(recipeId: string) {
    setSelectedRecipeId(recipeId);
    setIsAddingRecipe(false);
  }

  function handleSaveRecipe(recipe: Recipe) {
    setRecipes((currentRecipes) => [...currentRecipes, recipe]);
    setSelectedRecipeId(recipe.id);
    setIsAddingRecipe(false);
  }

  return (
    <div className="min-h-screen bg-[#f8f4ed] text-stone-950 lg:flex lg:h-screen lg:overflow-hidden">
      <RecipeList
        recipes={recipes}
        selectedRecipeId={selectedRecipeId}
        onSelectRecipe={handleSelectRecipe}
        onAddRecipe={() => setIsAddingRecipe(true)}
        onRestoreRecipes={handleRestoreRecipes}
        showRestoreRecipes={showRestoreRecipes}
      />
      {isAddingRecipe ? (
        <RecipeForm onCancel={() => setIsAddingRecipe(false)} onSave={handleSaveRecipe} />
      ) : (
        selectedRecipe && <RecipeDetail recipe={selectedRecipe} />
      )}
    </div>
  );
}
