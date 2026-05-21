import { Check, Image, ListPlus, Save, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { DirectionStep, Ingredient, Recipe } from '../types/recipe';

const placeholderImage =
  'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 1200 630%22%3E%3Crect width=%221200%22 height=%22630%22 fill=%22%23292524%22/%3E%3Ccircle cx=%22940%22 cy=%22156%22 r=%22104%22 fill=%22%23f59e0b%22 opacity=%22.88%22/%3E%3Cpath d=%22M0 462c148-88 312-112 492-72 164 36 306 18 432-54 104-60 196-76 276-48v342H0z%22 fill=%22%23fb923c%22 opacity=%22.82%22/%3E%3Cpath d=%22M0 520c176-72 344-82 504-30 152 50 308 42 468-24 80-34 156-42 228-24v188H0z%22 fill=%22%23fef3c7%22 opacity=%22.92%22/%3E%3Ctext x=%2260%22 y=%22212%22 fill=%22%23fff7ed%22 font-family=%22Inter,Arial,sans-serif%22 font-size=%2276%22 font-weight=%22800%22%3ENext Thyme%3C/text%3E%3Ctext x=%2264%22 y=%22276%22 fill=%22%23fed7aa%22 font-family=%22Inter,Arial,sans-serif%22 font-size=%2234%22 font-weight=%22600%22%3EYour saved recipe%3C/text%3E%3C/svg%3E';

type RecipeFormProps = {
  onCancel: () => void;
  onSave: (recipe: Recipe) => void;
};

export function RecipeForm({ onCancel, onSave }: RecipeFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Dinner');
  const [cuisine, setCuisine] = useState('');
  const [difficulty, setDifficulty] = useState('Easy');
  const [servings, setServings] = useState(4);
  const [yieldLabel, setYieldLabel] = useState('');
  const [prepTimeMinutes, setPrepTimeMinutes] = useState(15);
  const [cookTimeMinutes, setCookTimeMinutes] = useState(30);
  const [ovenTempF, setOvenTempF] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageUploadName, setImageUploadName] = useState('');
  const [ingredientsText, setIngredientsText] = useState('');
  const [directionsText, setDirectionsText] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [equipmentText, setEquipmentText] = useState('');
  const [tipsText, setTipsText] = useState('');
  const [leftoverStorage, setLeftoverStorage] = useState('');
  const [nextTimeNotes, setNextTimeNotes] = useState('');
  const [error, setError] = useState('');

  const totalTimeMinutes = useMemo(() => prepTimeMinutes + cookTimeMinutes, [cookTimeMinutes, prepTimeMinutes]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const ingredients = parseIngredients(ingredientsText);
    const directions = parseDirections(directionsText);

    if (!title.trim() || !description.trim() || ingredients.length === 0 || directions.length === 0) {
      setError('Add a title, description, at least one ingredient, and at least one direction.');
      return;
    }

    const finalImageUrl = imageUrl.trim() || placeholderImage;
    const recipe: Recipe = {
      id: createRecipeId(title),
      title: title.trim(),
      description: description.trim(),
      category: category.trim() || 'Recipe',
      cuisine: cuisine.trim() || 'Home cooking',
      difficulty: difficulty.trim() || 'Easy',
      imageUrl: finalImageUrl,
      imageSmallUrl: finalImageUrl,
      imageAlt: `${title.trim()} recipe`,
      imageCredit: imageUrl.trim() ? 'Custom image' : 'Next Thyme placeholder',
      imageCreditUrl: imageUrl.trim() || '#',
      history: '',
      servings,
      yieldLabel: yieldLabel.trim() || `${servings} servings`,
      prepTimeMinutes,
      cookTimeMinutes,
      totalTimeMinutes,
      ovenTempF: ovenTempF ? Number(ovenTempF) : undefined,
      tags: parseCommaList(tagsText),
      equipment: parseCommaList(equipmentText),
      ingredients,
      directions,
      tips: parseLines(tipsText),
      nutrition: {
        calories: 0,
        protein: 'Not added',
        fat: 'Not added',
        carbohydrates: 'Not added',
      },
      nextTimeNotes: nextTimeNotes.trim() || 'Add a note after you make it once.',
      leftoverStorage: leftoverStorage.trim() || 'Store leftovers in an airtight container in the refrigerator.',
      similarRecipeIds: [],
    };

    onSave(recipe);
  }

  async function handleImageUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      const dataUrl = file.type === 'image/webp' ? await readFileAsDataUrl(file) : await convertImageToWebp(file);
      setImageUrl(dataUrl);
      setImageUploadName(file.name);
      setError('');
    } catch {
      setError('That image could not be uploaded. Try a WebP, JPG, or PNG file.');
    }
  }

  return (
    <main className="min-h-screen flex-1 overflow-y-auto bg-[#f8f4ed] text-stone-950">
      <form onSubmit={handleSubmit} className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-stone-200 pb-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-red-700">New recipe</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-stone-950">Add a Recipe</h1>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onCancel} className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-stone-300 bg-white px-4 text-sm font-bold text-stone-700 transition hover:border-stone-400 hover:bg-stone-50">
              <X size={17} /> Cancel
            </button>
            <button type="submit" className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-red-700 px-4 text-sm font-bold text-white transition hover:bg-red-800">
              <Save size={17} /> Save recipe
            </button>
          </div>
        </div>

        {error && (
          <div role="alert" className="mt-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">
            {error}
          </div>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_22rem]">
          <div className="space-y-6">
            <section className="rounded-md border border-stone-200 bg-white p-5 shadow-sm">
              <h2 className="text-xl font-black text-stone-950">Basics</h2>
              <div className="mt-5 grid gap-4">
                <Field label="Title" htmlFor="recipe-title" required>
                  <input id="recipe-title" value={title} onChange={(event) => setTitle(event.target.value)} className={fieldClassName} />
                </Field>
                <Field label="Description" htmlFor="recipe-description" required>
                  <textarea id="recipe-description" value={description} onChange={(event) => setDescription(event.target.value)} rows={3} className={fieldClassName} />
                </Field>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Category" htmlFor="recipe-category">
                    <select id="recipe-category" value={category} onChange={(event) => setCategory(event.target.value)} className={fieldClassName}>
                      <option>Appetizer</option>
                      <option>Breakfast</option>
                      <option>Dinner</option>
                      <option>Lunch</option>
                      <option>Snack</option>
                    </select>
                  </Field>
                  <Field label="Cuisine" htmlFor="recipe-cuisine">
                    <input id="recipe-cuisine" value={cuisine} onChange={(event) => setCuisine(event.target.value)} className={fieldClassName} />
                  </Field>
                  <Field label="Difficulty" htmlFor="recipe-difficulty">
                    <select id="recipe-difficulty" value={difficulty} onChange={(event) => setDifficulty(event.target.value)} className={fieldClassName}>
                      <option>Easy</option>
                      <option>Medium</option>
                      <option>Project</option>
                    </select>
                  </Field>
                </div>
              </div>
            </section>

            <section className="rounded-md border border-stone-200 bg-white p-5 shadow-sm">
              <h2 className="flex items-center gap-2 text-xl font-black text-stone-950"><ListPlus size={21} /> Ingredients and Directions</h2>
              <div className="mt-5 grid gap-4">
                <Field label="Ingredients" htmlFor="recipe-ingredients" helperText="Each line will become one ingredient." required>
                  <textarea
                    id="recipe-ingredients"
                    value={ingredientsText}
                    onChange={(event) => setIngredientsText(event.target.value)}
                    rows={8}
                    placeholder="2 cups flour&#10;1 tsp kosher salt&#10;3 eggs, beaten"
                    className={fieldClassName}
                  />
                </Field>
                <Field label="Directions" htmlFor="recipe-directions" helperText="Each line will become one step." required>
                  <textarea
                    id="recipe-directions"
                    value={directionsText}
                    onChange={(event) => setDirectionsText(event.target.value)}
                    rows={8}
                    placeholder="Heat the oven to 350°F.&#10;Mix the ingredients.&#10;Bake until golden."
                    className={fieldClassName}
                  />
                </Field>
              </div>
            </section>

            <section className="rounded-md border border-stone-200 bg-white p-5 shadow-sm">
              <h2 className="text-xl font-black text-stone-950">Notes</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Field label="Tips" htmlFor="recipe-tips">
                  <textarea id="recipe-tips" value={tipsText} onChange={(event) => setTipsText(event.target.value)} rows={4} className={fieldClassName} />
                </Field>
                <Field label="Equipment" htmlFor="recipe-equipment">
                  <textarea id="recipe-equipment" value={equipmentText} onChange={(event) => setEquipmentText(event.target.value)} rows={4} placeholder="Dutch oven, whisk, sheet pan" className={fieldClassName} />
                </Field>
                <Field label="Leftover storage" htmlFor="recipe-leftovers">
                  <textarea id="recipe-leftovers" value={leftoverStorage} onChange={(event) => setLeftoverStorage(event.target.value)} rows={3} className={fieldClassName} />
                </Field>
                <Field label="Next time" htmlFor="recipe-next-time">
                  <textarea id="recipe-next-time" value={nextTimeNotes} onChange={(event) => setNextTimeNotes(event.target.value)} rows={3} className={fieldClassName} />
                </Field>
              </div>
            </section>
          </div>

          <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
            <section className="rounded-md border border-stone-200 bg-white p-5 shadow-sm">
              <h2 className="text-xl font-black text-stone-950">Timing</h2>
              <div className="mt-5 grid gap-4">
                <Field label="Servings" htmlFor="recipe-servings">
                  <input id="recipe-servings" type="number" min="1" max="80" value={servings} onChange={(event) => setServings(Math.max(1, Number(event.target.value) || 1))} className={fieldClassName} />
                </Field>
                <Field label="Yield" htmlFor="recipe-yield">
                  <input id="recipe-yield" value={yieldLabel} onChange={(event) => setYieldLabel(event.target.value)} placeholder={`${servings} servings`} className={fieldClassName} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Prep min" htmlFor="recipe-prep">
                    <input id="recipe-prep" type="number" min="0" value={prepTimeMinutes} onChange={(event) => setPrepTimeMinutes(Math.max(0, Number(event.target.value) || 0))} className={fieldClassName} />
                  </Field>
                  <Field label="Cook min" htmlFor="recipe-cook">
                    <input id="recipe-cook" type="number" min="0" value={cookTimeMinutes} onChange={(event) => setCookTimeMinutes(Math.max(0, Number(event.target.value) || 0))} className={fieldClassName} />
                  </Field>
                </div>
                <Field label="Oven °F" htmlFor="recipe-oven">
                  <input id="recipe-oven" type="number" min="0" value={ovenTempF} onChange={(event) => setOvenTempF(event.target.value)} className={fieldClassName} />
                </Field>
                <div className="rounded-md bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">
                  Total time: {totalTimeMinutes} min
                </div>
              </div>
            </section>

            <section className="rounded-md border border-stone-200 bg-white p-5 shadow-sm">
              <h2 className="flex items-center gap-2 text-xl font-black text-stone-950"><Image size={21} /> Image</h2>
              <div className="mt-5 grid gap-4">
                <Field label="Upload image" htmlFor="recipe-image-upload">
                  <input
                    id="recipe-image-upload"
                    type="file"
                    accept="image/webp,.webp,image/png,image/jpeg,image/*"
                    onChange={handleImageUpload}
                    className="mt-2 block w-full text-sm font-medium text-stone-700 file:mr-3 file:h-10 file:rounded-md file:border-0 file:bg-stone-900 file:px-3 file:text-sm file:font-bold file:text-white hover:file:bg-stone-700"
                  />
                  <span className="mt-2 block text-xs font-medium leading-5 text-stone-500">
                    WebP is preferred. JPG and PNG uploads will be saved as WebP when supported.
                  </span>
                  {imageUploadName && (
                    <span className="mt-2 block text-xs font-bold text-emerald-700">
                      Uploaded {imageUploadName}
                    </span>
                  )}
                </Field>
                <Field label="Image URL" htmlFor="recipe-image">
                  <input id="recipe-image" type="url" value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} placeholder="https://..." className={fieldClassName} />
                </Field>
                <img src={imageUrl || placeholderImage} alt="" className="aspect-[16/9] w-full rounded object-cover" />
              </div>
            </section>

            <section className="rounded-md border border-stone-200 bg-white p-5 shadow-sm">
              <h2 className="flex items-center gap-2 text-xl font-black text-stone-950"><Check size={21} /> Tags</h2>
              <Field label="Tags" htmlFor="recipe-tags">
                <textarea id="recipe-tags" value={tagsText} onChange={(event) => setTagsText(event.target.value)} rows={3} placeholder="Weeknight, vegetarian, freezer-friendly" className={fieldClassName} />
              </Field>
            </section>
          </aside>
        </div>
      </form>
    </main>
  );
}

