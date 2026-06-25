import { expect, test } from '@playwright/test';
import { gotoPersonalWorkbench, mockChatSse } from './helpers';

async function enterModifyMode(page: import('@playwright/test').Page): Promise<void> {
  await gotoPersonalWorkbench(page);

  const aiBar = page.getByRole('button', { name: /已生成结果|AI 结果/ }).first();
  await expect(aiBar).toBeVisible({ timeout: 15_000 });
  await aiBar.click();

  const modifyBtn = page.getByRole('button', { name: '修改结果' }).first();
  await expect(modifyBtn).toBeVisible();
  await modifyBtn.click();

  await expect(page.getByText(/修改模式 · 待办 #\d+/)).toBeVisible();
}

test.describe('个人工作台 · 修改模式', () => {
  test('进入修改模式并展示修改模式 UI', async ({ page }) => {
    await enterModifyMode(page);

    await expect(page.getByRole('button', { name: '退出' })).toBeVisible();
    await expect(page.getByPlaceholder('向个人助手提问')).toBeVisible();
  });

  test('修改模式下发送消息（mock SSE）', async ({ page }) => {
    await mockChatSse(page, [
      JSON.stringify({ type: 'text', content: '已按意见更新' }),
      JSON.stringify({ type: 'refresh', refresh: ['todos'] }),
    ]);

    await enterModifyMode(page);

    const input = page.getByPlaceholder('向个人助手提问');
    await input.fill('把联调进度改成 90%');
    await page.getByRole('button', { name: /发\s*送/ }).click();

    await expect(page.getByText('把联调进度改成 90%')).toBeVisible();
    await expect(page.getByText('已按意见更新')).toBeVisible({ timeout: 15_000 });
  });

  test('退出修改模式后 UI 恢复', async ({ page }) => {
    await enterModifyMode(page);

    await page.getByRole('button', { name: '退出' }).click();
    await expect(page.getByText(/修改模式 · 待办 #\d+/)).not.toBeVisible();
    await expect(page.getByText('个人助手')).toBeVisible();
  });
});
