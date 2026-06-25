import { expect, test } from '@playwright/test';
import { mockChatSse } from './helpers';

test.describe('开发域 · 助手导航', () => {
  test('助手 filterRequirements 写入 URL 并生效', async ({ page }) => {
    await mockChatSse(page, [
      JSON.stringify({ type: 'text', content: '已为你筛选联调中的工作项。' }),
      JSON.stringify({
        type: 'action',
        action: { type: 'filterRequirements', payload: { status: 'integrating' } },
      }),
      JSON.stringify({ type: 'done' }),
    ]);

    await page.goto('/dev-dashboard');
    await expect(page.getByText('个人驾驶舱')).toBeVisible({ timeout: 30_000 });

    await page.getByRole('button', { name: '对话助手' }).click();
    await expect(page.getByRole('dialog', { name: '对话助手' })).toBeVisible();

    await page.getByPlaceholder('例如：打开新增会员权益页任务详情').fill('筛选联调中的任务');
    await page.getByRole('button', { name: '发 送' }).click();

    await expect(page).toHaveURL(/\/requirements\?.*status=integrating/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: '工作列表' })).toBeVisible();
    await expect(page.getByText('已触发导航：filterRequirements')).toBeVisible();
  });

  test('助手 openScanCenter 跳转到扫描页', async ({ page }) => {
    await mockChatSse(page, [
      JSON.stringify({ type: 'text', content: '正在打开扫描中心。' }),
      JSON.stringify({ type: 'action', action: { type: 'openScanCenter' } }),
      JSON.stringify({ type: 'done' }),
    ]);

    await page.goto('/requirements');
    await expect(page.getByRole('heading', { name: '工作列表' })).toBeVisible({ timeout: 30_000 });

    await page.getByRole('button', { name: '对话助手' }).click();
    await page.getByPlaceholder('例如：打开新增会员权益页任务详情').fill('打开扫描中心');
    await page.getByRole('button', { name: '发 送' }).click();

    await expect(page).toHaveURL(/\/scan/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: '工作区扫描' })).toBeVisible();
  });
});
