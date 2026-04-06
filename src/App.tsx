import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "./lib/api";
import { DishSection } from "./components/DishSection";
import { ProductSection } from "./components/ProductSection";
import type {
  Dish,
  DishFilters,
  DishMutationInput,
  Product,
  ProductFilters,
  ProductMutationInput,
} from "./types";
import { Badge } from "./components/ui";

const defaultProductFilters: ProductFilters = {
  search: "",
  category: "",
  cooking_requirement: "",
  sort_by: "name",
  sort_direction: "asc",
  vegan: false,
  gluten_free: false,
  sugar_free: false,
};

const defaultDishFilters: DishFilters = {
  search: "",
  category: "",
  vegan: false,
  gluten_free: false,
  sugar_free: false,
};

type ActiveSection = "products" | "dishes";

interface NoticeState {
  tone: "success" | "error";
  message: string;
}

export default function App() {
  const [activeSection, setActiveSection] = useState<ActiveSection>("products");
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [catalogProducts, setCatalogProducts] = useState<Product[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [productFilters, setProductFilters] =
    useState<ProductFilters>(defaultProductFilters);
  const [dishFilters, setDishFilters] = useState<DishFilters>(defaultDishFilters);
  const [productsLoading, setProductsLoading] = useState(true);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [dishesLoading, setDishesLoading] = useState(true);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [dishesError, setDishesError] = useState<string | null>(null);

  const loadCatalogProducts = useCallback(async () => {
    setCatalogLoading(true);

    try {
      const allProducts = await api.listProducts(defaultProductFilters);
      setCatalogProducts(allProducts);
    } catch (errorValue) {
      setNotice({
        tone: "error",
        message:
          errorValue instanceof Error
            ? errorValue.message
            : "Не удалось получить каталог продуктов.",
      });
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  const loadProducts = useCallback(async (filters: ProductFilters) => {
    setProductsLoading(true);
    setProductsError(null);

    try {
      setProducts(await api.listProducts(filters));
    } catch (errorValue) {
      setProductsError(
        errorValue instanceof Error
          ? errorValue.message
          : "Не удалось загрузить список продуктов.",
      );
    } finally {
      setProductsLoading(false);
    }
  }, []);

  const loadDishes = useCallback(async (filters: DishFilters) => {
    setDishesLoading(true);
    setDishesError(null);

    try {
      setDishes(await api.listDishes(filters));
    } catch (errorValue) {
      setDishesError(
        errorValue instanceof Error
          ? errorValue.message
          : "Не удалось загрузить список блюд.",
      );
    } finally {
      setDishesLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCatalogProducts();
  }, [loadCatalogProducts]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadProducts(productFilters);
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [loadProducts, productFilters]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadDishes(dishFilters);
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [dishFilters, loadDishes]);

  const totalProducts = catalogProducts.length;
  const totalDishes = dishes.length;
  const totalFlags = useMemo(
    () =>
      catalogProducts.filter(
        (product) =>
          product.flags.vegan || product.flags.gluten_free || product.flags.sugar_free,
      ).length,
    [catalogProducts],
  );

  const refreshProductsAndDishes = useCallback(async () => {
    await Promise.all([
      loadCatalogProducts(),
      loadProducts(productFilters),
      loadDishes(dishFilters),
    ]);
  }, [dishFilters, loadCatalogProducts, loadDishes, loadProducts, productFilters]);

  const refreshOnlyDishes = useCallback(async () => {
    await loadDishes(dishFilters);
  }, [dishFilters, loadDishes]);

  const createProduct = useCallback(
    async (payload: ProductMutationInput) => {
      await api.createProduct(payload);
      await refreshProductsAndDishes();
      setNotice({ tone: "success", message: "Продукт сохранён." });
    },
    [refreshProductsAndDishes],
  );

  const updateProduct = useCallback(
    async (id: number, payload: ProductMutationInput) => {
      await api.updateProduct(id, payload);
      await refreshProductsAndDishes();
      setNotice({ tone: "success", message: "Продукт обновлён." });
    },
    [refreshProductsAndDishes],
  );

  const deleteProduct = useCallback(
    async (product: Product) => {
      await api.deleteProduct(product.id);
      await refreshProductsAndDishes();
      setNotice({ tone: "success", message: `Продукт «${product.name}» удалён.` });
    },
    [refreshProductsAndDishes],
  );

  const createDish = useCallback(
    async (payload: DishMutationInput) => {
      await api.createDish(payload);
      await refreshOnlyDishes();
      setNotice({ tone: "success", message: "Блюдо сохранено." });
    },
    [refreshOnlyDishes],
  );

  const updateDish = useCallback(
    async (id: number, payload: DishMutationInput) => {
      await api.updateDish(id, payload);
      await refreshOnlyDishes();
      setNotice({ tone: "success", message: "Блюдо обновлено." });
    },
    [refreshOnlyDishes],
  );

  const deleteDish = useCallback(
    async (dish: Dish) => {
      await api.deleteDish(dish.id);
      await refreshOnlyDishes();
      setNotice({ tone: "success", message: `Блюдо «${dish.name}» удалено.` });
    },
    [refreshOnlyDishes],
  );

  return (
    <div className="page-shell">
      <div className="page-backdrop" />
      <main className="page-content">
        <section className="hero-card">
          <div className="hero-copy">
            <p className="eyebrow">Recipe Book</p>
            <h1>Книга рецептов</h1>
            <div className="hero-actions">
              <button
                type="button"
                className={`nav-pill ${activeSection === "products" ? "active" : ""}`}
                onClick={() => setActiveSection("products")}
              >
                Продукты
              </button>
              <button
                type="button"
                className={`nav-pill ${activeSection === "dishes" ? "active" : ""}`}
                onClick={() => setActiveSection("dishes")}
              >
                Блюда
              </button>
            </div>
          </div>
          <div className="hero-stats">
            <div className="hero-stat-card">
              <span>Всего продуктов</span>
              <strong>{catalogLoading ? "..." : totalProducts}</strong>
            </div>
            <div className="hero-stat-card">
              <span>Блюд в выдаче</span>
              <strong>{dishesLoading ? "..." : totalDishes}</strong>
            </div>
            <div className="hero-stat-card">
              <span>Продуктов с флагами</span>
              <strong>{catalogLoading ? "..." : totalFlags}</strong>
            </div>
          </div>
        </section>

        <section className="status-row">
        </section>

        {notice ? (
          <div className={`app-notice app-notice-${notice.tone}`}>
            <span>{notice.message}</span>
            <button type="button" className="ghost-button" onClick={() => setNotice(null)}>
              Скрыть
            </button>
          </div>
        ) : null}

        {activeSection === "products" ? (
          <ProductSection
            products={products}
            loading={productsLoading}
            error={productsError}
            filters={productFilters}
            onFiltersChange={(patch) =>
              setProductFilters((prev) => ({ ...prev, ...patch }))
            }
            onResetFilters={() => setProductFilters(defaultProductFilters)}
            onRefresh={() => loadProducts(productFilters)}
            onCreate={createProduct}
            onUpdate={updateProduct}
            onDelete={deleteProduct}
          />
        ) : (
          <DishSection
            dishes={dishes}
            allProducts={catalogProducts}
            loading={dishesLoading}
            error={dishesError}
            filters={dishFilters}
            onFiltersChange={(patch) => setDishFilters((prev) => ({ ...prev, ...patch }))}
            onResetFilters={() => setDishFilters(defaultDishFilters)}
            onRefresh={() => loadDishes(dishFilters)}
            onCreate={createDish}
            onUpdate={updateDish}
            onDelete={deleteDish}
          />
        )}
      </main>
    </div>
  );
}
