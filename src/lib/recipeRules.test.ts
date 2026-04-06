import { describe, expect, it } from "vitest";
import {
  buildDishDraft,
  clampFlags,
  normalizeDishName,
} from "./recipeRules";
import type { Product } from "../types";

const productA: Product = {
  id: 1,
  name: "Тофу",
  photos: [],
  calories: 120,
  proteins: 14,
  fats: 7,
  carbohydrates: 2,
  composition: null,
  category: "Овощи",
  cooking_requirement: "Готовый к употреблению",
  flags: {
    vegan: true,
    gluten_free: true,
    sugar_free: true,
  },
  created_at: "",
  updated_at: null,
};

const productB: Product = {
  ...productA,
  id: 2,
  name: "Булгур",
  calories: 340,
  proteins: 12,
  fats: 1,
  carbohydrates: 71,
  flags: {
    vegan: true,
    gluten_free: false,
    sugar_free: true,
  },
};

describe("recipe rules", () => {
  it("removes every macro from the dish name", () => {
    expect(normalizeDishName("!суп !десерт Тыквенный крем")).toBe(
      "Тыквенный крем",
    );
  });

  it("does not strip ordinary words without the macro prefix", () => {
    expect(normalizeDishName("Десертный крем!")).toBe("Десертный крем!");
  });

  it("uses the first macro and calculates nutrition", () => {
    const draft = buildDishDraft(
      "!салат !суп Тёплый боул",
      null,
      [
        { product_id: 1, quantity: 150 },
        { product_id: 2, quantity: 50 },
      ],
      new Map([
        [1, productA],
        [2, productB],
      ]),
    );

    expect(draft.macro_category).toBe("Салат");
    expect(draft.calculated_nutrition.calories).toBe(350);
    expect(draft.available_flags.gluten_free).toBe(false);
  });

  it("calculates dish nutrition only from ingredient quantities", () => {
    const draft = buildDishDraft(
      "Bowl",
      null,
      [
        { product_id: 1, quantity: 150 },
        { product_id: 2, quantity: 50 },
      ],
      new Map([
        [1, productA],
        [2, productB],
      ]),
    );

    expect(draft.calculated_nutrition).toEqual({
      calories: 350,
      proteins: 27,
      fats: 11,
      carbohydrates: 38.5,
    });
  });

  it("drops unavailable flags", () => {
    expect(
      clampFlags(
        { vegan: true, gluten_free: true, sugar_free: true },
        { vegan: true, gluten_free: false, sugar_free: true },
      ),
    ).toEqual({
      vegan: true,
      gluten_free: false,
      sugar_free: true,
    });
  });
});
