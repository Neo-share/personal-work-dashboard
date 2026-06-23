import Fastify from 'fastify';
import { registerChatRoutes } from '../routes/chat.js';

/** 集成测专用：仅挂载 /api/chat，避免 listen 与调度器副作用 */
export async function createChatTestServer() {
  const server = Fastify({ logger: false });
  await registerChatRoutes(server);
  await server.ready();
  return server;
}
