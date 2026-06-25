import { expect, test } from '@playwright/test';
import { gotoPersonalWorkbench } from './helpers';

test.describe('个人工作台 · 首页 smoke', () => {
  test('首页加载并展示统计与双面板', async ({ page }) => {
    await gotoPersonalWorkbench(page);

    await expect(page.getByRole('button', { name: '日程与事项' })).toBeVisible();
    await expect(page.getByRole('button', { name: '定时任务' })).toBeVisible();
    await expect(page.getByText('待办事项')).toBeVisible();
    await expect(page.getByText('我的日程')).toBeVisible();
    await expect(page.getByText('个人助手')).toBeVisible();
    await expect(page.getByText(/日程\s+\d+\s+条/)).toBeVisible();
  });

  test('Tab 切换：日程与事项 ↔ 定时任务', async ({ page }) => {
    await gotoPersonalWorkbench(page);

    await page.getByRole('button', { name: '定时任务' }).click();
    await expect(page.getByRole('heading', { name: '定时任务' })).toBeVisible();

    await page.getByRole('button', { name: '日程与事项' }).click();
    await expect(page.getByText('待办事项')).toBeVisible();
    await expect(page.getByText('我的日程')).toBeVisible();
  });

  test('开发域入口可跳转', async ({ page }) => {
    await gotoPersonalWorkbench(page);

    await page.getByRole('link', { name: '开发域' }).click();
    await expect(page).toHaveURL(/\/dev-dashboard/);
    await expect(page.getByText('个人驾驶舱')).toBeVisible();
    await expect(page.getByRole('link', { name: '工作列表' })).toBeVisible();
  });
});
