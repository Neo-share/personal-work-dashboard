import { Button } from 'antd';
import type { Requirement } from '@project-manager/shared';
import { Link } from 'react-router-dom';
import { getPriorityLabel, getRequirementStatusLabel, getWorkDomainLabel } from '../utils/labels';

interface RequirementListProps {
  items: Requirement[];
  emptyText?: string;
  compact?: boolean;
  limit?: number;
  moreTo?: string;
  moreLabel?: string;
}

export default function RequirementList({
  items,
  emptyText = '暂无工作项',
  compact = false,
  limit,
  moreTo,
  moreLabel = '查看全部',
}: RequirementListProps) {
  if (items.length === 0) {
    return <div className="empty-hint">{emptyText}</div>;
  }

  const visibleItems = limit !== undefined ? items.slice(0, limit) : items;
  const hasMore = limit !== undefined && items.length > limit;

  if (compact) {
    return (
      <div className="requirement-list-compact">
        {visibleItems.map((item) => (
          <Link className="list-row-compact" key={item.id} to={`/requirements/${item.id}`}>
            <span className="list-row-compact-title">{item.name}</span>
            <span className="list-row-compact-meta">
              {item.domain !== 'dev' ? (
                <span className="list-row-compact-domain">{getWorkDomainLabel(item.domain)}</span>
              ) : null}
              <span className={`status-pill ${item.priority}`}>
                {getPriorityLabel(item.priority)}
              </span>
              <span className="list-row-compact-status">
                {getRequirementStatusLabel(item.status)}
              </span>
            </span>
          </Link>
        ))}
        {hasMore && moreTo ? (
          <Link className="list-more-link" to={moreTo}>
            {moreLabel}（共 {items.length} 条）
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      {items.map((item) => (
        <div className="list-row" key={item.id}>
          <div className="list-row-main">
            <Link className="content-link" to={`/requirements/${item.id}`}>
              <strong>{item.name}</strong>
            </Link>
            <div className="list-row-meta">
              {item.domain !== 'dev' ? `${getWorkDomainLabel(item.domain)} · ` : ''}
              {getRequirementStatusLabel(item.status)}
              {item.targetVersion ? ` · ${item.targetVersion}` : ''}
            </div>
          </div>
          <div className="tag-list">
            <span className={`status-pill ${item.priority}`}>
              {getPriorityLabel(item.priority)}
            </span>
            <Link to={`/requirements/${item.id}`}>
              <Button size="small">查看详情</Button>
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}
