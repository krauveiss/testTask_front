import {
  DISH_MACROS,
  FLAG_KEYS,
  type ApiFieldErrors,
  type DishCategory,
  type DishMutationIngredientInput,
  type Flags,
  type Nutrition,
  type PhotoDraft,
  type Product,
} from "../types";

let photoDraftSeed = 0;

export function createEmptyFlags(): Flags {
  return {
    vegan: false,
    gluten_free: false,
    sugar_free: false,
  };
}

export function roundToTwo(value: number): number {
  return Math.round(value * 100) / 100;
}

export function parseNumberInput(value: string | number | null | undefined): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const normalized = value.replace(",", ".").trim();
    const parsed = Number(normalized);

    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

export function parseOptionalNumberInput(
  value: string | number | null | undefined,
): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const normalized = value.replace(",", ".").trim();

  if (normalized === "") {
    return null;
  }

  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : null;
}

export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return "0";
  }

  return roundToTwo(value)
    .toFixed(2)
    .replace(/\.00$/, "")
    .replace(/(\.\d)0$/, "$1");
}

export function validateProductNutrition(
  proteins: number,
  fats: number,
  carbohydrates: number,
): boolean {
  return roundToTwo(proteins + fats + carbohydrates) <= 100;
}

export function validateDishNutrition(
  proteins: number,
  fats: number,
  carbohydrates: number,
  portionSize: number,
): boolean {
  return roundToTwo(proteins + fats + carbohydrates) <= portionSize;
}

export function normalizeDishName(name: string): string {
  const pattern = new RegExp(
    `(${DISH_MACROS.map(({ macro }) => escapeRegExp(macro)).join("|")})`,
    "giu",
  );

  return name
    .replace(pattern, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function detectDishMacroCategory(name: string): DishCategory | null {
  const normalizedName = name.toLowerCase();
  let firstIndex = Number.POSITIVE_INFINITY;
  let category: DishCategory | null = null;

  for (const item of DISH_MACROS) {
    const index = normalizedName.indexOf(item.macro);

    if (index >= 0 && index < firstIndex) {
      firstIndex = index;
      category = item.category;
    }
  }

  return category;
}

export function buildDishDraft(
  name: string,
  category: DishCategory | null,
  ingredients: DishMutationIngredientInput[],
  productsById: Map<number, Product>,
): {
  normalized_name: string;
  macro_category: DishCategory | null;
  effective_category: DishCategory | null;
  calculated_nutrition: Nutrition;
  available_flags: Flags;
} {
  const totals: Nutrition = {
    calories: 0,
    proteins: 0,
    fats: 0,
    carbohydrates: 0,
  };

  const availableFlags: Flags = {
    vegan: ingredients.length > 0,
    gluten_free: ingredients.length > 0,
    sugar_free: ingredients.length > 0,
  };

  for (const ingredient of ingredients) {
    const product = productsById.get(ingredient.product_id);

    if (!product) {
      continue;
    }

    totals.calories += (product.calories * ingredient.quantity) / 100;
    totals.proteins += (product.proteins * ingredient.quantity) / 100;
    totals.fats += (product.fats * ingredient.quantity) / 100;
    totals.carbohydrates += (product.carbohydrates * ingredient.quantity) / 100;

    availableFlags.vegan = availableFlags.vegan && product.flags.vegan;
    availableFlags.gluten_free =
      availableFlags.gluten_free && product.flags.gluten_free;
    availableFlags.sugar_free =
      availableFlags.sugar_free && product.flags.sugar_free;
  }

  const macroCategory = detectDishMacroCategory(name);

  return {
    normalized_name: normalizeDishName(name),
    macro_category: macroCategory,
    effective_category: category ?? macroCategory,
    calculated_nutrition: {
      calories: roundToTwo(totals.calories),
      proteins: roundToTwo(totals.proteins),
      fats: roundToTwo(totals.fats),
      carbohydrates: roundToTwo(totals.carbohydrates),
    },
    available_flags: availableFlags,
  };
}

export function clampFlags(flags: Flags, availableFlags: Flags): Flags {
  return {
    vegan: availableFlags.vegan ? flags.vegan : false,
    gluten_free: availableFlags.gluten_free ? flags.gluten_free : false,
    sugar_free: availableFlags.sugar_free ? flags.sugar_free : false,
  };
}

export function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function getFieldError(
  errors: ApiFieldErrors | null | undefined,
  field: string,
): string | undefined {
  if (!errors) {
    return undefined;
  }

  if (errors[field]?.[0]) {
    return errors[field][0];
  }

  const nestedKey = Object.keys(errors).find((key) => key.startsWith(`${field}.`));

  return nestedKey ? errors[nestedKey]?.[0] : undefined;
}

export function hasAnyFlag(flags: Flags): boolean {
  return FLAG_KEYS.some((flag) => flags[flag]);
}

export function createPhotoDraftsFromFiles(files: FileList | File[]): PhotoDraft[] {
  return Array.from(files).map((file) => ({
    id: `photo-${photoDraftSeed += 1}`,
    kind: "file",
    value: file,
    previewUrl: URL.createObjectURL(file),
    label: file.name,
  }));
}

export function createPhotoDraftFromUrl(url: string): PhotoDraft {
  return {
    id: `photo-${photoDraftSeed += 1}`,
    kind: "remote",
    value: url,
    previewUrl: url,
    label: "Ссылка",
  };
}

export function createPhotoDraftsFromUrls(urls: string[]): PhotoDraft[] {
  return urls.map((url) => createPhotoDraftFromUrl(url));
}

export function validatePhotos(
  photos: PhotoDraft[],
  options?: { allowRemote?: boolean },
): string | undefined {
  const allowRemote = options?.allowRemote ?? true;

  if (photos.length > 5) {
    return "Можно добавить не более 5 фотографий.";
  }

  for (const photo of photos) {
    if (photo.kind === "remote") {
      if (!allowRemote) {
        return "Для этого типа сущности разрешены только файлы изображений.";
      }

      if (String(photo.value).trim() === "") {
        return "Каждая ссылка на фото должна быть непустой.";
      }
    }

    if (photo.kind === "file") {
      const file = photo.value as File;

      if (!file.type.startsWith("image/")) {
        return "Каждый загружаемый файл должен быть изображением.";
      }
    }
  }

  return undefined;
}

export function photoDraftsToPayload(photos: PhotoDraft[]): Array<string | File> {
  return photos
    .map((photo) => {
      if (photo.kind === "file") {
        return photo.value as File;
      }

      return String(photo.value).trim();
    })
    .filter((photo) => {
      if (typeof photo === "string") {
        return photo.length > 0;
      }

      return true;
    });
}

export function releasePhotoDrafts(photos: PhotoDraft[]): void {
  for (const photo of photos) {
    if (photo.kind === "file") {
      URL.revokeObjectURL(photo.previewUrl);
    }
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
