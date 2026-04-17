import { test, expect, type Page } from '@playwright/test';

function uniqueName(prefix: string) {
    const seed = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    return `${prefix}-${seed}`;
}

function getEntityCard(page: Page, name: string) {
    return page
        .locator('.entity-card')
        .filter({ has: page.locator('h3', { hasText: name }) })
        .first();
}

function getEntityCardButton(page: Page, name: string, buttonText: string) {
    return getEntityCard(page, name).locator('button', { hasText: buttonText });
}

async function createProduct(
    page: Page,
    data?: Partial<{
        name: string;
        calories: string;
        proteins: string;
        fats: string;
        carbohydrates: string;
    }>,
) {
    await page.getByTestId('create-product-button').click();
    await expect(page.getByTestId('product-modal')).toBeVisible({ timeout: 10000 });

    const name = data?.name ?? uniqueName('PR');
    await page.getByTestId('product-name-input').fill(name);
    await page.getByTestId('product-category-select').selectOption('Овощи');
    await page.getByTestId('product-cooking-requirement-select').selectOption('Готовый к употреблению');
    await page.getByTestId('product-calories-input').fill(data?.calories ?? '120');
    await page.getByTestId('product-proteins-input').fill(data?.proteins ?? '10');
    await page.getByTestId('product-fats-input').fill(data?.fats ?? '5');
    await page.getByTestId('product-carbohydrates-input').fill(data?.carbohydrates ?? '3');
    await page.getByTestId('product-composition-textarea').fill('Тестовый состав продукта');

    return name;
}

async function submitProductForm(page: Page) {
    await page.getByTestId('product-submit-button').click();
    await expect(page.getByTestId('product-modal')).not.toBeVisible({ timeout: 10000 });
    await page.waitForSelector('.modal-backdrop', { state: 'detached', timeout: 10000 });
}

async function switchToDishes(page: Page) {
    await page.getByRole('button', { name: 'Блюда' }).click();
    await expect(page.getByText('Сборка порций и рецептов')).toBeVisible({ timeout: 10000 });
}

async function openDishForm(page: Page) {
    const createButton = page.getByRole('button', { name: 'Новое блюдо' });
    const emptyStateButton = page.getByRole('button', { name: 'Добавить блюдо' });
    if (await createButton.isVisible()) {
        await createButton.click();
    } else {
        await emptyStateButton.click();
    }
    await expect(page.getByRole('heading', { name: 'Новое блюдо' })).toBeVisible({ timeout: 10000 });
}

async function fillDishForm(
    page: Page,
    overrides?: Partial<{
        name: string;
        portionSize: string;
        quantity: string;
        productOptionLabel: string;
    }>,
) {
    const dishModal = page.locator('.modal-backdrop').last();

    await dishModal.getByLabel('Название').fill(overrides?.name ?? uniqueName('DS'));
    await dishModal.getByLabel('Категория').selectOption('Салат');
    await dishModal.getByLabel('Размер порции, г').fill(overrides?.portionSize ?? '150');

    const productSelect = dishModal.getByLabel('Продукт').first();
    if (overrides?.productOptionLabel) {
        await productSelect.selectOption({ label: overrides.productOptionLabel });
    } else {
        const firstValidProductValue = await productSelect.locator('option:not([value=""])').first().getAttribute('value');
        expect(firstValidProductValue).not.toBeNull();
        await productSelect.selectOption(firstValidProductValue!);
    }

    await dishModal.getByLabel('Количество, г').first().fill(overrides?.quantity ?? '150');
    await dishModal.getByRole('button', { name: 'Подставить расчёт' }).click();
}

async function submitDishForm(page: Page) {
    await page.getByRole('button', { name: 'Сохранить' }).click();
    await expect(page.locator('.modal-backdrop')).toHaveCount(0, { timeout: 10000 });
}

