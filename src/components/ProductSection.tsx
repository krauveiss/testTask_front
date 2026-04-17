import { useEffect, useMemo, useState } from "react";
import { ApiError } from "../lib/api";
import {
  createEmptyFlags,
  createPhotoDraftsFromUrls,
  formatNumber,
  getFieldError,
  parseNumberInput,
  parseOptionalNumberInput,
  preparePhotoUploadPayload,
  releasePhotoDrafts,
  validatePhotos,
  validateProductNutrition,
} from "../lib/recipeRules";
import {
  COOKING_REQUIREMENTS,
  FLAG_KEYS,
  FLAG_LABELS,
  PRODUCT_CATEGORIES,
  type ApiFieldErrors,
  type BlockingDish,
  type CookingRequirement,
  type PhotoDraft,
  type Product,
  type ProductCategory,
  type ProductFilters,
  type ProductMutationInput,
} from "../types";
import {
  Badge,
  EmptyState,
  FieldErrorText,
  FlagChips,
  MetaList,
  Modal,
  NutritionStrip,
  PhotoEditor,
  PhotoGallery,
  SectionMessage,
} from "./ui";

interface ProductSectionProps {
  products: Product[];
  loading: boolean;
  error: string | null;
  filters: ProductFilters;
  onFiltersChange: (patch: Partial<ProductFilters>) => void;
  onResetFilters: () => void;
  onRefresh: () => Promise<void>;
  onCreate: (payload: ProductMutationInput) => Promise<void>;
  onUpdate: (id: number, payload: ProductMutationInput) => Promise<void>;
  onDelete: (product: Product) => Promise<void>;
}

type ProductEditorState =
  | { mode: "create" }
  | { mode: "edit"; product: Product }
  | null;

interface ProductFormState {
  name: string;
  photos: PhotoDraft[];
  calories: string;
  proteins: string;
  fats: string;
  carbohydrates: string;
  composition: string;
  category: ProductCategory;
  cooking_requirement: CookingRequirement;
  flags: Product["flags"];
}

