/** 飞书 docx block → Markdown（F4 摘要场景，不下载图片） */

const BlockType = {
  PAGE: 1,
  TEXT: 2,
  HEADING1: 3,
  HEADING2: 4,
  HEADING3: 5,
  HEADING4: 6,
  HEADING5: 7,
  HEADING6: 8,
  HEADING7: 9,
  HEADING8: 10,
  HEADING9: 11,
  BULLET: 12,
  ORDERED: 13,
  CODE: 14,
  QUOTE: 15,
  TODO: 17,
  BITABLE: 18,
  CALLOUT: 19,
  CHAT_CARD: 20,
  DIAGRAM: 21,
  DIVIDER: 22,
  FILE: 23,
  GRID: 24,
  GRID_COLUMN: 25,
  IFRAME: 26,
  IMAGE: 27,
  ISV: 28,
  MINDNOTE: 29,
  SHEET: 30,
  TABLE: 31,
  TABLE_CELL: 32,
  VIEW: 33,
  QUOTE_CONTAINER: 34,
  TASK: 35,
  OKR: 36,
  OKR_OBJECTIVE: 37,
  OKR_KEY_RESULT: 38,
  OKR_PROGRESS: 39,
} as const;

const CODE_LANG_MAP: Record<number, string> = {
  1: 'plaintext',
  7: 'bash',
  8: 'csharp',
  9: 'cpp',
  10: 'c',
  12: 'css',
  22: 'go',
  24: 'html',
  28: 'json',
  29: 'java',
  30: 'javascript',
  32: 'kotlin',
  39: 'markdown',
  43: 'php',
  49: 'python',
  52: 'ruby',
  53: 'rust',
  56: 'sql',
  63: 'typescript',
  66: 'xml',
  67: 'yaml',
};

type FeishuBlock = {
  block_id: string;
  block_type: number;
  children?: string[];
  page?: { elements?: FeishuTextElement[] };
  text?: { elements?: FeishuTextElement[] };
  heading1?: { elements?: FeishuTextElement[] };
  heading2?: { elements?: FeishuTextElement[] };
  heading3?: { elements?: FeishuTextElement[] };
  heading4?: { elements?: FeishuTextElement[] };
  heading5?: { elements?: FeishuTextElement[] };
  heading6?: { elements?: FeishuTextElement[] };
  heading7?: { elements?: FeishuTextElement[] };
  heading8?: { elements?: FeishuTextElement[] };
  heading9?: { elements?: FeishuTextElement[] };
  bullet?: { elements?: FeishuTextElement[] };
  ordered?: { elements?: FeishuTextElement[] };
  code?: { elements?: FeishuTextElement[]; style?: { language?: number } };
  quote?: { elements?: FeishuTextElement[] };
  todo?: { elements?: FeishuTextElement[]; style?: { done?: boolean } };
  table?: {
    cells?: string[];
    property?: {
      row_size?: number;
      column_size?: number;
      merge_info?: Array<{ row_span?: number; col_span?: number }>;
    };
  };
  iframe?: { component?: { url?: string } };
  file?: { name?: string };
};

type FeishuTextElement = {
  equation?: { content?: string };
  mention_doc?: {
    url?: string;
    text_element_style?: { link?: { url?: string } };
  };
  mention_user?: { user_id?: string };
  text_run?: {
    content?: string;
    text_element_style?: {
      link?: { url?: string };
      bold?: boolean;
      italic?: boolean;
      strikethrough?: boolean;
      inline_code?: boolean;
    };
  };
};

const BLOCK_TYPE_KEY: Partial<Record<number, keyof FeishuBlock>> = {
  [BlockType.PAGE]: 'page',
  [BlockType.TEXT]: 'text',
  [BlockType.HEADING1]: 'heading1',
  [BlockType.HEADING2]: 'heading2',
  [BlockType.HEADING3]: 'heading3',
  [BlockType.HEADING4]: 'heading4',
  [BlockType.HEADING5]: 'heading5',
  [BlockType.HEADING6]: 'heading6',
  [BlockType.HEADING7]: 'heading7',
  [BlockType.HEADING8]: 'heading8',
  [BlockType.HEADING9]: 'heading9',
  [BlockType.BULLET]: 'bullet',
  [BlockType.ORDERED]: 'ordered',
  [BlockType.CODE]: 'code',
  [BlockType.QUOTE]: 'quote',
  [BlockType.TODO]: 'todo',
};

