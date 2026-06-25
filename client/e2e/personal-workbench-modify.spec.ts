import { expect, test } from '@playwright/test';

test.describe('个人工作台 · 修改模式', () => {
  test('进入修改模式并展示修改模式 UI', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText('个人工作台').first()).toBeVisible({ timeout: 30_000 });

    const aiBar = page.getByRole('button', { name: /已生成结果|AI 结果/ }).first();
    await expect(aiBar).toBeVisible({ timeout: 15_000 });
    await aiBar.click();

    const modifyBtn = page.getByRole('button', { name: '修改结果' }).first();
    await expect(modifyBtn).toBeVisible();
    await modifyBtn.click();

    await expect(page.getByText(/修改模式 · 待办 #\d+/)).toBeVisible();
    await expect(page.getByRole('button', { name: '退出' })).toBeVisible();
    await expect(page.getByPlaceholder('向个人助手提问')).toBeVisible();
  });

  test('修改模式下发送消息（mock SSE）', async ({ page }) => {
    await page.route('**/api/chat', async (route) => {
      const body =
        'data: {"type":"text","content":"已按意见更新"}\n\n' +
        'data: {"type":"refresh","refresh":["todos"]}\n\n';
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body,
      });
    });

    await page.goto('/');
    await expect(page.getByText('个人工作台').first()).toBeVisible({ timeout: 30_000 });

    await page.getByRole('button', { name: /已生成结果|AI 结果/ }).first().click();
    await page.getByRole('button', { name: '修改结果' }).first().click();
    await expect(page.getByText(/修改模式 · 待办 #\d+/)).toBeVisible();

    const input = page.getByPlaceholder('向个人助手提问');
    await input.fill('把联调进度改成 90%');
    await page.getByRole('button', { name: /发\s*送/ }).click();

    await expect(page.getByText('把联调进度改成 90%')).toBeVisible();
    await expect(page.getByText('已按意见更新')).toBeVisible({ timeout: 15_000 });
  });
});