const fieldClassName =
  'mt-2 min-h-11 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-950 outline-none transition placeholder:text-stone-400 focus:border-red-600 focus:ring-2 focus:ring-red-100';

function Field({
  children,
  helperText,
  htmlFor,
  label,
  required = false,
}: {
  children: React.ReactNode;
  helperText?: string;
  htmlFor: string;
  label: string;
  required?: boolean;
}) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-bold text-stone-700">
      {label}
      {required && <span className="text-red-700"> *</span>}
      {helperText && <span className="mt-1 block text-xs font-medium leading-5 text-stone-500">{helperText}</span>}
      {children}
    </label>
  );
}

function parseIngredients(text: string): Ingredient[] {
  return parseLines(text).map((line, index) => {
    const quantityMatch = line.match(/^(\d+(?:\.\d+)?|\d+\/\d+|\d+\s+\d+\/\d+)\s+([^\s,]+)\s+(.+)$/);

    if (!quantityMatch) {
      return {
        id: `custom-i${index + 1}`,
        name: line,
        quantity: 1,
        unit: '',
        section: 'Ingredients',
      };
    }

    return {
      id: `custom-i${index + 1}`,
      name: quantityMatch[3].trim(),
      quantity: parseQuantity(quantityMatch[1]),
      unit: quantityMatch[2].trim(),
      section: 'Ingredients',
    };
  });
}