function renderTextElement(el: FeishuTextElement): string {
  if (el.equation) {
    return `$${el.equation.content ?? ''}$`;
  }

  if (el.mention_doc) {
    const url = el.mention_doc.url ? decodeURIComponent(el.mention_doc.url) : '';
    const title = el.mention_doc.text_element_style?.link?.url
      ? decodeURIComponent(el.mention_doc.text_element_style.link.url)
      : url;
    return url ? `[${title || '文档链接'}](${url})` : '[文档链接]';
  }

  if (el.mention_user) {
    return `@${el.mention_user.user_id ?? '用户'}`;
  }

  const run = el.text_run;
  if (!run) {
    return '';
  }

  let text = run.content ?? '';
  const style = run.text_element_style;
  if (!style) {
    return text;
  }

  if (style.link?.url) {
    text = `[${text}](${decodeURIComponent(style.link.url)})`;
  }
  if (style.bold) {
    text = `**${text}**`;
  }
  if (style.italic) {
    text = `*${text}*`;
  }
  if (style.strikethrough) {
    text = `~~${text}~~`;
  }
  if (style.inline_code) {
    text = `\`${text}\``;
  }

  return text;
}

function renderTextElements(elements?: FeishuTextElement[]): string {
  return (elements ?? []).map(renderTextElement).join('');
}

function getTextData(block: FeishuBlock) {
  const key = BLOCK_TYPE_KEY[block.block_type];
  if (!key) {
    return null;
  }
  const data = block[key];
  return data && typeof data === 'object' && 'elements' in data
    ? (data as { elements?: FeishuTextElement[] })
    : null;
}

class BlocksToMarkdown {
  private blockMap: Map<string, FeishuBlock>;

  constructor(blockMap: Map<string, FeishuBlock>) {
    this.blockMap = blockMap;
  }

  convert(rootId: string): string {
    const root = this.blockMap.get(rootId);
    if (!root) {
      return '';
    }
    return this.renderChildren(root.children, 0).join('\n');
  }

  private renderChildren(childIds: string[] | undefined, depth: number): string[] {
    if (!childIds?.length) {
      return [];
    }

    const lines: string[] = [];
    let orderedIdx = 1;

    for (const id of childIds) {
      const block = this.blockMap.get(id);
      if (!block) {
        continue;
      }

      if (block.block_type === BlockType.ORDERED) {
        lines.push(...this.renderBlock(block, depth, orderedIdx));
        orderedIdx += 1;
      } else {
        orderedIdx = 1;
        lines.push(...this.renderBlock(block, depth));
      }
    }

    return lines;
  }

  private renderBlock(block: FeishuBlock, depth: number, orderedIdx?: number): string[] {
    const t = block.block_type;
    const indent = '  '.repeat(depth);

    switch (t) {
      case BlockType.PAGE:
        return this.renderChildren(block.children, depth);
      case BlockType.TEXT: {
        const text = this.renderText(block);
        const childLines = this.renderChildren(block.children, depth);
        return [text, ...childLines, ''];
      }
      case BlockType.HEADING1:
      case BlockType.HEADING2:
      case BlockType.HEADING3:
      case BlockType.HEADING4:
      case BlockType.HEADING5:
      case BlockType.HEADING6:
      case BlockType.HEADING7:
      case BlockType.HEADING8:
      case BlockType.HEADING9: {
        const level = t - BlockType.HEADING1 + 1;
        const hashes = '#'.repeat(Math.min(level, 6));
        return ['', `${hashes} ${this.renderText(block)}`, ''];
      }
      case BlockType.BULLET:
        return [
          `${indent}- ${this.renderText(block)}`,
          ...this.renderChildren(block.children, depth + 1),
        ];
      case BlockType.ORDERED:
        return [
          `${indent}${orderedIdx ?? 1}. ${this.renderText(block)}`,
          ...this.renderChildren(block.children, depth + 1),
        ];
      case BlockType.TODO: {
        const done = block.todo?.style?.done ? 'x' : ' ';
        return [`${indent}- [${done}] ${this.renderText(block)}`];
      }
      case BlockType.CODE: {
        const lang = CODE_LANG_MAP[block.code?.style?.language ?? 0] ?? '';
        const text = this.renderText(block);
        return ['', `\`\`\`${lang}`, text, '```', ''];
      }
      case BlockType.QUOTE: {
        const text = this.renderText(block);
        return ['', ...text.split('\n').map((line) => `> ${line}`), ''];
      }
      case BlockType.QUOTE_CONTAINER: {
        const childLines = this.renderChildren(block.children, depth);
        return ['', ...childLines.map((line) => `> ${line}`), ''];
      }
      case BlockType.DIVIDER:
        return ['', '---', ''];
      case BlockType.IMAGE:
        return ['[图片]', ''];
      case BlockType.CALLOUT: {
        const childLines = this.renderChildren(block.children, 0).filter((line) => line !== '');
        return ['', `> **提示** ${childLines.join('\n')}`, ''];
      }
      case BlockType.TABLE:
        return this.renderTable(block);
      case BlockType.GRID:
        return this.renderGrid(block);
      case BlockType.IFRAME: {
        const url = block.iframe?.component?.url;
        return url ? [`[内嵌内容](${decodeURIComponent(url)})`, ''] : ['[内嵌内容]', ''];
      }
      case BlockType.FILE:
        return [`[附件: ${block.file?.name ?? '文件'}]`];
      case BlockType.BITABLE:
        return ['[多维表格]', ''];
      case BlockType.SHEET:
        return ['[电子表格]', ''];
      case BlockType.DIAGRAM:
        return ['[流程图/UML]', ''];
      case BlockType.MINDNOTE:
        return ['[思维笔记]', ''];
      case BlockType.VIEW:
      case BlockType.TABLE_CELL:
      case BlockType.GRID_COLUMN:
        return [];
      default:
        return [];
    }
  }

