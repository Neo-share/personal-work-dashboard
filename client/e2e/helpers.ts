import type { APIRequestContext, Page } from '@playwright/test';

/** tRPC v11 HTTP 响应（与 server/src/test/trpc-http.ts 一致） */
type TrpcHttpBody<T = unknown> = {
  result?: { data: T };
  error?: { message?: string };
};

/** POST mutation：/trpc/{procedure} */
export async function trpcMutation<TOutput>(
  request: APIRequestContext,
  procedure: string,
  input: unknown,
): Promise<TOutput> {
  const response = await request.post(`/trpc/${procedure}`, { data: input });
  const body = (await response.json()) as TrpcHttpBody<TOutput>;
  if (body.error) {
    throw new Error(body.error.message ?? `tRPC mutation failed: ${procedure}`);
  }
  return body.result!.data;
}

/** GET query：/trpc/{procedure}?input=... */
export async function trpcQuery<TOutput>(
  request: APIRequestContext,
  procedure: string,
  input?: unknown,
): Promise<TOutput> {
  const encoded = encodeURIComponent(JSON.stringify(input ?? null));
  const response = await request.get(`/trpc/${procedure}?input=${encoded}`);
  const body = (await response.json()) as TrpcHttpBody<TOutput>;
  if (body.error) {
    throw new Error(body.error.message ?? `tRPC query failed: ${procedure}`);
  }
  return body.result!.data;
}

/** 等待个人工作台首页就绪 */
export async function gotoPersonalWorkbench(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByText('个人工作台').first().waitFor({ state: 'visible', timeout: 30_000 });
}

/** mock POST /api/chat 的 SSE 响应 */
export async function mockChatSse(page: Page, chunks: string[]): Promise<void> {
  const body = chunks.map((chunk) => `data: ${chunk}\n\n`).join('');
  await page.route('**/api/chat', async (route) => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
      body,
    });
  });
}
