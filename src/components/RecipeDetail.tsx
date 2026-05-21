import { useEffect, useMemo, useState } from 'react';
import type React from 'react';
import {
  BookOpen,
  Check,
  ChefHat,
  ClipboardList,
  Copy,
  Flame,
  Printer,
  Scale,
  Soup,
  Timer,
  Utensils,
} from 'lucide-react';
import type { Ingredient, Recipe } from '../types/recipe';
import { formatIngredientAmount, scaleIngredient } from '../utils/scaleIngredient';

type RecipeDetailProps = {
  recipe: Recipe;
};

export function RecipeDetail({ recipe }: RecipeDetailProps) {
  const [desiredServings, setDesiredServings] = useState(recipe.servings);
  const [checkedIngredientIds, setCheckedIngredientIds] = useState<string[]>([]);
  const [activeStepId, setActiveStepId] = useState(recipe.directions[0]?.id ?? '');

  useEffect(() => {
    setDesiredServings(recipe.servings);
    setCheckedIngredientIds([]);
    setActiveStepId(recipe.directions[0]?.id ?? '');
  }, [recipe]);

  const scaledIngredients = useMemo(
    () => recipe.ingredients.map((ingredient) => scaleIngredient(ingredient, recipe.servings, desiredServings)),
    [recipe.ingredients, recipe.servings, desiredServings],
  );

  const ingredientSections = useMemo(() => groupIngredientsBySection(scaledIngredients), [scaledIngredients]);

  const shoppingList = scaledIngredients
    .map((ingredient) => `- ${formatIngredientAmount(ingredient)} ${ingredient.name}${ingredient.notes ? ` (${ingredient.notes})` : ''}`)
    .join('\n');

  async function copyShoppingList() {
    await navigator.clipboard.writeText(shoppingList);
  }

  function printRecipe() {
    window.print();
  }

  function toggleIngredient(ingredientId: string) {
    setCheckedIngredientIds((currentIds) =>
      currentIds.includes(ingredientId)
        ? currentIds.filter((id) => id !== ingredientId)
        : [...currentIds, ingredientId],
    );
  }

  return (
    <main className="min-h-screen flex-1 bg-[#f8f4ed] text-stone-950 lg:overflow-y-auto print:bg-white">
      <article aria-labelledby="recipe-title">
      <section className="relative min-h-[360px] overflow-hidden bg-stone-950 text-white sm:min-h-[400px] lg:min-h-[430px]">
        <img
          src={recipe.imageUrl}
          srcSet={`${recipe.imageSmallUrl} 640w, ${recipe.imageUrl} 1200w`}
          sizes="100vw"
          alt={recipe.imageAlt}
          width="1200"
          height="630"
          fetchPriority="high"
          loading="eager"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover opacity-55"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-stone-950 via-stone-950/70 to-stone-950/15" />
        <a
          href={recipe.imageCreditUrl}
          target="_blank"
          rel="noreferrer"
          className="absolute bottom-2 right-3 z-10 rounded bg-stone-950/65 px-2 py-1 text-[11px] font-medium text-white/85 underline-offset-2 hover:underline sm:bottom-3 sm:right-4 print:hidden"
        >
          {recipe.imageCredit}
        </a>
        <div className="relative mx-auto flex min-h-[360px] max-w-6xl flex-col justify-end px-4 pb-16 pt-16 sm:min-h-[400px] sm:px-6 sm:pb-8 lg:min-h-[430px] lg:px-8">
          <div className="max-w-3xl">
            <div className="flex flex-wrap gap-2">
              {[recipe.category, recipe.cuisine, recipe.difficulty].map((tag) => (
                <span key={tag} className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-white backdrop-blur">
                  {tag}
                </span>
              ))}
            </div>
            <h1 id="recipe-title" className="mt-5 text-4xl font-black leading-tight tracking-tight text-white md:text-5xl lg:text-6xl">
              {recipe.title}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-stone-100 md:text-lg">{recipe.description}</p>
            <div className="mt-6 grid gap-3 sm:flex sm:flex-wrap print:hidden">
              <button onClick={copyShoppingList} className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-white px-4 py-3 text-sm font-bold text-stone-950 shadow-sm transition hover:bg-amber-100 sm:w-auto">
                <Copy size={17} /> Copy ingredients
              </button>
              <button onClick={printRecipe} className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-white/50 bg-white/10 px-4 py-3 text-sm font-bold text-white backdrop-blur transition hover:bg-white/20 sm:w-auto">
                <Printer size={17} /> Print recipe
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-5 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-3 rounded-md border border-stone-200 bg-white p-3 shadow-sm md:grid-cols-3 lg:grid-cols-5 print:shadow-none">
          <Stat icon={<Utensils size={18} />} label="Serves" value={`${desiredServings}`} />
          <Stat icon={<ClipboardList size={18} />} label="Yield" value={recipe.yieldLabel} />
          <Stat icon={<Timer size={18} />} label="Prep" value={`${recipe.prepTimeMinutes} min`} />
          <Stat icon={<Soup size={18} />} label="Cook" value={`${recipe.cookTimeMinutes} min`} />
          <Stat icon={<Flame size={18} />} label="Oven" value={recipe.ovenTempF ? `${recipe.ovenTempF}°F` : 'Stovetop'} />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(280px,0.82fr)_minmax(0,1.18fr)]">
          <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start print:static">
            <section className="rounded-md border border-stone-200 bg-white p-5 shadow-sm print:hidden">
              <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.12em] text-red-700">
                <Scale size={17} /> Scale servings
              </div>
              <div className="mt-4 grid gap-3 sm:flex sm:items-center">
                <input
                  id="servings"
                  type="number"
                  min="1"
                  max="40"
                  value={desiredServings}
                  onChange={(event) => setDesiredServings(Math.max(1, Number(event.target.value) || 1))}
                  className="h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-lg font-bold text-stone-950 outline-none focus:border-red-600 sm:w-24"
                />
                <label htmlFor="servings" className="text-sm leading-6 text-stone-600">
                  servings. Ingredient amounts update automatically.
                </label>
              </div>
            </section>

            <section className="rounded-md border border-stone-200 bg-white p-5 shadow-sm">
              <h2 className="flex items-center gap-2 text-xl font-black text-stone-950">
                <ChefHat size={21} /> Ingredients
              </h2>
              <div className="mt-5 space-y-6">
                {ingredientSections.map(([section, ingredients]) => (
                  <div key={section}>
                    <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-stone-500">{section}</h3>
                    <ul className="mt-3 space-y-2">
                      {ingredients.map((ingredient) => {
                        const isChecked = checkedIngredientIds.includes(ingredient.id);
                        return (
                          <li key={ingredient.id}>
                            <button
                              type="button"
                              onClick={() => toggleIngredient(ingredient.id)}
                              aria-pressed={isChecked}
                              className={`flex w-full items-start gap-3 rounded-md border px-3 py-3 text-left transition ${
                                isChecked ? 'border-emerald-200 bg-emerald-50 text-stone-500' : 'border-stone-200 bg-stone-50 text-stone-800 hover:border-red-300'
                              }`}
                            >
                              <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${isChecked ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-stone-300 bg-white'}`}>
                                {isChecked && <Check size={14} />}
                              </span>
                              <span className={isChecked ? 'line-through' : ''}>
                                <strong>{formatIngredientAmount(ingredient)}</strong> {ingredient.name}
                                {ingredient.notes && <span className="block text-sm text-stone-500">{ingredient.notes}</span>}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          </aside>

          <div className="space-y-6">
            <section className="rounded-md border border-stone-200 bg-white p-5 shadow-sm sm:p-7">
              <div>
                <div>
                  <h2 className="flex items-center gap-2 text-2xl font-black text-stone-950">
                    <BookOpen size={23} /> Directions
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-stone-600">
                    Total time is about {recipe.totalTimeMinutes} minutes. Select a step to keep your place while cooking.
                  </p>
                </div>
              </div>

              <ol className="mt-6 space-y-3">
                {recipe.directions.map((step) => {
                  const isActive = step.id === activeStepId;
                  return (
                    <li key={step.id}>
                      <button
                        type="button"
                        onClick={() => setActiveStepId(step.id)}
                        aria-current={isActive ? 'step' : undefined}
                        className={`grid w-full grid-cols-[2rem_1fr] gap-3 rounded-md border p-4 text-left transition sm:grid-cols-[2.25rem_1fr] sm:gap-4 ${
                          isActive ? 'border-red-500 bg-red-50' : 'border-stone-200 bg-white hover:border-amber-300 hover:bg-amber-50'
                        }`}
                      >
                        <span className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-black ${isActive ? 'bg-red-700 text-white' : 'bg-stone-900 text-white'}`}>
                          {step.order}
                        </span>
                        <span className="pt-1 leading-7 text-stone-700">{step.instruction}</span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </section>

            <section className="grid gap-6 md:grid-cols-2">
              <Panel title="Cook's Notes" items={recipe.tips} />
              <section className="rounded-md border border-stone-200 bg-white p-5 shadow-sm">
                <h2 className="text-xl font-black text-stone-950">Nutrition Snapshot</h2>
                <dl className="mt-4 grid grid-cols-2 gap-3">
                  <Nutrition label="Calories" value={`${recipe.nutrition.calories}`} />
                  <Nutrition label="Protein" value={recipe.nutrition.protein} />
                  <Nutrition label="Fat" value={recipe.nutrition.fat} />
                  <Nutrition label="Carbs" value={recipe.nutrition.carbohydrates} />
                </dl>
              </section>
            </section>

            <section className="grid gap-6 md:grid-cols-3">
              <InfoBlock title="Equipment" content={recipe.equipment.join(', ')} />
              <InfoBlock title="Leftover Storage" content={recipe.leftoverStorage} />
              <InfoBlock title="Next Time" content={recipe.nextTimeNotes} />
            </section>
          </div>
        </div>
      </section>
      </article>
    </main>
  );
}

function groupIngredientsBySection(ingredients: Ingredient[]) {
  return ingredients.reduce<Array<[string, Ingredient[]]>>((sections, ingredient) => {
    const sectionName = ingredient.section ?? 'Ingredients';
    const existingSection = sections.find(([name]) => name === sectionName);

    if (existingSection) {
      existingSection[1].push(ingredient);
    } else {
      sections.push([sectionName, [ingredient]]);
    }

    return sections;
  }, []);
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-md bg-stone-50 px-4 py-3">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-stone-500">{icon}{label}</div>
      <div className="mt-2 text-lg font-black leading-tight text-stone-950">{value}</div>
    </div>
  );
}

function Panel({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="rounded-md border border-stone-200 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-black text-stone-950">{title}</h2>
      <ul className="mt-4 space-y-3">
        {items.map((item) => (
          <li key={item} className="flex gap-3 leading-6 text-stone-700">
            <Check size={18} className="mt-0.5 shrink-0 text-emerald-700" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Nutrition({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-amber-50 px-4 py-3">
      <dt className="text-xs font-bold uppercase tracking-[0.12em] text-amber-800">{label}</dt>
      <dd className="mt-1 text-xl font-black text-stone-950">{value}</dd>
    </div>
  );
}

function InfoBlock({ title, content }: { title: string; content: string }) {
  return (
    <section className="rounded-md border border-stone-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-black text-stone-950">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-stone-600">{content}</p>
    </section>
  );
}