export function ProductSection({
  products,
  loading,
  error,
  filters,
  onFiltersChange,
  onResetFilters,
  onRefresh,
  onCreate,
  onUpdate,
  onDelete,
}: ProductSectionProps) {
  const [editor, setEditor] = useState<ProductEditorState>(null);
  const [details, setDetails] = useState<Product | null>(null);
  const [blocking, setBlocking] = useState<{
    productName: string;
    message: string;
    dishes: BlockingDish[];
  } | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const activeFlagCount = useMemo(
    () =>
      Number(filters.vegan) + Number(filters.gluten_free) + Number(filters.sugar_free),
    [filters.gluten_free, filters.sugar_free, filters.vegan],
  );

  async function handleDelete(product: Product) {
    setDeleteError(null);

    if (!window.confirm(`Удалить продукт «${product.name}»?`)) {
      return;
    }

    try {
      await onDelete(product);
    } catch (errorValue) {
      if (errorValue instanceof ApiError && errorValue.status === 409) {
        const payload = errorValue.payload as { message?: string; dishes?: BlockingDish[] };

        setBlocking({
          productName: product.name,
          message:
            payload?.message ??
            "Продукт нельзя удалить, потому что он уже используется в блюдах.",
          dishes: payload?.dishes ?? [],
        });
        return;
      }

      setDeleteError(
        errorValue instanceof Error
          ? errorValue.message
          : "Не удалось удалить продукт.",
      );
    }
  }

  return (
    <div className="section-stack">
      <section className="panel-card" data-testid="products-section">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Продукты</p>
          </div>
          <div className="panel-head-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => void onRefresh()}
              data-testid="refresh-products-button"
            >
              Обновить
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={() => setEditor({ mode: "create" })}
              data-testid="create-product-button"
            >
              Новый продукт
            </button>
          </div>
        </div>

        <div className="toolbar-grid">
          <label>
            <span>Поиск</span>
            <input
              type="search"
              value={filters.search}
              placeholder="Например, овсяное молоко"
              onChange={(event) => onFiltersChange({ search: event.target.value })}
              data-testid="product-search-input"
            />
          </label>
          <label>
            <span>Категория</span>
            <select
              value={filters.category}
              onChange={(event) => onFiltersChange({ category: event.target.value })}
              data-testid="product-category-filter"
            >
              <option value="">Все категории</option>
              {PRODUCT_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Готовность</span>
            <select
              value={filters.cooking_requirement}
              onChange={(event) =>
                onFiltersChange({ cooking_requirement: event.target.value })
              }
              data-testid="product-cooking-filter"
            >
              <option value="">Любая</option>
              {COOKING_REQUIREMENTS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Сортировка</span>
            <select
              value={filters.sort_by}
              onChange={(event) =>
                onFiltersChange({
                  sort_by: event.target.value as ProductFilters["sort_by"],
                })
              }
              data-testid="product-sort-by"
            >
              <option value="name">Название</option>
              <option value="calories">Калорийность</option>
              <option value="proteins">Белки</option>
              <option value="fats">Жиры</option>
              <option value="carbohydrates">Углеводы</option>
            </select>
          </label>
          <label>
            <span>Порядок</span>
            <select
              value={filters.sort_direction}
              onChange={(event) =>
                onFiltersChange({
                  sort_direction: event.target.value as ProductFilters["sort_direction"],
                })
              }
              data-testid="product-sort-direction"
            >
              <option value="asc">По возрастанию</option>
              <option value="desc">По убыванию</option>
            </select>
          </label>
        </div>

        <div className="filter-row">
          {FLAG_KEYS.map((flagKey) => (
            <label key={flagKey} className="checkbox-chip">
              <input
                type="checkbox"
                checked={filters[flagKey]}
                onChange={(event) =>
                  onFiltersChange({ [flagKey]: event.target.checked } as Partial<ProductFilters>)
                }
                style={{width: '50px'}}
                data-testid={`product-flag-${flagKey}`}
              />
              <span>{FLAG_LABELS[flagKey]}</span>
            </label>
          ))}
          <button type="button" className="ghost-button" onClick={onResetFilters} data-testid="reset-filters-button">
            Сбросить фильтры
          </button>
          <span className="subtle-hint">
            Активно флагов: {activeFlagCount}. Найдено: {products.length}
          </span>
        </div>

        {error ? <SectionMessage tone="error">{error}</SectionMessage> : null}
        {deleteError ? <SectionMessage tone="error">{deleteError}</SectionMessage> : null}

        {loading ? (
          <div className="loading-block">Загружаю продукты...</div>
        ) : products.length === 0 ? (
          <EmptyState
            title="Пока ничего не найдено"
            description="Создай первый продукт или ослабь фильтры."
            action={
              <button
                type="button"
                className="primary-button"
                style={{marginTop: '20px'}}
                onClick={() => setEditor({ mode: "create" })}
                
              >
                Добавить продукт
              </button>
            }
          />
        ) : (
          <div className="card-grid">
            {products.map((product) => (
              <article key={product.id} className="entity-card" data-testid={`product-card-${product.id}`}>
                <PhotoGallery photos={product.photos.slice(0, 1)} alt={product.name} compact />
                <div className="entity-card-head">
                  <div>
                    <h3>{product.name}</h3>
                    <div className="badge-row" style={{marginTop: '10px'}}>
                      <Badge tone="accent">{product.category}</Badge>
                      <Badge>{product.cooking_requirement}</Badge>
                    </div>
                  </div>
                </div>
                <NutritionStrip
                  calories={product.calories}
                  proteins={product.proteins}
                  fats={product.fats}
                  carbohydrates={product.carbohydrates}
                  unit="ккал / 100 г"
                />
                <FlagChips flags={product.flags} />
                <div className="card-actions">
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => setDetails(product)}
                    data-testid={`product-details-button-${product.id}`}
                  >
                    Подробнее
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => setEditor({ mode: "edit", product })}
                    data-testid={`product-edit-button-${product.id}`}
                  >
                    Изменить
                  </button>
                  <button
                    type="button"
                    className="danger-button"
                    onClick={() => void handleDelete(product)}
                    data-testid={`product-delete-button-${product.id}`}
                  >
                    Удалить
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <ProductFormModal
        editor={editor}
        onClose={() => setEditor(null)}
        onCreate={onCreate}
        onUpdate={onUpdate}
      />

      <Modal
        open={details !== null}
        title={details?.name ?? ""}
        subtitle={details ? `Продукт #${details.id}` : undefined}
        onClose={() => setDetails(null)}
        data-testid="product-details-modal"
      >
        {details ? (
          <div className="detail-stack">
            <PhotoGallery photos={details.photos} alt={details.name} />
            <div className="badge-row">
              <Badge tone="accent">{details.category}</Badge>
              <Badge>{details.cooking_requirement}</Badge>
            </div>
            <NutritionStrip
              calories={details.calories}
              proteins={details.proteins}
              fats={details.fats}
              carbohydrates={details.carbohydrates}
              unit="ккал / 100 г"
            />
            <FlagChips flags={details.flags} />
            <div className="detail-copy">
              <h4>Состав</h4>
              <p>{details.composition || "Не указан"}</p>
            </div>
            <MetaList createdAt={details.created_at} updatedAt={details.updated_at} />
          </div>
        ) : null}
      </Modal>

      <Modal
        open={blocking !== null}
        title={blocking ? `Удаление недоступно: ${blocking.productName}` : ""}
        onClose={() => setBlocking(null)}
        data-testid="product-delete-blocking-modal"
        actions={
          <button
            type="button"
            className="primary-button"
            onClick={() => setBlocking(null)}
            data-testid="product-blocking-acknowledge-button"
          >
            Понятно
          </button>
        }
      >
        {blocking ? (
          <div className="detail-stack">
            <SectionMessage tone="error">{blocking.message}</SectionMessage>
            <div className="detail-copy">
              <h4>Блюда, которые используют продукт</h4>
              <ul className="plain-list">
                {blocking.dishes.map((dish) => (
                  <li key={dish.id}>
                    #{dish.id} · {dish.name}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

function ProductFormModal({
  editor,
  onClose,
  onCreate,
  onUpdate,
}: {
  editor: ProductEditorState;
  onClose: () => void;
  onCreate: (payload: ProductMutationInput) => Promise<void>;
  onUpdate: (id: number, payload: ProductMutationInput) => Promise<void>;
}) {
  const initial = useMemo(() => createInitialProductFormState(editor), [editor]);
  const [form, setForm] = useState<ProductFormState>(initial);
  const [errors, setErrors] = useState<ApiFieldErrors | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(initial);
    setErrors(null);
    setGeneralError(null);
  }, [initial]);

  useEffect(() => {
    return () => {
      releasePhotoDrafts(form.photos);
    };
  }, [form.photos]);

  const activeEditor = editor;

  if (!activeEditor) {
    return null;
  }

  const editingProduct =
    activeEditor.mode === "edit" ? activeEditor.product : null;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateProductFormStrict(form);

    setErrors(nextErrors);
    setGeneralError(null);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setSaving(true);

    try {
      const payload: ProductMutationInput = {
        name: form.name.trim(),
        photos: await preparePhotoUploadPayload(form.photos),
        calories: parseNumberInput(form.calories),
        proteins: parseNumberInput(form.proteins),
        fats: parseNumberInput(form.fats),
        carbohydrates: parseNumberInput(form.carbohydrates),
        composition: form.composition.trim() || null,
        category: form.category,
        cooking_requirement: form.cooking_requirement,
        flags: form.flags,
      };

      if (!editingProduct) {
        await onCreate(payload);
      } else {
        await onUpdate(editingProduct.id, payload);
      }

      onClose();
    } catch (errorValue) {
      if (errorValue instanceof ApiError) {
        setErrors(errorValue.fields ?? null);
        setGeneralError(errorValue.message);
      } else {
        setGeneralError(
          errorValue instanceof Error
            ? errorValue.message
            : "Не удалось сохранить продукт.",
        );
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={activeEditor !== null}
      title={
        editingProduct ? `Редактирование: ${editingProduct.name}` : "Новый продукт"
      }
      onClose={onClose}
      data-testid="product-modal"
      actions={
        <>
          <button type="button" className="ghost-button" onClick={onClose} data-testid="product-cancel-button">
            Отмена
          </button>
          <button
            type="submit"
            form="product-form"
            className="primary-button"
            disabled={saving}
            data-testid="product-submit-button"
          >
            {saving ? "Сохраняю..." : "Сохранить"}
          </button>
        </>
      }
    >
      <form id="product-form" className="form-stack" onSubmit={handleSubmit} data-testid="product-form">
        {generalError ? <SectionMessage tone="error">{generalError}</SectionMessage> : null}

        <label className="form-field">
          <span>Название</span>
          <input
            type="text"
            value={form.name}
            minLength={2}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            data-testid="product-name-input"
          />
          <FieldErrorText error={getFieldError(errors, "name")} />
        </label>

        <PhotoEditor
          photos={form.photos}
          onChange={(photos) => setForm((prev) => ({ ...prev, photos }))}
          error={getFieldError(errors, "photos")}
          data-testid="product-photo-editor"
        />

        <div className="form-grid">
          <label className="form-field">
            <span>Калории, ккал / 100 г</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.calories}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, calories: event.target.value }))
              }
              data-testid="product-calories-input"
            />
            <FieldErrorText error={getFieldError(errors, "calories")} />
          </label>
          <label className="form-field">
            <span>Белки, г</span>
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={form.proteins}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, proteins: event.target.value }))
              }
              data-testid="product-proteins-input"
            />
            <FieldErrorText error={getFieldError(errors, "proteins")} />
          </label>
          <label className="form-field">
            <span>Жиры, г</span>
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={form.fats}
              onChange={(event) => setForm((prev) => ({ ...prev, fats: event.target.value }))}
              data-testid="product-fats-input"
            />
            <FieldErrorText error={getFieldError(errors, "fats")} />
          </label>
          <label className="form-field">
            <span>Углеводы, г</span>
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={form.carbohydrates}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, carbohydrates: event.target.value }))
              }
              data-testid="product-carbohydrates-input"
            />
            <FieldErrorText error={getFieldError(errors, "carbohydrates")} />
          </label>
          <label className="form-field">
            <span>Категория</span>
            <select
              value={form.category}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  category: event.target.value as ProductCategory,
                }))
              }
              data-testid="product-category-select"
            >
              {PRODUCT_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            <FieldErrorText error={getFieldError(errors, "category")} />
          </label>
          <label className="form-field">
            <span>Необходимость готовки</span>
            <select
              value={form.cooking_requirement}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  cooking_requirement: event.target.value as CookingRequirement,
                }))
              }
              data-testid="product-cooking-requirement-select"
            >
              {COOKING_REQUIREMENTS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <FieldErrorText error={getFieldError(errors, "cooking_requirement")} />
          </label>
        </div>

        <label className="form-field">
          <span>Состав</span>
          <textarea
            rows={4}
            value={form.composition}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, composition: event.target.value }))
            }
            data-testid="product-composition-textarea"
          />
          <FieldErrorText error={getFieldError(errors, "composition")} />
        </label>

        <div className="form-field">
          <span>Дополнительные флаги</span>
          <div className="checkbox-grid">
            {FLAG_KEYS.map((flagKey) => (
              <label key={flagKey} className="checkbox-chip">
                <input
                  type="checkbox"
                  checked={form.flags[flagKey]}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      flags: {
                        ...prev.flags,
                        [flagKey]: event.target.checked,
                      },
                    }))
                  }
                  data-testid={`product-flag-${flagKey}-checkbox`}
                />
                <span>{FLAG_LABELS[flagKey]}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="subtle-card">
          <strong>Контроль БЖУ</strong>
          <p>
            Сейчас сумма БЖУ:{" "}
            {formatNumber(
              parseNumberInput(form.proteins) +
                parseNumberInput(form.fats) +
                parseNumberInput(form.carbohydrates),
            )}{" "}
            г / 100 г.
          </p>
        </div>
      </form>
    </Modal>
  );
}

