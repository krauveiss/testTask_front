import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  buildDishDraft,
  clampFlags,
  normalizeDishName,
  roundToTwo,
  parseNumberInput,
  parseOptionalNumberInput,
  detectDishMacroCategory,
  validateProductNutrition,
  validateDishNutrition,
} from "./recipeRules";
import type { Product, Flags } from "../types";

const createProduct = (
  id: number,
  name: string,
  calories: number,
  proteins: number,
  fats: number,
  carbohydrates: number,
  flags: Flags = { vegan: true, gluten_free: true, sugar_free: true },
): Product => ({
  id,
  name,
  photos: [],
  calories,
  proteins,
  fats,
  carbohydrates,
  composition: null,
  category: "Овощи",
  cooking_requirement: "Готовый к употреблению",
  flags,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: null,
});

describe("buildDishDraft - расчёт калорийности блюда", () => {
  let productsMap: Map<number, Product>;

  beforeEach(() => {
    productsMap = new Map([
      [1, createProduct(1, "Тофу", 120, 14, 7, 2)],
      [2, createProduct(2, "Булгур", 340, 12, 1, 71, { vegan: true, gluten_free: false, sugar_free: true })],
      [3, createProduct(3, "Вода", 0, 0, 0, 0)],
      [4, createProduct(4, "Масло", 717, 0.5, 81, 0.1, { vegan: false, gluten_free: true, sugar_free: true })],
    ]);
  });

  afterEach(() => {
    productsMap.clear();
  });

  describe("Эквивалентные классы", () => {
    it("должна рассчитать калории для одного ингредиента", () => {
      const draft = buildDishDraft("Блюдо", null, [{ product_id: 1, quantity: 100 }], productsMap);

      expect(draft.calculated_nutrition.calories).toBe(120);
      expect(draft.calculated_nutrition.proteins).toBe(14);
      expect(draft.calculated_nutrition.fats).toBe(7);
      expect(draft.calculated_nutrition.carbohydrates).toBe(2);
    });

    it("должна суммировать калории нескольких ингредиентов", () => {
      const draft = buildDishDraft(
        "!салат",
        null,
        [
          { product_id: 1, quantity: 100 },
          { product_id: 2, quantity: 100 },
        ],
        productsMap,
      );

      expect(draft.calculated_nutrition.calories).toBe(460);
      expect(draft.calculated_nutrition.proteins).toBe(26);
      expect(draft.calculated_nutrition.fats).toBe(8);
      expect(draft.calculated_nutrition.carbohydrates).toBe(73);
    });

    it("должна возвращать нули для пустого списка ингредиентов", () => {
      const draft = buildDishDraft("Пусто", null, [], productsMap);

      expect(draft.calculated_nutrition).toEqual({
        calories: 0,
        proteins: 0,
        fats: 0,
        carbohydrates: 0,
      });
    });

    it("должна игнорировать несуществующие продукты", () => {
      const draft = buildDishDraft(
        "Блюдо",
        null,
        [
          { product_id: 1, quantity: 100 },
          { product_id: 999, quantity: 100 },
        ],
        productsMap,
      );

      expect(draft.calculated_nutrition.calories).toBe(120);
    });

    it("должна корректно работать с дробными значениями", () => {
      const draft = buildDishDraft(
        "Блюдо",
        null,
        [
          { product_id: 1, quantity: 33.3 },
          { product_id: 2, quantity: 66.7 },
        ],
        productsMap,
      );

      expect(draft.calculated_nutrition.calories).toBeCloseTo(266.74, 1);
      expect(draft.calculated_nutrition.proteins).toBeCloseTo(12.67, 1);
    });

    it("должна правильно считать флаги для всех ингредиентов с флагами", () => {
      const draft = buildDishDraft(
        "Веган",
        null,
        [{ product_id: 1, quantity: 100 }],
        productsMap,
      );

      expect(draft.available_flags).toEqual({
        vegan: true,
        gluten_free: true,
        sugar_free: true,
      });
    });

    it("должна отказать в флаге если хотя бы один ингредиент его не имеет", () => {
      const draft = buildDishDraft(
        "Микс",
        null,
        [
          { product_id: 1, quantity: 50 },
          { product_id: 2, quantity: 50 },
        ],
        productsMap,
      );

      expect(draft.available_flags.gluten_free).toBe(false);
      expect(draft.available_flags.vegan).toBe(true);
    });

    it("должна иметь false все флаги для пустого списка", () => {
      const draft = buildDishDraft("Пусто", null, [], productsMap);

      expect(draft.available_flags).toEqual({
        vegan: false,
        gluten_free: false,
        sugar_free: false,
      });
    });
  });

  describe("Анализ граничных значений", () => {
    const boundaryTestCases = [
      { quantity: 0, expectedCalories: 0 },
      { quantity: 0.0001, expectedCalories: 0.00 },
      { quantity: 1, expectedCalories: 1.2 },
      { quantity: 100, expectedCalories: 120 },
      { quantity: 500, expectedCalories: 600 },
    ];

    boundaryTestCases.forEach(({ quantity, expectedCalories }) => {
      it(`должна рассчитать калории при quantity=${quantity}`, () => {
        const draft = buildDishDraft("Блюдо", null, [{ product_id: 1, quantity }], productsMap);

        expect(draft.calculated_nutrition.calories).toBeCloseTo(expectedCalories, 2);
      });
    });

    it("должна обрабатывать продукты, один из которых содержит нулевое КБЖУ", () => {
      const draft = buildDishDraft(
        "С водой",
        null,
        [
          { product_id: 1, quantity: 100 },
          { product_id: 3, quantity: 200 },
        ],
        productsMap,
      );

      expect(draft.calculated_nutrition.calories).toBe(120);
    });

    it("должна обрабатывать продукт с нулевым количеством калорий", () => {
      const draft = buildDishDraft(
        "С водой",
        null,
        [
          { product_id: 3, quantity: 200 },
        ],
        productsMap,
      );

      expect(draft.calculated_nutrition.calories).toBe(0);
    });

    it("должна обрабатывать очень высокие калории", () => {
      const draft = buildDishDraft("Масло", null, [{ product_id: 4, quantity: 10 }], productsMap);

      expect(draft.calculated_nutrition.calories).toBeCloseTo(71.7, 1);
    });

  });

  describe("Работа с названиями и макросами", () => {
    it("должна удалять макросы из названия", () => {
      const draft = buildDishDraft("!суп !десерт Крем", null, [], productsMap);

      expect(draft.normalized_name).toBe("Крем");
    });

    it("должна не трогать обычные слова", () => {
      const draft = buildDishDraft("Десертный крем!", null, [], productsMap);

      expect(draft.normalized_name).toBe("Десертный крем!");
    });

    it("должна определить макро категорию", () => {
      const draft = buildDishDraft("!салат Цезарь", null, [], productsMap);

      expect(draft.macro_category).toBe("Салат");
    });

    it("должна использовать первый макро", () => {
      const draft = buildDishDraft("!салат !суп Боул", null, [], productsMap);

      expect(draft.macro_category).toBe("Салат");
    });

    it("должна вернуть null если нет макро", () => {
      const draft = buildDishDraft("Обычный салат", null, [], productsMap);

      expect(draft.macro_category).toBeNull();
    });
  });
});

