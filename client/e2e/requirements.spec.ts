import { expect, test } from '@playwright/test';
import { trpcQuery } from './helpers';

test.describe('开发域 · 工作列表与详情', () => {
  test('URL 状态筛选与清除', async ({ page }) => {
    await page.goto('/requirements?status=developing');
    await expect(page.getByRole('heading', { name: '工作列表' })).toBeVisible({ timeout: 30_000 });

    // Ant Design Select 选中后展示中文标签
    await expect(page.getByText('开发中').first()).toBeVisible();

    await page.getByRole('button', { name: '清除筛选' }).click();
    await expect(page).toHaveURL('/requirements');
  });

  test('打开种子工作项详情页并展示关键区块', async ({ page, request }) => {
    const list = await trpcQuery<Array<{ id: number; name: string }>>(request, 'requirements.list', {});
    const seeded = list.find((item) => item.name === '新增会员权益页');
    test.skip(!seeded, '种子数据不存在，跳过详情页测试');

    await page.goto(`/requirements/${seeded!.id}`);
    await expect(page.getByRole('heading', { name: '新增会员权益页' })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole('link', { name: '返回工作列表' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '关联链接' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '关联仓库' })).toBeVisible();
    await expect(page.getByRole('rowheader', { name: '工作域' })).toBeVisible();
    await expect(page.getByRole('rowheader', { name: '状态' })).toBeVisible();
  });

  test('从列表点击进入详情', async ({ page, request }) => {
    const list = await trpcQuery<Array<{ id: number; name: string }>>(request, 'requirements.list', {});
    test.skip(list.length === 0, '无工作项数据');

    await page.goto('/requirements');
    await expect(page.getByRole('heading', { name: '工作列表' })).toBeVisible({ timeout: 30_000 });

    const firstName = list[0]!.name;
    await page.getByRole('link', { name: firstName }).first().click();
    await expect(page.getByRole('heading', { name: firstName })).toBeVisible({ timeout: 15_000 });
  });
});