test.describe('Тесты UI системы', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:5173');
        await page.waitForSelector('[data-testid="products-section"]', { timeout: 15000 });
    });

    test.describe('Операции CRUD для продуктов', () => {
        const invalidNameCases: Array<{ title: string; value: string }> = [
            { title: 'Пустое имя (Класс эквивалентности: обязательное поле)', value: '' },
            { title: 'Имя длиной 1 символ (Граничное значение: ниже минимума)', value: 'A' },
        ];

        invalidNameCases.forEach(({ title, value }) => {
            test(`Создание продукта - ${title}`, async ({ page }) => {
                const productName = await createProduct(page, { name: value });
                await page.getByTestId('product-submit-button').click();

                await expect(page.getByTestId('product-modal')).toBeVisible({ timeout: 5000 });
                await expect(getEntityCard(page, productName)).toHaveCount(0);
            });
        });

        const invalidNutritionCases: Array<{
            title: string;
            payload: { calories: string; proteins: string; fats: string; carbohydrates: string };
        }> = [
                {
                    title: 'Отрицательные калории (Класс эквивалентности: недопустимый диапазон)',
                    payload: { calories: '-10', proteins: '10', fats: '5', carbohydrates: '3' },
                },
                {
                    title: 'Сумма БЖУ выше 100 (Граничное значение: нарушение верхней границы)',
                    payload: { calories: '600', proteins: '40', fats: '40', carbohydrates: '30' },
                },
            ];

        invalidNutritionCases.forEach(({ title, payload }) => {
            test(`Создание продукта - ${title}`, async ({ page }) => {
                const invalidName = await createProduct(page, { ...payload, name: uniqueName('IV') });
                await page.getByTestId('product-submit-button').click();

                await expect(page.getByTestId('product-modal')).toBeVisible({ timeout: 5000 });
                await expect(getEntityCard(page, invalidName)).toHaveCount(0);
            });
        });

        test('Создание продукта - валидные данные (Класс эквивалентности: допустимые входы)', async ({ page }) => {
            const productName = await createProduct(page, {
                name: uniqueName('TP'),
                calories: '120',
                proteins: '2.5',
                fats: '0.3',
                carbohydrates: '20.2',
            });
            await submitProductForm(page);

            await expect(getEntityCard(page, productName)).toBeVisible({ timeout: 10000 });
        });

        test('Создание продукта - минимальная допустимая длина имени (Граничное значение: на минимуме)', async ({ page }) => {
            await createProduct(page, { name: 'AB' });
            await submitProductForm(page);

            await expect(getEntityCard(page, 'AB')).toBeVisible({ timeout: 10000 });
        });


        test('Обновление продукта - изменение названия', async ({ page }) => {
            const originalName = await createProduct(page, { name: uniqueName('UP') });
            await submitProductForm(page);
            await expect(getEntityCard(page, originalName)).toBeVisible();

            const updatedName = uniqueName('UPD');
            await getEntityCardButton(page, originalName, 'Изменить').click();
            await page.getByTestId('product-name-input').fill(updatedName);
            await submitProductForm(page);

            await expect(getEntityCard(page, updatedName)).toBeVisible();
            await expect(getEntityCard(page, originalName)).toHaveCount(0);
        });

        test('Поиск продукта по имени', async ({ page }) => {
            const productName = await createProduct(page, { name: uniqueName('SR') });
            await submitProductForm(page);

            await page.getByTestId('product-search-input').fill(productName);
            await expect(getEntityCard(page, productName)).toBeVisible();
        });

        test('Фильтр продуктов по категории', async ({ page }) => {
            const productName = await createProduct(page, { name: uniqueName('CT') });
            await submitProductForm(page);

            await page.getByTestId('product-category-filter').selectOption('Овощи');
            await expect(getEntityCard(page, productName)).toBeVisible();
        });

        test('Фильтр продуктов по флагу vegan', async ({ page }) => {
            const productName = uniqueName('VG');
            await createProduct(page, { name: productName, calories: '110', proteins: '5', fats: '1', carbohydrates: '20' });
            await page.getByTestId('product-flag-vegan-checkbox').check();
            await submitProductForm(page);

            await page.getByTestId('product-flag-vegan').check();
            await expect(getEntityCard(page, productName)).toBeVisible();
        });
    });

    test.describe('Операции для блюд', () => {
        test('Создание блюда с одним ингредиентом', async ({ page }) => {
            const productName = await createProduct(page, {
                name: uniqueName('DP'),
                calories: '120',
                proteins: '10',
                fats: '5',
                carbohydrates: '3',
            });
            await submitProductForm(page);
            await switchToDishes(page);
            await openDishForm(page);
            const dishName = uniqueName('DS');
            await fillDishForm(page, {
                name: dishName,
                portionSize: '150',
                quantity: '150',
                productOptionLabel: `${productName} · Овощи`,
            });
            await submitDishForm(page);

            await expect(getEntityCard(page, dishName)).toBeVisible({ timeout: 10000 });
        });

        test('Создание блюда - количество ингредиента равно 0 (Граничное значение: ниже минимума)', async ({ page }) => {
            const productName = await createProduct(page, {
                name: uniqueName('DP'),
                calories: '120',
                proteins: '10',
                fats: '5',
                carbohydrates: '3',
            });
            await submitProductForm(page);
            await switchToDishes(page);
            await openDishForm(page);
            const dishName = uniqueName('DV');
            await fillDishForm(page, {
                name: dishName,
                portionSize: '150',
                quantity: '0',
                productOptionLabel: `${productName} · Овощи`,
            });
            await page.getByRole('button', { name: 'Сохранить' }).click();

            await expect(page.locator('.modal-backdrop')).toBeVisible();
            await expect(getEntityCard(page, dishName)).toHaveCount(0);
        });

        test('Удаление блюда', async ({ page }) => {
            const productName = await createProduct(page, {
                name: uniqueName('DP'),
                calories: '120',
                proteins: '10',
                fats: '5',
                carbohydrates: '3',
            });
            await submitProductForm(page);
            await switchToDishes(page);
            await openDishForm(page);
            const dishName = uniqueName('DD');
            await fillDishForm(page, { name: dishName, productOptionLabel: `${productName} · Овощи` });
            await submitDishForm(page);
            await expect(getEntityCard(page, dishName)).toBeVisible({ timeout: 10000 });

            page.on('dialog', dialog => dialog.accept());
            await getEntityCardButton(page, dishName, 'Удалить').click();
            await expect(getEntityCard(page, dishName)).toHaveCount(0);
        });

        test('Создание блюда - размер порции равен 0 (Граничное значение: ниже минимума)', async ({ page }) => {
            const productName = await createProduct(page, {
                name: uniqueName('DP'),
                calories: '120',
                proteins: '10',
                fats: '5',
                carbohydrates: '3',
            });
            await submitProductForm(page);
            await switchToDishes(page);
            await openDishForm(page);
            const dishName = uniqueName('DZ');
            await fillDishForm(page, {
                name: dishName,
                portionSize: '0',
                quantity: '100',
                productOptionLabel: `${productName} · Овощи`,
            });
            await page.getByRole('button', { name: 'Сохранить' }).click();

            await expect(page.locator('.modal-backdrop')).toBeVisible();
            await expect(getEntityCard(page, dishName)).toHaveCount(0);
        });

        test('Поиск блюда по имени', async ({ page }) => {
            const productName = await createProduct(page, {
                name: uniqueName('DP'),
                calories: '120',
                proteins: '10',
                fats: '5',
                carbohydrates: '3',
            });
            await submitProductForm(page);
            await switchToDishes(page);
            await openDishForm(page);
            const dishName = uniqueName('DSR');
            await fillDishForm(page, { name: dishName, productOptionLabel: `${productName} · Овощи` });
            await submitDishForm(page);

            await switchToDishes(page);
            await page.getByPlaceholder('Название').fill(dishName);
            await expect(getEntityCard(page, dishName)).toBeVisible();
        });

        test('Фильтр блюд по категории', async ({ page }) => {
            const productName = await createProduct(page, {
                name: uniqueName('DP'),
                calories: '120',
                proteins: '10',
                fats: '5',
                carbohydrates: '3',
            });
            await submitProductForm(page);
            await switchToDishes(page);
            await openDishForm(page);
            const dishName = uniqueName('DCF');
            await fillDishForm(page, { name: dishName, productOptionLabel: `${productName} · Овощи` });
            await submitDishForm(page);

            await switchToDishes(page);
            await page.getByLabel('Категория').selectOption('Салат');
            await expect(getEntityCard(page, dishName)).toBeVisible();
        });
    });

});