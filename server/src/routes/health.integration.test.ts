import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTrpcTestServer } from '../test/trpc-test-server.js';

/**
 * GET /health 冒烟集成
 */
describe('GET /health 集成', () => {
  let server: FastifyInstance;

  beforeEach(async () => {
    server = await createTrpcTestServer();
  });

  afterEach(async () => {
    await server.close();
  });

  it('返回 ok 与 llmConfigured 字段', async () => {
    const response = await server.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true,
      llmConfigured: expect.any(Boolean),
    });
  });
});
