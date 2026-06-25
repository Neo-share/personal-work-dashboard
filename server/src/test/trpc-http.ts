import type { FastifyInstance } from 'fastify';

/** tRPC v11 HTTP 响应（本项目未启用 superjson，input/output 为裸 JSON） */
export type TrpcHttpBody<T = unknown> = {
  result?: { data: T };
  error?: {
    message?: string;
    code?: number;
    data?: { code?: string; httpStatus?: number };
  };
};

function parseBody<T>(responseBody: string): TrpcHttpBody<T> {
  return JSON.parse(responseBody) as TrpcHttpBody<T>;
}

/** GET query：/trpc/procedure?input=encodeURIComponent(JSON.stringify(input)) */
export async function trpcQuery<TInput, TOutput>(
  server: FastifyInstance,
  procedure: string,
  input?: TInput,
): Promise<{ statusCode: number; data: TOutput; body: TrpcHttpBody<TOutput> }> {
  const encoded = encodeURIComponent(JSON.stringify(input ?? null));
  const response = await server.inject({
    method: 'GET',
    url: `/trpc/${procedure}?input=${encoded}`,
  });
  const body = parseBody<TOutput>(response.body);
  if (body.error) {
    throw new Error(body.error.message ?? 'tRPC query failed');
  }
  return {
    statusCode: response.statusCode,
    data: body.result!.data,
    body,
  };
}

/** POST mutation：body 为 procedure input 对象 */
export async function trpcMutation<TInput, TOutput>(
  server: FastifyInstance,
  procedure: string,
  input: TInput,
): Promise<{ statusCode: number; data: TOutput; body: TrpcHttpBody<TOutput> }> {
  const response = await server.inject({
    method: 'POST',
    url: `/trpc/${procedure}`,
    payload: input,
  });
  const body = parseBody<TOutput>(response.body);
  if (body.error) {
    throw new Error(body.error.message ?? 'tRPC mutation failed');
  }
  return {
    statusCode: response.statusCode,
    data: body.result!.data,
    body,
  };
}

/** mutation 预期失败：返回 error 体供 Zod/业务错误断言 */
export async function trpcMutationExpectError(
  server: FastifyInstance,
  procedure: string,
  input: unknown,
): Promise<{ statusCode: number; body: TrpcHttpBody }> {
  const response = await server.inject({
    method: 'POST',
    url: `/trpc/${procedure}`,
    payload: input,
  });
  return {
    statusCode: response.statusCode,
    body: parseBody(response.body),
  };
}

/** query 预期失败 */
export async function trpcQueryExpectError(
  server: FastifyInstance,
  procedure: string,
  input?: unknown,
): Promise<{ statusCode: number; body: TrpcHttpBody }> {
  const encoded = encodeURIComponent(JSON.stringify(input ?? null));
  const response = await server.inject({
    method: 'GET',
    url: `/trpc/${procedure}?input=${encoded}`,
  });
  return {
    statusCode: response.statusCode,
    body: parseBody(response.body),
  };
}