describe("clampFlags", () => {
  it("должна сохранить флаги если они доступны", () => {
    const result = clampFlags(
      { vegan: true, gluten_free: true, sugar_free: true },
      { vegan: true, gluten_free: true, sugar_free: true },
    );

    expect(result).toEqual({ vegan: true, gluten_free: true, sugar_free: true });
  });

  it("должна сбросить недоступные флаги", () => {
    const result = clampFlags(
      { vegan: true, gluten_free: true, sugar_free: true },
      { vegan: true, gluten_free: false, sugar_free: true },
    );

    expect(result).toEqual({ vegan: true, gluten_free: false, sugar_free: true });
  });

  it("должна сбросить все флаги если они недоступны", () => {
    const result = clampFlags(
      { vegan: true, gluten_free: true, sugar_free: true },
      { vegan: false, gluten_free: false, sugar_free: false },
    );

    expect(result).toEqual({ vegan: false, gluten_free: false, sugar_free: false });
  });
});

describe("normalizeDishName", () => {
  it("должна удалять макросы", () => {
    expect(normalizeDishName("!суп !десерт Тыквенный крем")).toBe("Тыквенный крем");
  });

  it("должна не удалять обычные слова", () => {
    expect(normalizeDishName("Десертный крем!")).toBe("Десертный крем!");
  });

  it("должна нормализовать пробелы", () => {
    expect(normalizeDishName("!суп   Крем")).toBe("Крем");
  });

  it("должна работать с разным регистром макросов", () => {
    expect(normalizeDishName("!СУП Крем")).toBe("Крем");
    expect(normalizeDishName("!сУп Крем")).toBe("Крем");
  });
});

