import { expect, type Locator, type Page } from '@playwright/test';

export interface ProductInput {
    name: string;
    calories?: string;
    proteins?: string;
    fats?: string;
    carbohydrates?: string;
    composition?: string;
    category?: string;
    cookingRequirement?: string;
    vegan?: boolean;
}

export class ProductPage {
    constructor(private readonly page: Page) {}

    readonly section = this.page.getByTestId('products-section');
    readonly createButton = this.page.getByTestId('create-product-button');
    readonly modal = this.page.getByTestId('product-modal');
    readonly searchInput = this.page.getByTestId('product-search-input');
    readonly categoryFilter = this.page.getByTestId('product-category-filter');
    readonly veganFilter = this.page.getByTestId('product-flag-vegan');

    async goto(): Promise<void> {
        await this.page.goto('http://localhost:5173');
        await expect(this.section).toBeVisible({ timeout: 15000 });
    }

    async openCreateForm(): Promise<void> {
        await this.createButton.click();
        await expect(this.modal).toBeVisible({ timeout: 10000 });
    }

    async fillForm(input: ProductInput): Promise<void> {
        await this.page.getByTestId('product-name-input').fill(input.name);
        await this.page.getByTestId('product-category-select').selectOption(input.category ?? 'Овощи');
        await this.page.getByTestId('product-cooking-requirement-select').selectOption(input.cookingRequirement ?? 'Готовый к употреблению');
        await this.page.getByTestId('product-calories-input').fill(input.calories ?? '120');
        await this.page.getByTestId('product-proteins-input').fill(input.proteins ?? '10');
        await this.page.getByTestId('product-fats-input').fill(input.fats ?? '5');
        await this.page.getByTestId('product-carbohydrates-input').fill(input.carbohydrates ?? '3');
        await this.page.getByTestId('product-composition-textarea').fill(input.composition ?? 'Тестовый состав продукта');

        const veganCheckbox = this.page.getByTestId('product-flag-vegan-checkbox');
        if ((input.vegan ?? false) && !(await veganCheckbox.isChecked())) {
            await veganCheckbox.check();
        }
    }

    async submitExpectSuccess(): Promise<void> {
        await this.page.getByTestId('product-submit-button').click();
        await expect(this.modal).not.toBeVisible({ timeout: 10000 });
        await this.page.waitForSelector('.modal-backdrop', { state: 'detached', timeout: 10000 });
    }

    async submitExpectValidationError(): Promise<void> {
        await this.page.getByTestId('product-submit-button').click();
        await expect(this.modal).toBeVisible({ timeout: 5000 });
    }

    cardByName(name: string): Locator {
        return this.page.locator('.entity-card').filter({
            has: this.page.locator('h3', { hasText: name }),
        }).first();
    }

    async assertCardVisible(name: string): Promise<void> {
        await expect(this.cardByName(name)).toBeVisible({ timeout: 10000 });
    }

    async assertCardAbsent(name: string): Promise<void> {
        await expect(this.cardByName(name)).toHaveCount(0);
    }

    async openEdit(name: string): Promise<void> {
        await this.cardByName(name).locator('button', { hasText: 'Изменить' }).click();
        await expect(this.modal).toBeVisible({ timeout: 10000 });
    }

    async openDetails(name: string): Promise<void> {
        await this.cardByName(name).locator('button', { hasText: 'Подробнее' }).click();
        await expect(this.page.getByRole('heading', { name })).toBeVisible({ timeout: 10000 });
    }

    async delete(name: string): Promise<void> {
        this.page.on('dialog', dialog => dialog.accept());
        await this.cardByName(name).locator('button', { hasText: 'Удалить' }).click();
    }

    async filterBySearch(value: string): Promise<void> {
        await this.searchInput.fill(value);
    }

    async filterByCategory(value: string): Promise<void> {
        await this.categoryFilter.selectOption(value);
    }

    async filterByVegan(): Promise<void> {
        await this.veganFilter.check();
    }

    visibleCards(): Locator {
        return this.page.locator('.entity-card');
    }
}
