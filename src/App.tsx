import { useEffect, useMemo, useState } from 'react';
import { RecipeDetail } from './components/RecipeDetail';
import { RecipeList } from './components/RecipeList';
import { loadRecipes, restoreSeedRecipes, saveRecipes } from './storage/recipeStorage';

export default function App() {
  const [initialRecipeState] = useState(loadRecipes);
  const [recipes, setRecipes] = useState(initialRecipeState.recipes);
  const [showRestoreRecipes, setShowRestoreRecipes] = useState(initialRecipeState.storageRecovered);
  const [selectedRecipeId, setSelectedRecipeId] = useState(recipes[0]?.id ?? '');

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
  }

  return (
    <div className="min-h-screen bg-[#f8f4ed] text-stone-950 lg:flex lg:h-screen lg:overflow-hidden">
      <RecipeList
        recipes={recipes}
        selectedRecipeId={selectedRecipeId}
        onSelectRecipe={setSelectedRecipeId}
        onRestoreRecipes={handleRestoreRecipes}
        showRestoreRecipes={showRestoreRecipes}
      />
      {selectedRecipe && <RecipeDetail recipe={selectedRecipe} />}
    </div>
  );
}
