import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { api, ApiError } from "./api";
import { API_BASE_URL } from "../config";

const createFetchResponse = (body: unknown, status = 200) => ({
  status,
  ok: status >= 200 && status < 300,
  json: vi.fn().mockResolvedValue(body),
});

describe("api - взаимодействие с API", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("listProducts собирает строку запроса и возвращает данные", async () => {
    fetchMock.mockResolvedValueOnce(createFetchResponse({ data: [{ id: 1, name: "Тофу" }] }));

    const products = await api.listProducts({
      search: "foo",
      category: "",
      cooking_requirement: "",
      sort_by: "name",
      sort_direction: "asc",
      vegan: true,
      gluten_free: false,
      sugar_free: false,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE_URL}/products?search=foo&sort_by=name&sort_direction=asc&vegan=1`,
      expect.objectContaining({ headers: expect.objectContaining({ Accept: "application/json" }) }),
    );
    expect(products).toEqual([{ id: 1, name: "Тофу" }]);
  });

  it("выбрасывает ApiError при ошибке сервера", async () => {
    fetchMock.mockResolvedValueOnce(createFetchResponse({ message: "Неверные данные", errors: { name: ["Обязательно"] } }, 400));

    await expect(
      api.listProducts({
        search: "",
        category: "",
        cooking_requirement: "",
        sort_by: "name",
        sort_direction: "asc",
        vegan: false,
        gluten_free: false,
        sugar_free: false,
      }),
    ).rejects.toMatchObject({
      status: 400,
      message: "Неверные данные",
      fields: { name: ["Обязательно"] },
    });
  });
});
