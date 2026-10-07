import { useEffect, useMemo, useState } from 'react';
import { RecipeDetail } from './components/RecipeDetail';
import { RecipeForm } from './components/RecipeForm';
import { RecipeList } from './components/RecipeList';
import { loadLocalRecipes, loadRecipes, recipeSource, restoreSeedRecipes, saveRecipes, type RecipeLoadResult } from './storage/recipeStorage';
import type { Recipe } from './types/recipe';

// localStorage is synchronous, so local mode starts loaded and the first paint
// is the recipe box, as it always was. Only api mode has a loading state.
const initialLoad: RecipeLoadResult | null = recipeSource === 'local' ? loadLocalRecipes() : null;

export default function App() {
  const [isLoading, setIsLoading] = useState(initialLoad === null);
  const [recipes, setRecipes] = useState<Recipe[]>(initialLoad?.recipes ?? []);
  const [showRestoreRecipes, setShowRestoreRecipes] = useState(initialLoad?.storageRecovered ?? false);
  const [apiUnavailable, setApiUnavailable] = useState(false);
  const [readOnly, setReadOnly] = useState(initialLoad?.readOnly ?? true);
  const [selectedRecipeId, setSelectedRecipeId] = useState(recipes[0]?.id ?? '');
  const [isAddingRecipe, setIsAddingRecipe] = useState(false);
  const [editingRecipeId, setEditingRecipeId] = useState('');

  useEffect(() => {
    if (initialLoad) {
      return;
    }

    let cancelled = false;
    loadRecipes().then((result) => {
      if (cancelled) {
        return;
      }
      setRecipes(result.recipes);
      setSelectedRecipeId((current) => current || result.recipes[0]?.id || '');
      setApiUnavailable(result.apiUnavailable);
      setReadOnly(result.readOnly);
      setIsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedRecipe = useMemo(
    () => recipes.find((recipe) => recipe.id === selectedRecipeId) ?? recipes[0],
    [recipes, selectedRecipeId],
  );

  useEffect(() => {
    // Never before the load lands: an empty list written here would erase
    // the visitor's saved recipes. saveRecipes is a no-op outside local mode.
    if (!isLoading) {
      saveRecipes(recipes);
    }
  }, [recipes, isLoading]);

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

  const recipeBeingEdited = readOnly ? undefined : recipes.find((recipe) => recipe.id === editingRecipeId);

  return (
    <div className="min-h-screen bg-[#f8f4ed] text-stone-950 lg:flex lg:h-screen lg:overflow-hidden">
      <RecipeList
        recipes={recipes}
        isLoading={isLoading}
        selectedRecipeId={selectedRecipeId}
        onSelectRecipe={handleSelectRecipe}
        onAddRecipe={readOnly ? undefined : handleAddRecipe}
        onRestoreRecipes={handleRestoreRecipes}
        showRestoreRecipes={showRestoreRecipes && !readOnly}
        notice={apiUnavailable ? 'The recipe box could not be reached, so these are the sample recipes. Try again in a little while.' : undefined}
      />
      {isLoading ? (
        <main className="flex min-h-[50vh] flex-1 items-center justify-center p-8 text-sm font-bold text-stone-500" aria-busy="true">
          Loading recipes…
        </main>
      ) : (!readOnly && isAddingRecipe) || recipeBeingEdited ? (
        <RecipeForm key={recipeBeingEdited?.id ?? 'new-recipe'} recipe={recipeBeingEdited} onCancel={handleCancelForm} onSave={handleSaveRecipe} />
      ) : (
        selectedRecipe && <RecipeDetail recipe={selectedRecipe} onEditRecipe={readOnly ? undefined : handleEditRecipe} />
      )}
    </div>
  );
}
