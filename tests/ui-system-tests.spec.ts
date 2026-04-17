import { test, expect } from '@playwright/test';
import { ProductPage, type ProductInput } from './page-objects/ProductPage';
import { DishPage } from './page-objects/DishPage';

function uniqueName(prefix: string) {
    const seed = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    return `${prefix}-${seed}`;
}

test.describe('Тесты UI системы', () => {
    test.describe('Операции CRUD для продуктов', () => {
        const invalidNameCases: Array<{ title: string; value: string }> = [
            { title: 'Пустое имя (Класс эквивалентности: обязательное поле)', value: '' },
            { title: 'Имя длиной 1 символ (Граничное значение: ниже минимума)', value: 'A' },
        ];

        invalidNameCases.forEach(({ title, value }) => {
            test(`Создание продукта - ${title}`, async ({ page }) => {
                const products = new ProductPage(page);
                await products.goto();
                await products.openCreateForm();
                const typedName = value === '' ? '' : value;
                await products.fillForm({ name: typedName });
                await products.submitExpectValidationError();
                if (typedName.length > 0) {
                    await products.assertCardAbsent(typedName);
                }
            });
        });

        const invalidNutritionCases: Array<{ title: string; payload: ProductInput }> = [
            {
                title: 'Отрицательные калории (Класс эквивалентности: недопустимый диапазон)',
                payload: { name: uniqueName('IV'), calories: '-10', proteins: '10', fats: '5', carbohydrates: '3' },
            },
            {
                title: 'Сумма БЖУ выше 100 (Граничное значение: нарушение верхней границы)',
                payload: { name: uniqueName('IV'), calories: '600', proteins: '40', fats: '40', carbohydrates: '30' },
            },
        ];

        invalidNutritionCases.forEach(({ title, payload }) => {
            test(`Создание продукта - ${title}`, async ({ page }) => {
                const products = new ProductPage(page);
                await products.goto();
                await products.openCreateForm();
                await products.fillForm(payload);
                await products.submitExpectValidationError();
                await products.assertCardAbsent(payload.name);
            });
        });

        test('Создание продукта - валидные данные (Класс эквивалентности: допустимые входы)', async ({ page }) => {
            const products = new ProductPage(page);
            await products.goto();
            const name = uniqueName('TP');
            await products.openCreateForm();
            await products.fillForm({ name, calories: '120', proteins: '2.5', fats: '0.3', carbohydrates: '20.2' });
            await products.submitExpectSuccess();
            await products.assertCardVisible(name);
        });

        test('Создание продукта - минимальная допустимая длина имени (Граничное значение: на минимуме)', async ({ page }) => {
            const products = new ProductPage(page);
            await products.goto();
            await products.openCreateForm();
            await products.fillForm({ name: 'AB' });
            await products.submitExpectSuccess();
            await products.assertCardVisible('AB');
        });

        test('Обновление продукта - изменение названия', async ({ page }) => {
            const products = new ProductPage(page);
            await products.goto();
            const originalName = uniqueName('UP');
            await products.openCreateForm();
            await products.fillForm({ name: originalName });
            await products.submitExpectSuccess();

            const updatedName = uniqueName('UPD');
            await products.openEdit(originalName);
            await products.fillForm({ name: updatedName });
            await products.submitExpectSuccess();

            await products.assertCardVisible(updatedName);
            await products.assertCardAbsent(originalName);
        });

        test('Удаление продукта', async ({ page }) => {
            const products = new ProductPage(page);
            await products.goto();
            const name = uniqueName('DL');
            await products.openCreateForm();
            await products.fillForm({ name });
            await products.submitExpectSuccess();

            await products.delete(name);
            await products.assertCardAbsent(name);
        });

        test('Поиск продукта по имени: только один результат', async ({ page }) => {
            const products = new ProductPage(page);
            await products.goto();
            const target = uniqueName('SR');
            const other = uniqueName('OT');

            await products.openCreateForm();
            await products.fillForm({ name: target });
            await products.submitExpectSuccess();

            await products.openCreateForm();
            await products.fillForm({ name: other });
            await products.submitExpectSuccess();

            await products.filterBySearch(target);
            await products.assertCardVisible(target);
            await expect(products.visibleCards()).toHaveCount(1);
            await products.assertCardAbsent(other);
        });

        test('Фильтр продуктов по категории: только подходящие записи', async ({ page }) => {
            const products = new ProductPage(page);
            await products.goto();
            const target = uniqueName('CT');
            await products.openCreateForm();
            await products.fillForm({ name: target, category: 'Овощи' });
            await products.submitExpectSuccess();

            await products.filterBySearch(target);
            await products.filterByCategory('Овощи');
            await products.assertCardVisible(target);
            await expect(products.visibleCards()).toHaveCount(1);
        });

        test('Фильтр продуктов по флагу vegan: только подходящие записи', async ({ page }) => {
            const products = new ProductPage(page);
            await products.goto();
            const target = uniqueName('VG');
            const other = uniqueName('NV');

            await products.openCreateForm();
            await products.fillForm({ name: target, vegan: true, calories: '110', proteins: '5', fats: '1', carbohydrates: '20' });
            await products.submitExpectSuccess();

            await products.openCreateForm();
            await products.fillForm({ name: other, calories: '120', proteins: '10', fats: '5', carbohydrates: '3' });
            await products.submitExpectSuccess();

            await products.filterBySearch(target);
            await products.filterByVegan();
            await products.assertCardVisible(target);
            await expect(products.visibleCards()).toHaveCount(1);
            await products.assertCardAbsent(other);
        });
    });

    test.describe('Операции для блюд', () => {
        test('Создание блюда с одним ингредиентом', async ({ page }) => {
            const products = new ProductPage(page);
            const dishes = new DishPage(page);
            await products.goto();
            const productName = uniqueName('DP');
            await products.openCreateForm();
            await products.fillForm({ name: productName, calories: '120', proteins: '10', fats: '5', carbohydrates: '3' });
            await products.submitExpectSuccess();

            await dishes.openSection();
            await dishes.openCreateForm();
            const dishName = uniqueName('DS');
            await dishes.fillForm({ name: dishName, portionSize: '150', quantity: '150', productOptionLabel: `${productName} · Овощи` });
            await dishes.submitExpectSuccess();
            await dishes.assertCardVisible(dishName);
        });

        test('Создание блюда - количество ингредиента равно 0 (Граничное значение: ниже минимума)', async ({ page }) => {
            const products = new ProductPage(page);
            const dishes = new DishPage(page);
            await products.goto();
            const productName = uniqueName('DP');
            await products.openCreateForm();
            await products.fillForm({ name: productName });
            await products.submitExpectSuccess();

            await dishes.openSection();
            await dishes.openCreateForm();
            const dishName = uniqueName('DV');
            await dishes.fillForm({ name: dishName, quantity: '0', productOptionLabel: `${productName} · Овощи` });
            await dishes.submitExpectValidationError();
            await dishes.assertCardAbsent(dishName);
        });

        test('Создание блюда - размер порции равен 0 (Граничное значение: ниже минимума)', async ({ page }) => {
            const products = new ProductPage(page);
            const dishes = new DishPage(page);
            await products.goto();
            const productName = uniqueName('DP');
            await products.openCreateForm();
            await products.fillForm({ name: productName });
            await products.submitExpectSuccess();

            await dishes.openSection();
            await dishes.openCreateForm();
            const dishName = uniqueName('DZ');
            await dishes.fillForm({ name: dishName, portionSize: '0', quantity: '100', productOptionLabel: `${productName} · Овощи` });
            await dishes.submitExpectValidationError();
            await dishes.assertCardAbsent(dishName);
        });

        test('Удаление блюда', async ({ page }) => {
            const products = new ProductPage(page);
            const dishes = new DishPage(page);
            await products.goto();
            const productName = uniqueName('DP');
            await products.openCreateForm();
            await products.fillForm({ name: productName });
            await products.submitExpectSuccess();

            await dishes.openSection();
            await dishes.openCreateForm();
            const dishName = uniqueName('DD');
            await dishes.fillForm({ name: dishName, productOptionLabel: `${productName} · Овощи` });
            await dishes.submitExpectSuccess();

            await dishes.delete(dishName);
            await dishes.assertCardAbsent(dishName);
        });

        test('Поиск блюда по имени: только один результат', async ({ page }) => {
            const products = new ProductPage(page);
            const dishes = new DishPage(page);
            await products.goto();
            const productName = uniqueName('DP');
            await products.openCreateForm();
            await products.fillForm({ name: productName });
            await products.submitExpectSuccess();

            await dishes.openSection();
            const target = uniqueName('DSR');
            const other = uniqueName('DSO');

            await dishes.openCreateForm();
            await dishes.fillForm({ name: target, productOptionLabel: `${productName} · Овощи` });
            await dishes.submitExpectSuccess();

            await dishes.openCreateForm();
            await dishes.fillForm({ name: other, productOptionLabel: `${productName} · Овощи` });
            await dishes.submitExpectSuccess();

            await dishes.filterBySearch(target);
            await dishes.assertCardVisible(target);
            await expect(dishes.visibleCards()).toHaveCount(1);
            await dishes.assertCardAbsent(other);
        });

        test('Фильтр блюд по категории: только подходящие записи', async ({ page }) => {
            const products = new ProductPage(page);
            const dishes = new DishPage(page);
            await products.goto();
            const productName = uniqueName('DP');
            await products.openCreateForm();
            await products.fillForm({ name: productName });
            await products.submitExpectSuccess();

            await dishes.openSection();
            const dishName = uniqueName('DCF');
            await dishes.openCreateForm();
            await dishes.fillForm({ name: dishName, category: 'Салат', productOptionLabel: `${productName} · Овощи` });
            await dishes.submitExpectSuccess();

            await dishes.filterBySearch(dishName);
            await dishes.filterByCategory('Салат');
            await dishes.assertCardVisible(dishName);
            await expect(dishes.visibleCards()).toHaveCount(1);
        });
    });
});