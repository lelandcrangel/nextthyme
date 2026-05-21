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
  const [editingRecipeId, setEditingRecipeId] = useState('');

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
    setEditingRecipeId('');
  }

  function handleSelectRecipe(recipeId: string) {
    setSelectedRecipeId(recipeId);
    setIsAddingRecipe(false);
    setEditingRecipeId('');
  }

  function handleSaveRecipe(recipe: Recipe) {
    setRecipes((currentRecipes) => {
      const existingRecipe = currentRecipes.find((currentRecipe) => currentRecipe.id === recipe.id);

      if (!existingRecipe) {
        return [...currentRecipes, recipe];
      }

      return currentRecipes.map((currentRecipe) => (currentRecipe.id === recipe.id ? recipe : currentRecipe));
    });
    setSelectedRecipeId(recipe.id);
    setIsAddingRecipe(false);
    setEditingRecipeId('');
  }

  function handleCancelForm() {
    setIsAddingRecipe(false);
    setEditingRecipeId('');
  }

  function handleAddRecipe() {
    setIsAddingRecipe(true);
    setEditingRecipeId('');
  }

  function handleEditRecipe(recipeId: string) {
    setSelectedRecipeId(recipeId);
    setIsAddingRecipe(false);
    setEditingRecipeId(recipeId);
  }

  const recipeBeingEdited = recipes.find((recipe) => recipe.id === editingRecipeId);

  return (
    <div className="min-h-screen bg-[#f8f4ed] text-stone-950 lg:flex lg:h-screen lg:overflow-hidden">
      <RecipeList
        recipes={recipes}
        selectedRecipeId={selectedRecipeId}
        onSelectRecipe={handleSelectRecipe}
        onAddRecipe={handleAddRecipe}
        onRestoreRecipes={handleRestoreRecipes}
        showRestoreRecipes={showRestoreRecipes}
      />
      {isAddingRecipe || recipeBeingEdited ? (
        <RecipeForm key={recipeBeingEdited?.id ?? 'new-recipe'} recipe={recipeBeingEdited} onCancel={handleCancelForm} onSave={handleSaveRecipe} />
      ) : (
        selectedRecipe && <RecipeDetail recipe={selectedRecipe} onEditRecipe={handleEditRecipe} />
      )}
    </div>
  );
}
