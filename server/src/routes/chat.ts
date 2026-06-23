import type { FastifyInstance } from 'fastify';
import { resolveAssistantIntent } from '../services/assistant-service.js';
import {
  isGuardrailBlocked,
  resolvePersonalAssistantIntent,
} from '../services/personal-assistant-service.js';

export async function registerChatRoutes(server: FastifyInstance) {
  server.post('/api/chat', async (request, reply) => {
    const body = request.body as {
      message?: string;
      context?: 'personal' | 'dev';
      modifyTodoId?: number;
      sessionId?: number;
    };
    const message = body.message?.trim() ?? '';
    const context = body.context ?? 'dev';

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    try {
      if (!message) {
        reply.raw.write(
          `data: ${JSON.stringify({ type: 'error', message: '请输入内容后再发送。' })}\n\n`,
        );
        reply.raw.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
        reply.raw.end();
        return;
      }

      if (context === 'personal') {
        const result = await resolvePersonalAssistantIntent(message, {
          modifyTodoId: body.modifyTodoId,
          sessionId: body.sessionId,
        });

        if (isGuardrailBlocked(result)) {
          reply.raw.write(
            `data: ${JSON.stringify({
              type: 'blocked',
              code: result.code,
              message: result.message,
            })}\n\n`,
          );
          reply.raw.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
          reply.raw.end();
          return;
        }

        await streamAssistantResult(reply, result);
        return;
      }

      const result = resolveAssistantIntent(message);
      await streamAssistantResult(reply, result);
    } catch (error) {
      const errMessage = error instanceof Error ? error.message : '助手处理失败';
      console.error('[pw.metrics]', JSON.stringify({ event: 'pw.chat.error', message: errMessage }));
      reply.raw.write(
        `data: ${JSON.stringify({ type: 'error', message: '助手暂时不可用，请稍后再试。' })}\n\n`,
      );
      reply.raw.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
      reply.raw.end();
    }
  });
}

async function streamAssistantResult(
  reply: { raw: NodeJS.WritableStream },
  result: {
    reply: string;
    action?: unknown;
    refresh?: string[];
    modifyTodoId?: number;
    modifyVersion?: number;
  },
): Promise<void> {
  const chunks = result.reply.split(/(?<=。)/);

  for (const chunk of chunks) {
    if (!chunk) continue;
    reply.raw.write(`data: ${JSON.stringify({ type: 'text', content: chunk })}\n\n`);
    await new Promise((resolve) => setTimeout(resolve, 120));
  }

  if ('action' in result && result.action) {
    reply.raw.write(`data: ${JSON.stringify({ type: 'action', action: result.action })}\n\n`);
  }

  if ('refresh' in result && result.refresh) {
    reply.raw.write(
      `data: ${JSON.stringify({ type: 'refresh', refresh: result.refresh })}\n\n`,
    );
  }

  if ('modifyTodoId' in result && result.modifyTodoId) {
    reply.raw.write(
      `data: ${JSON.stringify({
        type: 'modifyMode',
        modifyTodoId: result.modifyTodoId,
        modifyVersion: result.modifyVersion,
      })}\n\n`,
    );
  }

  reply.raw.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
  reply.raw.end();
}