  private renderText(block: FeishuBlock): string {
    return renderTextElements(getTextData(block)?.elements);
  }

  private renderTable(block: FeishuBlock): string[] {
    const table = block.table;
    if (!table) {
      return ['[表格]', ''];
    }

    const { row_size: rowSize, column_size: columnSize, merge_info: mergeInfo } =
      table.property ?? {};
    const cellIds = table.cells ?? [];
    if (!rowSize || !columnSize) {
      return ['[表格]', ''];
    }

    const rows: Array<Array<string | null>> = [];
    for (let r = 0; r < rowSize; r += 1) {
      const row: Array<string | null> = [];
      for (let c = 0; c < columnSize; c += 1) {
        const idx = r * columnSize + c;
        const mergeCell = mergeInfo?.[idx];
        if (mergeCell && (mergeCell.row_span === 0 || mergeCell.col_span === 0)) {
          row.push(null);
          continue;
        }

        const cellId = cellIds[idx];
        const cellBlock = cellId ? this.blockMap.get(cellId) : null;
        if (cellBlock) {
          const cellText = this.renderChildren(cellBlock.children, 0)
            .filter((line) => line !== '')
            .join('<br>')
            .replace(/\|/g, '\\|');
          row.push(cellText || ' ');
        } else {
          row.push(' ');
        }
      }
      rows.push(row);
    }

    const visibleRows = rows.map((row) => row.map((cell) => (cell === null ? '' : cell)));
    if (visibleRows.length === 0) {
      return ['[空表格]', ''];
    }

    const lines: string[] = [];
    const header = visibleRows[0];
    lines.push(`| ${header.join(' | ')} |`);
    lines.push(`| ${header.map(() => '---').join(' | ')} |`);
    for (let r = 1; r < visibleRows.length; r += 1) {
      lines.push(`| ${visibleRows[r].join(' | ')} |`);
    }
    return ['', ...lines, ''];
  }

  private renderGrid(block: FeishuBlock): string[] {
    const lines: string[] = [];
    for (const colId of block.children ?? []) {
      const colBlock = this.blockMap.get(colId);
      if (!colBlock) {
        continue;
      }
      lines.push(...this.renderChildren(colBlock.children, 0));
    }
    return lines;
  }
}

export function blocksToMarkdown(blocks: FeishuBlock[]): string {
  const blockMap = new Map<string, FeishuBlock>();
  for (const block of blocks) {
    blockMap.set(block.block_id, block);
  }

  const rootBlock = blocks.find((block) => block.block_type === BlockType.PAGE);
  if (!rootBlock) {
    return '';
  }

  return new BlocksToMarkdown(blockMap).convert(rootBlock.block_id);
}

export type { FeishuBlock };