function createInitialProductFormState(editor: ProductEditorState): ProductFormState {
  if (!editor || editor.mode === "create") {
    return {
      name: "",
      photos: [],
      calories: "",
      proteins: "",
      fats: "",
      carbohydrates: "",
      composition: "",
      category: PRODUCT_CATEGORIES[0],
      cooking_requirement: COOKING_REQUIREMENTS[0],
      flags: createEmptyFlags(),
    };
  }

  const { product } = editor;

  return {
    name: product.name,
    photos: createPhotoDraftsFromUrls(product.photos),
    calories: formatNumber(product.calories),
    proteins: formatNumber(product.proteins),
    fats: formatNumber(product.fats),
    carbohydrates: formatNumber(product.carbohydrates),
    composition: product.composition ?? "",
    category: product.category,
    cooking_requirement: product.cooking_requirement,
    flags: { ...product.flags },
  };
}

function validateProductForm(form: ProductFormState): ApiFieldErrors {
  const errors: ApiFieldErrors = {};
  const calories = parseNumberInput(form.calories);
  const proteins = parseNumberInput(form.proteins);
  const fats = parseNumberInput(form.fats);
  const carbohydrates = parseNumberInput(form.carbohydrates);

  if (form.name.trim().length < 2) {
    errors.name = ["Название должно содержать минимум 2 символа."];
  }

  if (form.photos.length > 5) {
    errors.photos = ["Можно добавить не более 5 фотографий."];
  }

  if (calories < 0) {
    errors.calories = ["Калорийность не может быть отрицательной."];
  }

  if (proteins < 0 || proteins > 100) {
    errors.proteins = ["Белки должны быть в диапазоне от 0 до 100."];
  }

  if (fats < 0 || fats > 100) {
    errors.fats = ["Жиры должны быть в диапазоне от 0 до 100."];
  }

  if (carbohydrates < 0 || carbohydrates > 100) {
    errors.carbohydrates = ["Углеводы должны быть в диапазоне от 0 до 100."];
  }

  if (!validateProductNutrition(proteins, fats, carbohydrates)) {
    errors.proteins = ["Сумма белков, жиров и углеводов не может превышать 100 г."];
  }

  return errors;
}