describe("detectDishMacroCategory", () => {
  it("должна определить категорию по макро", () => {
    expect(detectDishMacroCategory("!суп Куриный")).toBe("Суп");
  });

  it("должна использовать первый макро", () => {
    expect(detectDishMacroCategory("!салат !суп !десерт")).toBe("Салат");
  });

  it("должна вернуть null если нет макро", () => {
    expect(detectDishMacroCategory("Обычный салат")).toBeNull();
  });

  it("должна работать с макро не в начале", () => {
    expect(detectDishMacroCategory("Блюдо !суп")).toBe("Суп");
  });
});

describe("roundToTwo", () => {
  const testCases = [
    { value: 5, expected: 5 },
    { value: 5.234, expected: 5.23 },
    { value: 5.235, expected: 5.24 },
    { value: 5.245, expected: 5.25 },
    { value: 0, expected: 0 },
    { value: 0.001, expected: 0 },
    { value: 0.005, expected: 0.01 },
    { value: -5.234, expected: -5.23 },
  ];

  testCases.forEach(({ value, expected }) => {
    it(`roundToTwo(${value}) должно вернуть ${expected}`, () => {
      expect(roundToTwo(value)).toBe(expected);
    });
  });
});

describe("parseNumberInput", () => {
  it("должна парсить число", () => {
    expect(parseNumberInput(5)).toBe(5);
    expect(parseNumberInput(-10)).toBe(-10);
  });

  it("должна парсить строку", () => {
    expect(parseNumberInput("5")).toBe(5);
    expect(parseNumberInput("10.5")).toBe(10.5);
  });

  it("должна заменять запятую на точку", () => {
    expect(parseNumberInput("5,5")).toBe(5.5);
  });

  it("должна удалять пробелы", () => {
    expect(parseNumberInput(" 5 ")).toBe(5);
  });

  it("должна возвращать 0 для null/undefined/невалидного", () => {
    expect(parseNumberInput(null)).toBe(0);
    expect(parseNumberInput(undefined)).toBe(0);
    expect(parseNumberInput("abc")).toBe(0);
    expect(parseNumberInput("")).toBe(0);
    expect(parseNumberInput(NaN)).toBe(0);
  });
});

describe("parseOptionalNumberInput", () => {
  it("должна парсить валидные числа", () => {
    expect(parseOptionalNumberInput(5)).toBe(5);
    expect(parseOptionalNumberInput("5")).toBe(5);
  });

  it("должна возвращать null для null/undefined", () => {
    expect(parseOptionalNumberInput(null)).toBeNull();
    expect(parseOptionalNumberInput(undefined)).toBeNull();
  });

  it("должна возвращать null для пустой строки", () => {
    expect(parseOptionalNumberInput("")).toBeNull();
    expect(parseOptionalNumberInput("  ")).toBeNull();
  });

  it("должна возвращать null для невалидной строки", () => {
    expect(parseOptionalNumberInput("abc")).toBeNull();
  });
});

describe("validateProductNutrition", () => {
  const validCases = [
    [30, 20, 40],
    [50, 25, 25],
    [33.33, 33.33, 33.34],
    [0, 0, 0],
  ];

  validCases.forEach(([proteins, fats, carbs]) => {
    it(`должна принять валидную сумму ${proteins}+${fats}+${carbs}`, () => {
      expect(validateProductNutrition(proteins, fats, carbs)).toBe(true);
    });
  });

  it("должна отвергнуть сумму больше 100", () => {
    expect(validateProductNutrition(50, 25, 25.1)).toBe(false);
    expect(validateProductNutrition(40, 30, 31)).toBe(false);
  });
});
