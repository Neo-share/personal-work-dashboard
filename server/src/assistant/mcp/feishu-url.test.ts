import { describe, expect, it } from 'vitest';
import { extractFeishuDocRefs } from './feishu-url.js';

describe('extractFeishuDocRefs', () => {
  it('提取 wiki 与 docx 链接', () => {
    const message =
      '请参考 https://example.feishu.cn/wiki/AbCdEf 和 https://team.larksuite.com/docx/XyZ123 整理方案';
    expect(extractFeishuDocRefs(message)).toEqual([
      'https://example.feishu.cn/wiki/AbCdEf',
      'https://team.larksuite.com/docx/XyZ123',
    ]);
  });

  it('无飞书链接时返回空数组', () => {
    expect(extractFeishuDocRefs('明天下午3点开会')).toEqual([]);
  });
});
