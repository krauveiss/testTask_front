export const PRODUCT_CATEGORIES = [
  "Замороженный",
  "Мясной",
  "Овощи",
  "Зелень",
  "Специи",
  "Крупы",
  "Консервы",
  "Жидкость",
  "Сладости",
] as const;

export const DISH_CATEGORIES = [
  "Десерт",
  "Первое",
  "Второе",
  "Напиток",
  "Салат",
  "Суп",
  "Перекус",
] as const;

export const COOKING_REQUIREMENTS = [
  "Готовый к употреблению",
  "Полуфабрикат",
  "Требует приготовления",
] as const;

export const FLAG_KEYS = ["vegan", "gluten_free", "sugar_free"] as const;

export const FLAG_LABELS: Record<FlagKey, string> = {
  vegan: "Веган",
  gluten_free: "Без глютена",
  sugar_free: "Без сахара",
};

export const DISH_MACROS = [
  { macro: "!десерт", category: "Десерт" },
  { macro: "!первое", category: "Первое" },
  { macro: "!второе", category: "Второе" },
  { macro: "!напиток", category: "Напиток" },
  { macro: "!салат", category: "Салат" },
  { macro: "!суп", category: "Суп" },
  { macro: "!перекус", category: "Перекус" },
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];
export type DishCategory = (typeof DISH_CATEGORIES)[number];
export type CookingRequirement = (typeof COOKING_REQUIREMENTS)[number];
export type FlagKey = (typeof FLAG_KEYS)[number];

export interface Flags {
  vegan: boolean;
  gluten_free: boolean;
  sugar_free: boolean;
}

export interface Nutrition {
  calories: number;
  proteins: number;
  fats: number;
  carbohydrates: number;
}

export interface Product {
  id: number;
  name: string;
  photos: string[];
  calories: number;
  proteins: number;
  fats: number;
  carbohydrates: number;
  composition: string | null;
  category: ProductCategory;
  cooking_requirement: CookingRequirement;
  flags: Flags;
  created_at: string;
  updated_at: string | null;
}

export interface DishIngredient {
  product_id: number;
  product_name: string;
  quantity: number;
  product_category: ProductCategory;
  product_flags: Flags;
}

export interface Dish {
  id: number;
  name: string;
  photos: string[];
  calories: number;
  proteins: number;
  fats: number;
  carbohydrates: number;
  calculated_nutrition: Nutrition;
  portion_size: number;
  category: DishCategory;
  flags: Flags;
  available_flags: Flags;
  ingredients: DishIngredient[];
  created_at: string;
  updated_at: string | null;
}

export interface ProductFilters {
  search: string;
  category: string;
  cooking_requirement: string;
  sort_by: "name" | "calories" | "proteins" | "fats" | "carbohydrates";
  sort_direction: "asc" | "desc";
  vegan: boolean;
  gluten_free: boolean;
  sugar_free: boolean;
}

export interface DishFilters {
  search: string;
  category: string;
  vegan: boolean;
  gluten_free: boolean;
  sugar_free: boolean;
}

export interface ProductMutationInput {
  name: string;
  photos: Array<string | File>;
  calories: number;
  proteins: number;
  fats: number;
  carbohydrates: number;
  composition: string | null;
  category: ProductCategory;
  cooking_requirement: CookingRequirement;
  flags: Flags;
}

export interface DishMutationIngredientInput {
  product_id: number;
  quantity: number;
}

export interface DishMutationInput {
  name: string;
  photos: Array<string | File>;
  calories: number | null;
  proteins: number | null;
  fats: number | null;
  carbohydrates: number | null;
  ingredients: DishMutationIngredientInput[];
  portion_size: number;
  category: DishCategory | null;
  flags: Flags;
}

export interface ApiFieldErrors {
  [field: string]: string[];
}

export interface PhotoDraft {
  id: string;
  kind: "remote" | "file";
  value: string | File;
  previewUrl: string;
  label: string;
}

export interface BlockingDish {
  id: number;
  name: string;
}

