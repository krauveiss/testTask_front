import { API_BASE_URL } from "../config";
import type {
  ApiFieldErrors,
  Dish,
  DishFilters,
  DishMutationInput,
  Product,
  ProductFilters,
  ProductMutationInput,
} from "../types";

interface RequestErrorOptions {
  status: number;
  message: string;
  fields?: ApiFieldErrors;
  payload?: unknown;
}

export class ApiError extends Error {
  status: number;
  fields?: ApiFieldErrors;
  payload?: unknown;

  constructor(options: RequestErrorOptions) {
    super(options.message);
    this.name = "ApiError";
    this.status = options.status;
    this.fields = options.fields;
    this.payload = options.payload;
  }
}

export const api = {
  listProducts(filters: ProductFilters): Promise<Product[]> {
    return request<Product[]>(`/products${toQueryString(filters)}`);
  },
  createProduct(input: ProductMutationInput): Promise<Product> {
    return request<Product>("/products", {
      method: "POST",
      body: buildProductFormData(input),
    });
  },
  updateProduct(id: number, input: ProductMutationInput): Promise<Product> {
    return request<Product>(`/products/${id}`, {
      method: "POST",
      body: buildProductFormData(input, {
        methodOverride: "PUT",
      }),
    });
  },
  deleteProduct(id: number): Promise<void> {
    return request<void>(`/products/${id}`, {
      method: "DELETE",
    });
  },
  listDishes(filters: DishFilters): Promise<Dish[]> {
    return request<Dish[]>(`/dishes${toQueryString(filters)}`);
  },
  createDish(input: DishMutationInput): Promise<Dish> {
    return request<Dish>("/dishes", {
      method: "POST",
      body: buildDishFormData(input),
    });
  },
  updateDish(id: number, input: DishMutationInput): Promise<Dish> {
    return request<Dish>(`/dishes/${id}`, {
      method: "POST",
      body: buildDishFormData(input, {
        methodOverride: "PUT",
      }),
    });
  },
  deleteDish(id: number): Promise<void> {
    return request<void>(`/dishes/${id}`, {
      method: "DELETE",
    });
  },
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = await response
    .json()
    .catch(() => null) as { data?: T; message?: string; errors?: ApiFieldErrors } | null;

  if (!response.ok) {
    throw new ApiError({
      status: response.status,
      message: payload?.message ?? `Ошибка запроса (${response.status})`,
      fields: payload?.errors,
      payload,
    });
  }

  return (payload?.data ?? payload) as T;
}

function toQueryString(filters: object): string {
  const params = new URLSearchParams();

  Object.entries(filters as Record<string, string | boolean>).forEach(([key, value]) => {
    if (typeof value === "boolean") {
      if (value) {
        params.set(key, "1");
      }

      return;
    }

    if (value.trim() !== "") {
      params.set(key, value);
    }
  });

  const query = params.toString();

  return query ? `?${query}` : "";
}

function buildProductFormData(
  input: ProductMutationInput,
  options?: { methodOverride?: "PUT" },
): FormData {
  const formData = new FormData();

  applyMethodOverride(formData, options);

  formData.set("name", input.name);
  appendPhotos(formData, input.photos);
  formData.set("calories", String(input.calories));
  formData.set("proteins", String(input.proteins));
  formData.set("fats", String(input.fats));
  formData.set("carbohydrates", String(input.carbohydrates));

  if (input.composition) {
    formData.set("composition", input.composition);
  }

  formData.set("category", input.category);
  formData.set("cooking_requirement", input.cooking_requirement);
  appendFlags(formData, input.flags);

  return formData;
}

function buildDishFormData(
  input: DishMutationInput,
  options?: { methodOverride?: "PUT" },
): FormData {
  const formData = new FormData();

  applyMethodOverride(formData, options);

  formData.set("name", input.name);
  appendPhotos(formData, input.photos);

  if (input.calories !== null) {
    formData.set("calories", String(input.calories));
  }

  if (input.proteins !== null) {
    formData.set("proteins", String(input.proteins));
  }

  if (input.fats !== null) {
    formData.set("fats", String(input.fats));
  }

  if (input.carbohydrates !== null) {
    formData.set("carbohydrates", String(input.carbohydrates));
  }

  input.ingredients.forEach((ingredient, index) => {
    formData.set(`ingredients[${index}][product_id]`, String(ingredient.product_id));
    formData.set(`ingredients[${index}][quantity]`, String(ingredient.quantity));
  });

  formData.set("portion_size", String(input.portion_size));

  if (input.category) {
    formData.set("category", input.category);
  }

  appendFlags(formData, input.flags);

  return formData;
}

function appendPhotos(formData: FormData, photos: Array<string | File>): void {
  photos.forEach((photo) => {
    formData.append("photos[]", photo);
  });
}

function appendFlags(
  formData: FormData,
  flags: { vegan: boolean; gluten_free: boolean; sugar_free: boolean },
): void {
  formData.set("flags[vegan]", flags.vegan ? "1" : "0");
  formData.set("flags[gluten_free]", flags.gluten_free ? "1" : "0");
  formData.set("flags[sugar_free]", flags.sugar_free ? "1" : "0");
}

function applyMethodOverride(
  formData: FormData,
  options?: { methodOverride?: "PUT" },
): void {
  if (!options?.methodOverride) {
    return;
  }

  formData.set("_method", options.methodOverride);
}
