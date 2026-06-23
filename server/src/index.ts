import cors from '@fastify/cors';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import Fastify from 'fastify';
import { getDb } from './db/index.js';
import { loadServerEnv } from './load-env.js';
import { checkLlmHealth } from './llm/llm-health.js';
import { isLlmConfigured } from './llm/llm-config.js';
import { registerChatRoutes } from './routes/chat.js';
import { startRecurringTaskScheduler } from './services/recurring-task-scheduler.js';
import { createContext } from './trpc/context.js';
import { appRouter } from './trpc/router.js';

const envFile = loadServerEnv();
if (envFile) {
  console.log(`已加载环境变量：${envFile}`);
}

const PORT = Number(process.env.PORT ?? 3100);

async function main() {
  getDb();

  const server = Fastify({
    logger: true,
  });

  await server.register(cors, {
    origin: true,
  });

  await server.register(fastifyTRPCPlugin, {
    prefix: '/trpc',
    trpcOptions: {
      router: appRouter,
      createContext,
    },
  });

  await registerChatRoutes(server);

  server.get('/health', async () => ({
    ok: true,
    llmConfigured: isLlmConfigured(),
  }));

  server.get('/health/llm', async () => checkLlmHealth());

  await server.listen({ port: PORT, host: '0.0.0.0' });
  startRecurringTaskScheduler();
  console.log(`Project manager API running at http://localhost:${PORT}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
