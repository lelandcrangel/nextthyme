import type { Recipe } from '../types/recipe';
import { Clock, Plus, RotateCcw, Search, Users } from 'lucide-react';
import { useMemo, useState } from 'react';

type RecipeListProps = {
  recipes: Recipe[];
  selectedRecipeId: string;
  onSelectRecipe: (recipeId: string) => void;
  onAddRecipe: () => void;
  onRestoreRecipes: () => void;
  showRestoreRecipes: boolean;
};

export function RecipeList({
  recipes,
  selectedRecipeId,
  onSelectRecipe,
  onAddRecipe,
  onRestoreRecipes,
  showRestoreRecipes,
}: RecipeListProps) {
  const [query, setQuery] = useState('');
  const filteredRecipes = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return recipes;
    }

    return recipes.filter((recipe) =>
      [recipe.title, recipe.description, recipe.category, recipe.cuisine, ...recipe.tags]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [query, recipes]);

  return (
    <aside aria-label="Recipe box" className="border-b border-stone-200 bg-white px-4 py-4 sm:px-5 lg:h-screen lg:w-80 lg:shrink-0 lg:overflow-y-auto lg:border-b-0 lg:border-r">
      <div className="mx-auto flex max-w-6xl items-start justify-between gap-3 lg:block lg:max-w-none">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-red-700">Next Thyme</p>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-stone-950">Recipe Box</h1>
        </div>
        <div className="flex shrink-0 gap-2 lg:mt-4 lg:grid">
          <button
            type="button"
            onClick={onAddRecipe}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-red-700 px-3 text-sm font-bold text-white transition hover:bg-red-800 lg:w-full"
          >
            <Plus size={16} />
            <span className="hidden sm:inline lg:inline">Add recipe</span>
          </button>
          {showRestoreRecipes && (
            <button
              type="button"
              onClick={onRestoreRecipes}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-stone-200 bg-stone-50 px-3 text-sm font-bold text-stone-700 transition hover:border-red-300 hover:bg-red-50 lg:w-full"
            >
              <RotateCcw size={16} />
              <span className="hidden sm:inline lg:inline">Restore samples</span>
            </button>
          )}
        </div>
      </div>

      <label htmlFor="recipe-search" className="mx-auto mt-4 flex h-11 max-w-6xl items-center gap-2 rounded-md border border-stone-200 bg-stone-50 px-3 text-sm text-stone-500 lg:max-w-none">
        <Search size={16} />
        <input
          id="recipe-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search saved recipes"
          className="min-w-0 flex-1 bg-transparent text-sm font-medium text-stone-900 outline-none placeholder:text-stone-500"
        />
      </label>

      <div aria-label="Saved recipes" className="mx-auto mt-4 max-w-6xl overflow-x-auto pb-2 lg:max-w-none lg:overflow-visible lg:pb-0">
        <div className="flex gap-3 lg:block lg:space-y-3">
          {filteredRecipes.length === 0 && (
            <div className="w-72 shrink-0 rounded-md border border-stone-200 bg-stone-50 p-4 text-sm leading-6 text-stone-600 lg:w-full">
              No recipes match that search.
            </div>
          )}

          {filteredRecipes.map((recipe) => {
            const isSelected = recipe.id === selectedRecipeId;
            return (
              <button
                key={recipe.id}
                type="button"
                onClick={() => onSelectRecipe(recipe.id)}
                aria-current={isSelected ? 'true' : undefined}
                className={`w-72 shrink-0 rounded-md border p-3 text-left transition lg:w-full ${
                  isSelected ? 'border-red-500 bg-red-50 shadow-sm' : 'border-stone-200 bg-white hover:border-amber-300 hover:bg-amber-50'
                }`}
              >
                <img
                  src={recipe.imageSmallUrl}
                  srcSet={`${recipe.imageSmallUrl} 640w, ${recipe.imageUrl} 1200w`}
                  sizes="(min-width: 1024px) 288px, 288px"
                  alt={recipe.imageAlt}
                  width="640"
                  height="336"
                  loading="lazy"
                  decoding="async"
                  className="aspect-[16/9] w-full rounded object-cover"
                />
                <div className="mt-3 text-lg font-black leading-tight text-stone-950">{recipe.title}</div>
                <p className="mt-2 line-clamp-2 text-sm leading-5 text-stone-600">{recipe.description}</p>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-bold uppercase tracking-[0.08em] text-stone-500">
                  <span className="inline-flex items-center gap-1"><Users size={14} /> {recipe.servings}</span>
                  <span className="inline-flex items-center gap-1"><Clock size={14} /> {recipe.totalTimeMinutes} min</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
