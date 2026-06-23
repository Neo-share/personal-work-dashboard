import { describe, expect, it } from 'vitest';
import { getPersonalToolRegistry } from './register-tools.js';

describe('registerPersonalTools（F4 MCP）', () => {
  it('包含 mcp.feishu.get_doc 且无需改 chat 路由', () => {
    const registry = getPersonalToolRegistry();
    expect(registry.listTools()).toContain('mcp.feishu.get_doc');
  });
});
