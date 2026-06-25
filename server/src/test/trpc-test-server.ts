import cors from '@fastify/cors';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import Fastify from 'fastify';
import { isLlmConfigured } from '../llm/llm-config.js';
import { createContext } from '../trpc/context.js';
import { appRouter } from '../trpc/router.js';

/** 集成测专用：挂载 /trpc 与 /health，不 listen、不启动调度器 */
export async function createTrpcTestServer() {
  const server = Fastify({ logger: false });

  await server.register(cors, { origin: true });

  await server.register(fastifyTRPCPlugin, {
    prefix: '/trpc',
    trpcOptions: {
      router: appRouter,
      createContext,
    },
  });

  server.get('/health', async () => ({
    ok: true,
    llmConfigured: isLlmConfigured(),
  }));

  await server.ready();
  return server;
}
