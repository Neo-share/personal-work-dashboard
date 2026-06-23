/** 解析 Fastify inject 返回的 SSE 文本为 data 载荷数组 */
export function parseSsePayloads(raw: string): Record<string, unknown>[] {
  return raw
    .split('\n')
    .filter((line) => line.startsWith('data: '))
    .map((line) => JSON.parse(line.slice(6)) as Record<string, unknown>);
}
