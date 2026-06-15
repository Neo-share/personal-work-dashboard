import type { FastifyInstance } from 'fastify';
import { resolveAssistantIntent } from '../services/assistant-service.js';

export async function registerChatRoutes(server: FastifyInstance) {
  server.post('/api/chat', async (request, reply) => {
    const body = request.body as { message?: string };
    const message = body.message?.trim() ?? '';

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    const result = resolveAssistantIntent(message);
    const chunks = result.reply.split(/(?<=。)/);

    for (const chunk of chunks) {
      if (!chunk) continue;
      reply.raw.write(`data: ${JSON.stringify({ type: 'text', content: chunk })}\n\n`);
      await new Promise((resolve) => setTimeout(resolve, 120));
    }

    if (result.action) {
      reply.raw.write(
        `data: ${JSON.stringify({ type: 'action', action: result.action })}\n\n`,
      );
    }

    reply.raw.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    reply.raw.end();
  });
}
