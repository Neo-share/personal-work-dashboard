import type {
  PersonalToolName,
  ToolContext,
  ToolDefinition,
  ToolInvokeResult,
  ToolRegistry,
} from '@project-manager/shared';
import type { ZodType } from 'zod';

export class ToolNotRegisteredError extends Error {
  constructor(tool: PersonalToolName) {
    super(`工具未注册: ${tool}`);
    this.name = 'ToolNotRegisteredError';
  }
}

export class ToolParamsValidationError extends Error {
  constructor(tool: PersonalToolName, message: string) {
    super(`工具参数校验失败 (${tool}): ${message}`);
    this.name = 'ToolParamsValidationError';
  }
}

/** F0 契约：白名单注册 + Zod 校验 + invoke */
export class PersonalToolRegistry implements ToolRegistry {
  private readonly tools = new Map<PersonalToolName, ToolDefinition>();

  register<TParams, TResult>(def: ToolDefinition<TParams, TResult>): void {
    if (this.tools.has(def.name)) {
      throw new Error(`工具已注册: ${def.name}`);
    }
    this.tools.set(def.name, def as ToolDefinition);
  }

  listTools(): PersonalToolName[] {
    return [...this.tools.keys()];
  }

  async invoke(
    tool: PersonalToolName,
    params: unknown,
    ctx: ToolContext,
  ): Promise<ToolInvokeResult> {
    const def = this.tools.get(tool);
    if (!def) {
      throw new ToolNotRegisteredError(tool);
    }

    const schema = def.paramsSchema as ZodType;
    const parsed = schema.safeParse(params);
    if (!parsed.success) {
      throw new ToolParamsValidationError(tool, parsed.error.message);
    }

    const started = Date.now();
    let ok = true;
    try {
      const payload = await def.execute(parsed.data, ctx);
      return {
        tool,
        refresh: (payload as ToolInvokeResult | undefined)?.refresh,
        payload,
      };
    } catch (error) {
      ok = false;
      throw error;
    } finally {
      ctx.metrics.record({
        name: 'pw.tool.invoked',
        ts: new Date().toISOString(),
        tags: { tool, ok: String(ok) },
        value: Date.now() - started,
      });
    }
  }
}

export function createPersonalToolRegistry(): PersonalToolRegistry {
  return new PersonalToolRegistry();
}