function parseDirections(text: string): DirectionStep[] {
  return parseLines(text).map((line, index) => ({
    id: `custom-s${index + 1}`,
    order: index + 1,
    instruction: line.replace(/^\d+[.)]\s*/, ''),
  }));
}

function parseLines(text: string) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseCommaList(text: string) {
  return text
    .split(/,|\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseQuantity(value: string) {
  const mixedMatch = value.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixedMatch) {
    return Number(mixedMatch[1]) + Number(mixedMatch[2]) / Number(mixedMatch[3]);
  }

  const fractionMatch = value.match(/^(\d+)\/(\d+)$/);
  if (fractionMatch) {
    return Number(fractionMatch[1]) / Number(fractionMatch[2]);
  }

  return Number(value);
}

function createRecipeId(title: string) {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const suffix = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().slice(0, 8) : `${Date.now()}`;

  return `custom-${slug || 'recipe'}-${suffix}`;
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function convertImageToWebp(file: File) {
  const sourceUrl = await readFileAsDataUrl(file);
  const image = await loadImage(sourceUrl);
  const canvas = document.createElement('canvas');
  const maxWidth = 1200;
  const scale = Math.min(1, maxWidth / image.naturalWidth);

  canvas.width = Math.round(image.naturalWidth * scale);
  canvas.height = Math.round(image.naturalHeight * scale);
  canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);

  return canvas.toDataURL('image/webp', 0.86);
}

function loadImage(sourceUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = document.createElement('img');
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Image could not be loaded.'));
    image.src = sourceUrl;
  });
}
