import { expect, test } from '@playwright/test';

test.describe('开发域 · 扫描中心', () => {
  test('保存工作区路径并提示成功', async ({ page }) => {
    const testPath = `/tmp/pm-e2e-workspace-${Date.now()}`;

    await page.goto('/scan');
    await expect(page.getByRole('heading', { name: '工作区扫描' })).toBeVisible({ timeout: 30_000 });

    const pathInput = page.getByPlaceholder('/Users/ningliu/Documents/CodeLab');
    await pathInput.fill(testPath);
    await page.getByRole('button', { name: '保存路径' }).click();

    await expect(page.getByText('工作区路径已保存')).toBeVisible({ timeout: 15_000 });
    await expect(pathInput).toHaveValue(testPath);
  });
});
