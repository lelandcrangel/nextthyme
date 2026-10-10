import { useEffect, useMemo, useRef, useState } from 'react';
import { RecipeDetail } from './components/RecipeDetail';
import { RecipeForm } from './components/RecipeForm';
import { RecipeList } from './components/RecipeList';
import {
  RecipeWriteError,
  deleteRecipeOnServer,
  isSignedIn,
  loadLocalRecipes,
  loadRecipes,
  recipeSource,
  restoreSeedRecipes,
  saveRecipeToServer,
  saveRecipes,
  signIn,
  signOut,
  type RecipeLoadResult,
} from './storage/recipeStorage';
import type { Recipe } from './types/recipe';

// localStorage is synchronous, so local mode starts loaded and the first paint
// is the recipe box, as it always was. Only api mode has a loading state.
const initialLoad: RecipeLoadResult | null = recipeSource === 'local' ? loadLocalRecipes() : null;
const onServer = recipeSource === 'api';

// The sign-in form is not on the public page; it is at <site>/#signin.
const wantsSignIn = () => window.location.hash === '#signin';

export default function App() {
  const [isLoading, setIsLoading] = useState(initialLoad === null);
  const [recipes, setRecipes] = useState<Recipe[]>(initialLoad?.recipes ?? []);
  const [showRestoreRecipes, setShowRestoreRecipes] = useState(initialLoad?.storageRecovered ?? false);
  const [apiUnavailable, setApiUnavailable] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [showSignIn, setShowSignIn] = useState(wantsSignIn);
  const [selectedRecipeId, setSelectedRecipeId] = useState(recipes[0]?.id ?? '');
  const [isAddingRecipe, setIsAddingRecipe] = useState(false);
  const [editingRecipeId, setEditingRecipeId] = useState('');
  // After a save is refused as stale, the copy the server has. Held back
  // until the form closes: swapped in underneath an open form it would hand
  // that form the new version number, and a second click on Save would then
  // overwrite the very change the refusal was protecting.
  const newerCopy = useRef<Recipe | null>(null);

  // On the server, a visitor reads and the signed-in owner writes. With the
  // server unreachable nobody writes: the samples on screen are not the box.
  const readOnly = onServer ? !isOwner || apiUnavailable : false;

  useEffect(() => {
    if (initialLoad) {
      return;
    }

    let cancelled = false;
    Promise.all([loadRecipes(), isSignedIn()]).then(([result, signedIn]) => {
      if (cancelled) {
        return;
      }
      setRecipes(result.recipes);
      setSelectedRecipeId((current) => current || result.recipes[0]?.id || '');
      setApiUnavailable(result.apiUnavailable);
      setIsOwner(signedIn);
      setIsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onHashChange = () => setShowSignIn(wantsSignIn());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
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

  function putRecipe(recipe: Recipe) {
    setRecipes((currentRecipes) =>
      currentRecipes.some((currentRecipe) => currentRecipe.id === recipe.id)
        ? currentRecipes.map((currentRecipe) => (currentRecipe.id === recipe.id ? recipe : currentRecipe))
        : [...currentRecipes, recipe],
    );
  }

  function closeForm() {
    setIsAddingRecipe(false);
    setEditingRecipeId('');
    if (newerCopy.current) {
      putRecipe(newerCopy.current);
      newerCopy.current = null;
    }
  }

  function handleRestoreRecipes() {
    const restoredRecipes = restoreSeedRecipes();
    setRecipes(restoredRecipes);
    setShowRestoreRecipes(false);
    setSelectedRecipeId(restoredRecipes[0]?.id ?? '');
    closeForm();
  }

  function handleSelectRecipe(recipeId: string) {
    setSelectedRecipeId(recipeId);
    closeForm();
  }

  // Resolves to a sentence when the save did not happen, which keeps the
  // form open with the owner's edits in it.
  async function handleSaveRecipe(recipe: Recipe): Promise<string | void> {
    let saved = recipe;

    if (onServer) {
      try {
        saved = await saveRecipeToServer(recipe);
      } catch (error) {
        if (error instanceof RecipeWriteError) {
          if (error.current) {
            newerCopy.current = error.current;
          }
          return error.message;
        }
        return 'Something went wrong and nothing was saved.';
      }
    }

    newerCopy.current = null;
    putRecipe(saved);
    setSelectedRecipeId(saved.id);
    setIsAddingRecipe(false);
    setEditingRecipeId('');
  }

  async function handleDeleteRecipe(recipeId: string) {
    const recipe = recipes.find((candidate) => candidate.id === recipeId);
    if (!recipe || !window.confirm(`Delete “${recipe.title}”? It disappears for every visitor.`)) {
      return;
    }

    try {
      await deleteRecipeOnServer(recipeId);
    } catch (error) {
      window.alert(error instanceof RecipeWriteError ? error.message : 'Something went wrong and nothing was deleted.');
      return;
    }

    const remaining = recipes.filter((candidate) => candidate.id !== recipeId);
    setRecipes(remaining);
    setSelectedRecipeId(remaining[0]?.id ?? '');
    closeForm();
  }

  function handleAddRecipe() {
    closeForm();
    setIsAddingRecipe(true);
  }

  function handleEditRecipe(recipeId: string) {
    closeForm();
    setSelectedRecipeId(recipeId);
    setEditingRecipeId(recipeId);
  }

  async function handleSignIn(password: string) {
    const problem = await signIn(password);
    if (problem) {
      return problem;
    }
    setIsOwner(true);
    // Drop #signin, so a reload or a shared link is the ordinary page.
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    setShowSignIn(false);
  }

  async function handleSignOut() {
    await signOut();
    setIsOwner(false);
    closeForm();
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
        owner={
          onServer && !isLoading && !apiUnavailable
            ? { isOwner, showSignIn, onSignIn: handleSignIn, onSignOut: handleSignOut }
            : undefined
        }
      />
      {isLoading ? (
        <main className="flex min-h-[50vh] flex-1 items-center justify-center p-8 text-sm font-bold text-stone-500" aria-busy="true">
          Loading recipes…
        </main>
      ) : (!readOnly && isAddingRecipe) || recipeBeingEdited ? (
        <RecipeForm
          key={recipeBeingEdited?.id ?? 'new-recipe'}
          recipe={recipeBeingEdited}
          onCancel={closeForm}
          onSave={handleSaveRecipe}
          allowImageUpload={!onServer}
        />
      ) : (
        selectedRecipe && (
          <RecipeDetail
            recipe={selectedRecipe}
            onEditRecipe={readOnly ? undefined : handleEditRecipe}
            onDeleteRecipe={onServer && !readOnly ? handleDeleteRecipe : undefined}
          />
        )
      )}
    </div>
  );
}