function validateProductFormStrict(form: ProductFormState): ApiFieldErrors {
  const errors: ApiFieldErrors = {};
  const calories = parseOptionalNumberInput(form.calories);
  const proteins = parseOptionalNumberInput(form.proteins);
  const fats = parseOptionalNumberInput(form.fats);
  const carbohydrates = parseOptionalNumberInput(form.carbohydrates);
  const photosError = validatePhotos(form.photos);

  if (form.name.trim().length < 2) {
    errors.name = ["Название должно содержать минимум 2 символа."];
  }

  if (photosError) {
    errors.photos = [photosError];
  }

  if (calories === null) {
    errors.calories = ["Калорийность обязательна."];
  } else if (calories < 0) {
    errors.calories = ["Калорийность не может быть отрицательной."];
  }

  if (proteins === null) {
    errors.proteins = ["Белки обязательны."];
  } else if (proteins < 0 || proteins > 100) {
    errors.proteins = ["Белки должны быть в диапазоне от 0 до 100."];
  }

  if (fats === null) {
    errors.fats = ["Жиры обязательны."];
  } else if (fats < 0 || fats > 100) {
    errors.fats = ["Жиры должны быть в диапазоне от 0 до 100."];
  }

  if (carbohydrates === null) {
    errors.carbohydrates = ["Углеводы обязательны."];
  } else if (carbohydrates < 0 || carbohydrates > 100) {
    errors.carbohydrates = ["Углеводы должны быть в диапазоне от 0 до 100."];
  }

  if (form.category.trim() === "") {
    errors.category = ["Категория обязательна."];
  }

  if (form.cooking_requirement.trim() === "") {
    errors.cooking_requirement = ["Необходимость готовки обязательна."];
  }

  if (
    proteins !== null &&
    fats !== null &&
    carbohydrates !== null &&
    !validateProductNutrition(proteins, fats, carbohydrates)
  ) {
    errors.proteins = ["Сумма белков, жиров и углеводов не может превышать 100 г."];
  }

  return errors;
}
