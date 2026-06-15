import { useMemo } from 'react';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 将周报 Markdown 链接渲染为可点击的 HTML 预览 */
export default function WeeklyReportPreview({ content }: { content: string }) {
  const html = useMemo(() => {
    const escaped = escapeHtml(content);
    const withLinks = escaped.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer" class="content-link">$1</a>',
    );
    return withLinks.replace(/\n/g, '<br />');
  }, [content]);

  if (!content.trim()) {
    return <div className="empty-hint">暂无预览内容</div>;
  }

  return (
    <div
      className="weekly-report-preview"
      // 仅渲染服务端生成的 Markdown 链接，无用户 HTML 输入
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
