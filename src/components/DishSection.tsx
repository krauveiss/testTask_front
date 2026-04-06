import { useEffect, useMemo, useState } from "react";
import { ApiError } from "../lib/api";
import {
  buildDishDraft,
  clampFlags,
  createEmptyFlags,
  createPhotoDraftsFromUrls,
  formatNumber,
  getFieldError,
  parseNumberInput,
  parseOptionalNumberInput,
  photoDraftsToPayload,
  releasePhotoDrafts,
  roundToTwo,
  validatePhotos,
  validateDishNutrition,
} from "../lib/recipeRules";
import {
  DISH_CATEGORIES,
  FLAG_KEYS,
  FLAG_LABELS,
  type ApiFieldErrors,
  type Dish,
  type DishCategory,
  type DishFilters,
  type DishMutationInput,
  type FlagKey,
  type Flags,
  type Nutrition,
  type PhotoDraft,
  type Product,
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

interface DishSectionProps {
  dishes: Dish[];
  allProducts: Product[];
  loading: boolean;
  error: string | null;
  filters: DishFilters;
  onFiltersChange: (patch: Partial<DishFilters>) => void;
  onResetFilters: () => void;
  onRefresh: () => Promise<void>;
  onCreate: (payload: DishMutationInput) => Promise<void>;
  onUpdate: (id: number, payload: DishMutationInput) => Promise<void>;
  onDelete: (dish: Dish) => Promise<void>;
}

type DishEditorState =
  | { mode: "create" }
  | { mode: "edit"; dish: Dish }
  | null;

type NutritionKey = keyof Nutrition;

interface IngredientRow {
  id: string;
  product_id: string;
  quantity: string;
}

interface DishFormState {
  name: string;
  photos: PhotoDraft[];
  calories: string;
  proteins: string;
  fats: string;
  carbohydrates: string;
  portion_size: string;
  category: DishCategory | "";
  flags: Flags;
  ingredients: IngredientRow[];
}

let ingredientSeed = 0;

export function DishSection({
  dishes,
  allProducts,
  loading,
  error,
  filters,
  onFiltersChange,
  onResetFilters,
  onRefresh,
  onCreate,
  onUpdate,
  onDelete,
}: DishSectionProps) {
  const [editor, setEditor] = useState<DishEditorState>(null);
  const [details, setDetails] = useState<Dish | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDelete(dish: Dish) {
    setDeleteError(null);

    if (!window.confirm(`Удалить блюдо «${dish.name}»?`)) {
      return;
    }

    try {
      await onDelete(dish);
    } catch (errorValue) {
      setDeleteError(
        errorValue instanceof Error ? errorValue.message : "Не удалось удалить блюдо.",
      );
    }
  }

  return (
    <div className="section-stack">
      <section className="panel-card">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Блюда</p>
            <h2>Сборка порций и рецептов</h2>
            <p className="subtle-hint">
              Название поддерживает макросы, а флаги пересчитываются от состава.
            </p>
          </div>
          <div className="panel-head-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => void onRefresh()}
            >
              Обновить
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={() => setEditor({ mode: "create" })}
              disabled={allProducts.length === 0}
            >
              Новое блюдо
            </button>
          </div>
        </div>

        <div className="toolbar-grid">
          <label>
            <span>Поиск</span>
            <input
              type="search"
              value={filters.search}
              placeholder="Например, !суп грибной"
              onChange={(event) => onFiltersChange({ search: event.target.value })}
            />
          </label>
          <label>
            <span>Категория</span>
            <select
              value={filters.category}
              onChange={(event) => onFiltersChange({ category: event.target.value })}
            >
              <option value="">Все категории</option>
              {DISH_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
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
                  onFiltersChange({ [flagKey]: event.target.checked } as Partial<DishFilters>)
                }
              />
              <span>{FLAG_LABELS[flagKey]}</span>
            </label>
          ))}
          <button type="button" className="ghost-button" onClick={onResetFilters}>
            Сбросить фильтры
          </button>
          <span className="subtle-hint">
            В каталоге продуктов: {allProducts.length}. Найдено блюд: {dishes.length}
          </span>
        </div>

        {allProducts.length === 0 ? (
          <SectionMessage tone="info">
            Сначала добавь хотя бы один продукт: без этого состав блюда собрать нельзя.
          </SectionMessage>
        ) : null}
        {error ? <SectionMessage tone="error">{error}</SectionMessage> : null}
        {deleteError ? <SectionMessage tone="error">{deleteError}</SectionMessage> : null}

        {loading ? (
          <div className="loading-block">Загружаю блюда...</div>
        ) : dishes.length === 0 ? (
          <EmptyState
            title="Пока нет блюд"
            description="Собери первое блюдо из уже существующих продуктов."
            action={
              allProducts.length > 0 ? (
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => setEditor({ mode: "create" })}
                  style={{marginTop: '10px'}}
                >
                  Добавить блюдо
                </button>
              ) : null
            }
          />
        ) : (
          <div className="card-grid">
            {dishes.map((dish) => (
              <article key={dish.id} className="entity-card">
                <PhotoGallery photos={dish.photos.slice(0, 1)} alt={dish.name} compact />
                <div className="entity-card-head">
                  <div>
                    <h3>{dish.name}</h3>
                    <div className="badge-row" style={{ marginTop: '10px' }}>
                      <Badge tone="accent">{dish.category}</Badge>
                      <Badge>{formatNumber(dish.portion_size)} г</Badge>
                    </div>
                  </div>
                </div>
                <NutritionStrip
                  calories={dish.calories}
                  proteins={dish.proteins}
                  fats={dish.fats}
                  carbohydrates={dish.carbohydrates}
                  unit="ккал / порция"
                />
                <FlagChips flags={dish.flags} availableFlags={dish.available_flags} />
                <p className="subtle-hint">
                  Ингредиентов: {dish.ingredients.length}. Черновой расчёт:{" "}
                  {formatNumber(dish.calculated_nutrition.calories)} ккал.
                </p>
                <div className="card-actions">
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => setDetails(dish)}
                  >
                    Подробнее
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => setEditor({ mode: "edit", dish })}
                  >
                    Изменить
                  </button>
                  <button
                    type="button"
                    className="danger-button"
                    onClick={() => void handleDelete(dish)}
                  >
                    Удалить
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <DishFormModal
        editor={editor}
        allProducts={allProducts}
        onClose={() => setEditor(null)}
        onCreate={onCreate}
        onUpdate={onUpdate}
      />

      <Modal
        open={details !== null}
        title={details?.name ?? ""}
        subtitle={details ? `Блюдо #${details.id}` : undefined}
        onClose={() => setDetails(null)}
      >
        {details ? (
          <div className="detail-stack">
            <PhotoGallery photos={details.photos} alt={details.name} />
            <div className="badge-row">
              <Badge tone="accent">{details.category}</Badge>
              <Badge>{formatNumber(details.portion_size)} г / порция</Badge>
            </div>
            <NutritionStrip
              calories={details.calories}
              proteins={details.proteins}
              fats={details.fats}
              carbohydrates={details.carbohydrates}
              unit="ккал / порция"
            />
            <FlagChips flags={details.flags} availableFlags={details.available_flags} />
            <div className="detail-copy">
              <h4>Ингредиенты</h4>
              <ul className="plain-list">
                {details.ingredients.map((ingredient) => (
                  <li key={`${details.id}-${ingredient.product_id}`}>
                    {ingredient.product_name} · {formatNumber(ingredient.quantity)} г
                  </li>
                ))}
              </ul>
            </div>
            <div className="subtle-card">
              <strong>Черновой пересчёт по составу</strong>
              <p>
                {formatNumber(details.calculated_nutrition.calories)} ккал,{" "}
                {formatNumber(details.calculated_nutrition.proteins)} /{" "}
                {formatNumber(details.calculated_nutrition.fats)} /{" "}
                {formatNumber(details.calculated_nutrition.carbohydrates)} г БЖУ.
              </p>
            </div>
            <MetaList createdAt={details.created_at} updatedAt={details.updated_at} />
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

function DishFormModal({
  editor,
  allProducts,
  onClose,
  onCreate,
  onUpdate,
}: {
  editor: DishEditorState;
  allProducts: Product[];
  onClose: () => void;
  onCreate: (payload: DishMutationInput) => Promise<void>;
  onUpdate: (id: number, payload: DishMutationInput) => Promise<void>;
}) {
  const productsById = useMemo(
    () => new Map(allProducts.map((product) => [product.id, product])),
    [allProducts],
  );
  const initialState = useMemo(() => createInitialDishFormState(editor), [editor]);
  const [form, setForm] = useState<DishFormState>(initialState);
  const [manualNutrition, setManualNutrition] = useState<Record<NutritionKey, boolean>>(
    createInitialManualNutrition(editor),
  );
  const [errors, setErrors] = useState<ApiFieldErrors | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(initialState);
    setManualNutrition(createInitialManualNutrition(editor));
    setErrors(null);
    setGeneralError(null);
  }, [editor, initialState]);

  useEffect(() => {
    return () => {
      releasePhotoDrafts(form.photos);
    };
  }, [form.photos]);

  const parsedIngredients = useMemo(
    () =>
      form.ingredients
        .map((ingredient) => ({
          product_id: Number(ingredient.product_id),
          quantity: parseNumberInput(ingredient.quantity),
        }))
        .filter((ingredient) => Number.isFinite(ingredient.product_id)),
    [form.ingredients],
  );

  const draft = useMemo(
    () =>
      buildDishDraft(
        form.name,
        form.category || null,
        parsedIngredients,
        productsById,
      ),
    [form.category, form.name, parsedIngredients, productsById],
  );

  const totalIngredientWeight = useMemo(
    () =>
      roundToTwo(
        parsedIngredients.reduce((sum, ingredient) => sum + ingredient.quantity, 0),
      ),
    [parsedIngredients],
  );

  const flagRestrictions = useMemo(
    () => buildFlagRestrictions(parsedIngredients, productsById),
    [parsedIngredients, productsById],
  );

  const resolvedCategorySource = form.category
    ? "выбрана в поле формы"
    : draft.macro_category
      ? "подставлена из макроса в названии"
      : "ещё не определена";

  useEffect(() => {
    setForm((prev) => {
      const nextFlags = clampFlags(prev.flags, draft.available_flags);
      let changed = false;
      const next: DishFormState = {
        ...prev,
        flags: nextFlags,
      };

      if (
        nextFlags.vegan !== prev.flags.vegan ||
        nextFlags.gluten_free !== prev.flags.gluten_free ||
        nextFlags.sugar_free !== prev.flags.sugar_free
      ) {
        changed = true;
      }

      (["calories", "proteins", "fats", "carbohydrates"] as NutritionKey[]).forEach(
        (key) => {
          if (!manualNutrition[key]) {
            const value = formatNumber(draft.calculated_nutrition[key]);

            if (prev[key] !== value) {
              (next[key] as string) = value;
              changed = true;
            }
          }
        },
      );

      return changed ? next : prev;
    });
  }, [draft.available_flags, draft.calculated_nutrition, manualNutrition]);

  const activeEditor = editor;

  if (!activeEditor) {
    return null;
  }

  const editingDish = activeEditor.mode === "edit" ? activeEditor.dish : null;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateDishFormStrict(form, draft, productsById);

    setErrors(nextErrors);
    setGeneralError(null);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setSaving(true);

    try {
      const payload: DishMutationInput = {
        name: form.name.trim(),
        photos: photoDraftsToPayload(form.photos),
        calories: resolveDishNutritionValue(form.calories, draft.calculated_nutrition.calories),
        proteins: resolveDishNutritionValue(form.proteins, draft.calculated_nutrition.proteins),
        fats: resolveDishNutritionValue(form.fats, draft.calculated_nutrition.fats),
        carbohydrates: resolveDishNutritionValue(
          form.carbohydrates,
          draft.calculated_nutrition.carbohydrates,
        ),
        ingredients: form.ingredients.map((ingredient) => ({
          product_id: Number(ingredient.product_id),
          quantity: roundToTwo(parseNumberInput(ingredient.quantity)),
        })),
        portion_size: roundToTwo(parseNumberInput(form.portion_size)),
        category: form.category || null,
        flags: form.flags,
      };

      if (!editingDish) {
        await onCreate(payload);
      } else {
        await onUpdate(editingDish.id, payload);
      }

      onClose();
    } catch (errorValue) {
      if (errorValue instanceof ApiError) {
        setErrors(errorValue.fields ?? null);
        setGeneralError(errorValue.message);
      } else {
        setGeneralError(
          errorValue instanceof Error ? errorValue.message : "Не удалось сохранить блюдо.",
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
        editingDish ? `Редактирование: ${editingDish.name}` : "Новое блюдо"
      }
      onClose={onClose}
      actions={
        <>
          <button type="button" className="ghost-button" onClick={onClose}>
            Отмена
          </button>
          <button
            type="submit"
            form="dish-form"
            className="primary-button"
            disabled={saving || allProducts.length === 0}
          >
            {saving ? "Сохраняю..." : "Сохранить"}
          </button>
        </>
      }
    >
      <form id="dish-form" className="form-stack" onSubmit={handleSubmit}>
        {generalError ? <SectionMessage tone="error">{generalError}</SectionMessage> : null}

        <SectionMessage tone="info">
          Система сначала считает черновые КБЖУ по составу блюда на порцию, затем ты при желании можешь скорректировать итоговые значения вручную.
        </SectionMessage>

        <label className="form-field">
          <span>Название блюда</span>
          <input
            type="text"
            value={form.name}
            minLength={2}
            placeholder="Например, !суп Грибной крем"
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
          />
          <FieldErrorText error={getFieldError(errors, "name")} />
        </label>

        <div className="subtle-card">
          <strong>Разбор макроса</strong>
          <p>
            После очистки название станет:{" "}
            <strong>{draft.normalized_name || "—"}</strong>
          </p>
          <p>
            Категория из макроса:{" "}
            <strong>{draft.macro_category || "не найдена"}</strong>. Итоговая категория:{" "}
            <strong>{draft.effective_category || "не выбрана"}</strong>, источник:{" "}
            <strong>{resolvedCategorySource}</strong>
          </p>
        </div>


        <PhotoEditor
          photos={form.photos}
          onChange={(photos) => setForm((prev) => ({ ...prev, photos }))}
          error={getFieldError(errors, "photos")}
          allowUrlInput={false}
          helperText="До 5 файлов изображений."
        />

        <div className="form-grid">
          <label className="form-field">
            <span>Категория</span>
            <select
              value={form.category}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  category: event.target.value as DishCategory | "",
                }))
              }
            >
              <option value="">Оставить на макрос</option>
              {DISH_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            <FieldErrorText error={getFieldError(errors, "category")} />
          </label>
          <label className="form-field">
            <span>Размер порции, г</span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={form.portion_size}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, portion_size: event.target.value }))
              }
            />
            <FieldErrorText error={getFieldError(errors, "portion_size")} />
          </label>
        </div>

        <div className="ingredient-stack">
          <div className="ingredient-head">
            <div>
              <h4>Состав блюда</h4>
              <p className="subtle-hint">Продукты не должны повторяться. Количество указывается в граммах на порцию.</p>
            </div>
            <button
              type="button"
              className="secondary-button"
              onClick={() =>
                setForm((prev) => ({
                  ...prev,
                  ingredients: [
                    ...prev.ingredients,
                    { id: createIngredientRowId(), product_id: "", quantity: "" },
                  ],
                }))
              }
              disabled={allProducts.length === 0}
            >
              Добавить ингредиент
            </button>
          </div>
          <FieldErrorText error={getFieldError(errors, "ingredients")} />

          {form.ingredients.length === 0 ? (
            <div className="ingredient-empty">Добавь хотя бы один продукт в состав.</div>
          ) : (
            form.ingredients.map((ingredient, index) => {
              const selectedIds = form.ingredients
                .filter((row) => row.id !== ingredient.id)
                .map((row) => Number(row.product_id));

              return (
                <div key={ingredient.id} className="ingredient-row">
                  <label className="form-field">
                    <span>Продукт</span>
                    <select
                      value={ingredient.product_id}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          ingredients: prev.ingredients.map((row) =>
                            row.id === ingredient.id
                              ? { ...row, product_id: event.target.value }
                              : row,
                          ),
                        }))
                      }
                    >
                      <option value="">Выбери продукт</option>
                      {allProducts.map((product) => (
                        <option
                          key={product.id}
                          value={product.id}
                          disabled={selectedIds.includes(product.id)}
                        >
                          {product.name} · {product.category}
                        </option>
                      ))}
                    </select>
                    <FieldErrorText
                      error={getFieldError(errors, `ingredients.${index}.product_id`)}
                    />
                  </label>
                  <label className="form-field">
                    <span>Количество, г</span>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={ingredient.quantity}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          ingredients: prev.ingredients.map((row) =>
                            row.id === ingredient.id
                              ? { ...row, quantity: event.target.value }
                              : row,
                          ),
                        }))
                      }
                    />
                    <FieldErrorText
                      error={getFieldError(errors, `ingredients.${index}.quantity`)}
                    />
                  </label>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        ingredients: prev.ingredients.filter((row) => row.id !== ingredient.id),
                      }))
                    }
                  >
                    Удалить
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="subtle-card">
          <div className="ingredient-head">
            <div>
              <strong>Автоматический расчёт КБЖУ на порцию</strong>
            </div>
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setManualNutrition({
                  calories: false,
                  proteins: false,
                  fats: false,
                  carbohydrates: false,
                });
                setForm((prev) => ({
                  ...prev,
                  calories: formatNumber(draft.calculated_nutrition.calories),
                  proteins: formatNumber(draft.calculated_nutrition.proteins),
                  fats: formatNumber(draft.calculated_nutrition.fats),
                  carbohydrates: formatNumber(draft.calculated_nutrition.carbohydrates),
                }));
              }}
            >
              Подставить расчёт
            </button>
          </div>
          <NutritionStrip
            calories={draft.calculated_nutrition.calories}
            proteins={draft.calculated_nutrition.proteins}
            fats={draft.calculated_nutrition.fats}
            carbohydrates={draft.calculated_nutrition.carbohydrates}
            unit="ккал / порция"
          />
          <p className="subtle-hint">
            Формула: сумма по всем ингредиентам `(показатель продукта на 100 г × количество / 100)`.
          </p>
        </div>

        <div className="form-grid">
          {(
            [
              ["calories", "Калории, ккал / порция"],
              ["proteins", "Белки, г / порция"],
              ["fats", "Жиры, г / порция"],
              ["carbohydrates", "Углеводы, г / порция"],
            ] as Array<[NutritionKey, string]>
          ).map(([key, label]) => (
            <label key={key} className="form-field">
              <span>
                {label}{" "}
                {manualNutrition[key] ? <em className="subtle-hint">ручная правка</em> : null}
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form[key]}
                onChange={(event) => {
                  setManualNutrition((prev) => ({ ...prev, [key]: true }));
                  setForm((prev) => ({ ...prev, [key]: event.target.value }));
                }}
              />
              <FieldErrorText error={getFieldError(errors, key)} />
            </label>
          ))}
        </div>

        <div className="form-field">
          <span>Дополнительные флаги блюда</span>
          <div className="checkbox-grid">
            {FLAG_KEYS.map((flagKey) => (
              <label
                key={flagKey}
                className={`checkbox-chip ${!draft.available_flags[flagKey] ? "disabled" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={form.flags[flagKey]}
                  disabled={!draft.available_flags[flagKey]}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      flags: {
                        ...prev.flags,
                        [flagKey]: event.target.checked,
                      },
                    }))
                  }
                />
                <span>
                  {FLAG_LABELS[flagKey]}
                  {!draft.available_flags[flagKey] ? " недоступен" : ""}
                </span>
              </label>
            ))}
          </div>
          <p className="subtle-hint">
            Сейчас доступны:{" "}
            {FLAG_KEYS.filter((key) => draft.available_flags[key])
              .map((key) => FLAG_LABELS[key])
              .join(", ") || "ни один"}
          </p>
          {FLAG_KEYS.filter((key) => !draft.available_flags[key]).map((key) => (
            <p key={key} className="subtle-hint">
              {FLAG_LABELS[key]} недоступен: {flagRestrictions[key] || "в составе есть несовместимый продукт."}
            </p>
          ))}
        </div>

        <div className="subtle-card">
          <strong>Контроль БЖУ на порцию</strong>
          <p>
            Сумма БЖУ в порции:{" "}
            {formatNumber(
              parseNumberInput(form.proteins) +
              parseNumberInput(form.fats) +
              parseNumberInput(form.carbohydrates),
            )}{" "}
            г из {formatNumber(parseNumberInput(form.portion_size))} г.
          </p>
        </div>
      </form>
    </Modal>
  );
}

function createInitialDishFormState(editor: DishEditorState): DishFormState {
  if (!editor || editor.mode === "create") {
    return {
      name: "",
      photos: [],
      calories: "",
      proteins: "",
      fats: "",
      carbohydrates: "",
      portion_size: "",
      category: "",
      flags: createEmptyFlags(),
      ingredients: [{ id: createIngredientRowId(), product_id: "", quantity: "" }],
    };
  }

  const { dish } = editor;

  return {
    name: dish.name,
    photos: createPhotoDraftsFromUrls(dish.photos),
    calories: formatNumber(dish.calories),
    proteins: formatNumber(dish.proteins),
    fats: formatNumber(dish.fats),
    carbohydrates: formatNumber(dish.carbohydrates),
    portion_size: formatNumber(dish.portion_size),
    category: dish.category,
    flags: { ...dish.flags },
    ingredients: dish.ingredients.map((ingredient) => ({
      id: createIngredientRowId(),
      product_id: String(ingredient.product_id),
      quantity: formatNumber(ingredient.quantity),
    })),
  };
}

function createInitialManualNutrition(
  editor: DishEditorState,
): Record<NutritionKey, boolean> {
  if (!editor || editor.mode === "create") {
    return {
      calories: false,
      proteins: false,
      fats: false,
      carbohydrates: false,
    };
  }

  const { dish } = editor;

  return {
    calories: !numbersEqual(dish.calories, dish.calculated_nutrition.calories),
    proteins: !numbersEqual(dish.proteins, dish.calculated_nutrition.proteins),
    fats: !numbersEqual(dish.fats, dish.calculated_nutrition.fats),
    carbohydrates: !numbersEqual(
      dish.carbohydrates,
      dish.calculated_nutrition.carbohydrates,
    ),
  };
}

function validateDishForm(
  form: DishFormState,
  draft: ReturnType<typeof buildDishDraft>,
): ApiFieldErrors {
  const errors: ApiFieldErrors = {};
  const portionSize = parseNumberInput(form.portion_size);
  const proteins = parseNumberInput(form.proteins);
  const fats = parseNumberInput(form.fats);
  const carbohydrates = parseNumberInput(form.carbohydrates);

  if (form.name.trim().length < 2) {
    errors.name = ["Название должно содержать минимум 2 символа."];
  }

  if (draft.normalized_name.length < 2) {
    errors.name = ["После удаления макросов в названии должно остаться минимум 2 символа."];
  }

  if (form.photos.length > 5) {
    errors.photos = ["Можно добавить не более 5 фотографий."];
  }

  if (!draft.effective_category) {
    errors.category = ["Категория обязательна, если она не зашита макросом в названии."];
  }

  if (portionSize <= 0) {
    errors.portion_size = ["Размер порции должен быть больше нуля."];
  }

  if (form.ingredients.length === 0) {
    errors.ingredients = ["Добавь хотя бы один продукт в состав."];
  }

  const selectedIds = new Set<number>();

  form.ingredients.forEach((ingredient, index) => {
    const productId = Number(ingredient.product_id);
    const quantity = parseNumberInput(ingredient.quantity);

    if (!productId) {
      errors[`ingredients.${index}.product_id`] = ["Выбери продукт."];
    } else if (selectedIds.has(productId)) {
      errors[`ingredients.${index}.product_id`] = ["Продукты в составе не должны повторяться."];
    } else {
      selectedIds.add(productId);
    }

    if (quantity <= 0) {
      errors[`ingredients.${index}.quantity`] = ["Количество должно быть больше нуля."];
    }
  });

  if (parseNumberInput(form.calories) < 0) {
    errors.calories = ["Калорийность не может быть отрицательной."];
  }

  if (proteins < 0) {
    errors.proteins = ["Белки не могут быть отрицательными."];
  }

  if (fats < 0) {
    errors.fats = ["Жиры не могут быть отрицательными."];
  }

  if (carbohydrates < 0) {
    errors.carbohydrates = ["Углеводы не могут быть отрицательными."];
  }

  if (!validateDishNutrition(proteins, fats, carbohydrates, portionSize)) {
    errors.proteins = ["Сумма белков, жиров и углеводов не может превышать размер порции."];
  }

  return errors;
}

function validateDishFormStrict(
  form: DishFormState,
  draft: ReturnType<typeof buildDishDraft>,
  productsById: Map<number, Product>,
): ApiFieldErrors {
  const errors: ApiFieldErrors = {};
  const portionSize = parseOptionalNumberInput(form.portion_size);
  const calories = parseOptionalNumberInput(form.calories);
  const proteins = parseOptionalNumberInput(form.proteins);
  const fats = parseOptionalNumberInput(form.fats);
  const carbohydrates = parseOptionalNumberInput(form.carbohydrates);
  const photosError = validatePhotos(form.photos, { allowRemote: false });

  if (form.name.trim().length < 2) {
    errors.name = ["Название должно содержать минимум 2 символа."];
  }

  if (draft.normalized_name.length < 2) {
    errors.name = ["После удаления макросов в названии должно остаться минимум 2 символа."];
  }

  if (photosError) {
    errors.photos = [photosError];
  }

  if (!draft.effective_category) {
    errors.category = ["Категория обязательна, если она не задана макросом в названии."];
  }

  if (portionSize === null) {
    errors.portion_size = ["Размер порции обязателен."];
  } else if (portionSize <= 0) {
    errors.portion_size = ["Размер порции должен быть больше нуля."];
  }

  if (form.ingredients.length === 0) {
    errors.ingredients = ["Добавь хотя бы один продукт в состав."];
  }

  const selectedIds = new Set<number>();

  form.ingredients.forEach((ingredient, index) => {
    const productId = Number(ingredient.product_id);
    const quantity = parseOptionalNumberInput(ingredient.quantity);

    if (!productId) {
      errors[`ingredients.${index}.product_id`] = ["Выбери продукт."];
    } else if (!productsById.has(productId)) {
      errors[`ingredients.${index}.product_id`] = ["Выбранный продукт не найден в каталоге."];
    } else if (selectedIds.has(productId)) {
      errors[`ingredients.${index}.product_id`] = ["Продукты в составе не должны повторяться."];
    } else {
      selectedIds.add(productId);
    }

    if (quantity === null) {
      errors[`ingredients.${index}.quantity`] = ["Количество обязательно."];
    } else if (quantity <= 0) {
      errors[`ingredients.${index}.quantity`] = ["Количество должно быть больше нуля."];
    }
  });

  if (calories === null) {
    errors.calories = ["Калорийность должна быть рассчитана или заполнена вручную."];
  } else if (calories < 0) {
    errors.calories = ["Калорийность не может быть отрицательной."];
  }

  if (proteins === null) {
    errors.proteins = ["Белки должны быть рассчитаны или заполнены вручную."];
  } else if (proteins < 0) {
    errors.proteins = ["Белки не могут быть отрицательными."];
  }

  if (fats === null) {
    errors.fats = ["Жиры должны быть рассчитаны или заполнены вручную."];
  } else if (fats < 0) {
    errors.fats = ["Жиры не могут быть отрицательными."];
  }

  if (carbohydrates === null) {
    errors.carbohydrates = ["Углеводы должны быть рассчитаны или заполнены вручную."];
  } else if (carbohydrates < 0) {
    errors.carbohydrates = ["Углеводы не могут быть отрицательными."];
  }

  if (
    portionSize !== null &&
    proteins !== null &&
    fats !== null &&
    carbohydrates !== null &&
    !validateDishNutrition(proteins, fats, carbohydrates, portionSize)
  ) {
    errors.proteins = ["Сумма белков, жиров и углеводов не может превышать размер порции."];
  }

  return errors;
}

function parseNullableNumber(value: string): number | null {
  return value.trim() === "" ? null : roundToTwo(parseNumberInput(value));
}

function resolveDishNutritionValue(value: string, fallback: number): number {
  const parsed = parseOptionalNumberInput(value);

  return parsed === null ? roundToTwo(fallback) : roundToTwo(parsed);
}

function buildFlagRestrictions(
  ingredients: Array<{ product_id: number; quantity: number }>,
  productsById: Map<number, Product>,
): Record<FlagKey, string> {
  const result = {
    vegan: "",
    gluten_free: "",
    sugar_free: "",
  } satisfies Record<FlagKey, string>;

  for (const flagKey of FLAG_KEYS) {
    const offenders = ingredients
      .map((ingredient) => productsById.get(ingredient.product_id))
      .filter((product): product is Product => Boolean(product))
      .filter((product) => !product.flags[flagKey])
      .map((product) => product.name);

    if (ingredients.length === 0) {
      result[flagKey] = "нужно сначала добавить хотя бы один продукт.";
    } else if (offenders.length > 0) {
      result[flagKey] = `не подходят продукты: ${offenders.join(", ")}.`;
    }
  }

  return result;
}

function createIngredientRowId(): string {
  ingredientSeed += 1;
  return `ingredient-${ingredientSeed}`;
}

function numbersEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.01;
}
