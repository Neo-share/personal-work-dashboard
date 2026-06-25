import { expect, test } from '@playwright/test';
import { gotoPersonalWorkbench } from './helpers';

test.describe('个人工作台 · 待办 CRUD', () => {
  test('通过 UI 添加待办并在列表中可见', async ({ page }) => {
    const title = `E2E待办-${Date.now()}`;

    await gotoPersonalWorkbench(page);

    await page.getByRole('button', { name: '+ 添加事项' }).click();
    await expect(page.getByRole('dialog', { name: '添加事项' })).toBeVisible();

    await page.getByLabel('任务名称').fill(title);
    await page.getByRole('button', { name: '确 定' }).click();

    await expect(page.getByRole('dialog', { name: '添加事项' })).not.toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(title)).toBeVisible({ timeout: 15_000 });
  });
});
