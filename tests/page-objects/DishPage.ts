import { expect, type Locator, type Page } from '@playwright/test';

export interface DishInput {
    name: string;
    category?: string;
    portionSize?: string;
    quantity?: string;
    productOptionLabel?: string;
}

export class DishPage {
    constructor(private readonly page: Page) {}

    readonly dishesTab = this.page.getByRole('button', { name: 'Блюда' });
    readonly createButton = this.page.getByRole('button', { name: 'Новое блюдо' });
    readonly emptyCreateButton = this.page.getByRole('button', { name: 'Добавить блюдо' });
    readonly saveButton = this.page.getByRole('button', { name: 'Сохранить' });
    readonly searchInput = this.page.getByPlaceholder('Название');

    async openSection(): Promise<void> {
        await this.dishesTab.click();
        await expect(this.page.getByText('Сборка порций и рецептов')).toBeVisible({ timeout: 10000 });
    }

    async openCreateForm(): Promise<void> {
        if (await this.createButton.isVisible()) {
            await this.createButton.click();
        } else {
            await this.emptyCreateButton.click();
        }
        await expect(this.page.getByRole('heading', { name: 'Новое блюдо' })).toBeVisible({ timeout: 10000 });
    }

    modal(): Locator {
        return this.page.locator('.modal-backdrop').last();
    }

    async fillForm(input: DishInput): Promise<void> {
        const modal = this.modal();
        await modal.getByLabel('Название').fill(input.name);
        await modal.getByLabel('Категория').selectOption(input.category ?? 'Салат');
        await modal.getByLabel('Размер порции, г').fill(input.portionSize ?? '150');

        const productSelect = modal.getByLabel('Продукт').first();
        if (input.productOptionLabel) {
            await productSelect.selectOption({ label: input.productOptionLabel });
        } else {
            const value = await productSelect.locator('option:not([value=""])').first().getAttribute('value');
            expect(value).not.toBeNull();
            await productSelect.selectOption(value!);
        }

        await modal.getByLabel('Количество, г').first().fill(input.quantity ?? '150');
        await modal.getByRole('button', { name: 'Подставить расчёт' }).click();
    }

    async submitExpectSuccess(): Promise<void> {
        await this.saveButton.click();
        await expect(this.page.locator('.modal-backdrop')).toHaveCount(0, { timeout: 10000 });
    }

    async submitExpectValidationError(): Promise<void> {
        await this.saveButton.click();
        await expect(this.page.locator('.modal-backdrop')).toBeVisible({ timeout: 5000 });
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

    async openDetails(name: string): Promise<void> {
        await this.cardByName(name).locator('button', { hasText: 'Подробнее' }).click();
        await expect(this.page.getByRole('heading', { name })).toBeVisible({ timeout: 10000 });
    }

    async openEdit(name: string): Promise<void> {
        await this.cardByName(name).locator('button', { hasText: 'Изменить' }).click();
        await expect(this.modal()).toBeVisible({ timeout: 10000 });
    }

    async delete(name: string): Promise<void> {
        this.page.on('dialog', dialog => dialog.accept());
        await this.cardByName(name).locator('button', { hasText: 'Удалить' }).click();
    }

    async filterBySearch(value: string): Promise<void> {
        await this.searchInput.fill(value);
    }

    async filterByCategory(value: string): Promise<void> {
        await this.page.getByLabel('Категория').first().selectOption(value);
    }

    visibleCards(): Locator {
        return this.page.locator('.entity-card');
    }
}
