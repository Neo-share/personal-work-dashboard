import { Button, Spin } from 'antd';
import { Link } from 'react-router-dom';
import RequirementList from '../components/RequirementList';
import { trpc } from '../lib/trpc';

interface MetricCardProps {
  label: string;
  value: number;
  to?: string;
  tone?: 'default' | 'risk' | 'warning';
}

function MetricCard({ label, value, to, tone = 'default' }: MetricCardProps) {
  const hasItems = value > 0;
  const className = [
    'stat-card',
    'workbench-metric',
    tone !== 'default' ? `tone-${tone}` : '',
    hasItems && tone !== 'default' ? 'has-items' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const content = (
    <>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </>
  );

  if (to) {
    return (
      <Link className={`workbench-metric-link ${className}`} to={to}>
        {content}
      </Link>
    );
  }

  return <div className={className}>{content}</div>;
}

function SectionHead({
  title,
  count,
  countTone,
}: {
  title: string;
  count: number;
  countTone?: 'default' | 'danger';
}) {
  return (
    <div className="workbench-section-head">
      <h3 className="section-title">{title}</h3>
      <span className={`workbench-count${countTone === 'danger' ? ' danger' : ''}`}>{count}</span>
    </div>
  );
}

export default function MyWorkbenchPage() {
  const summaryQuery = trpc.workbench.summary.useQuery();

  if (summaryQuery.isLoading) {
    return (
      <div className="workbench-loading">
        <Spin size="large" />
      </div>
    );
  }

  const summary = summaryQuery.data;
  if (!summary) {
    return <div className="empty-hint">看板数据加载失败</div>;
  }

  const hasRisk = summary.riskRequirements.length > 0;

  return (
    <div className="workbench-page">
      <header className="workbench-header">
        <div className="workbench-intro">
          <h2 className="page-title">概览</h2>
          <p className="page-desc">
            一眼看清进行中的工作项、本地仓库改动、阻塞项与计划时间。
          </p>
        </div>
        <div className="workbench-actions">
          <Link to="/requirements">
            <Button type="primary">全部工作项</Button>
          </Link>
          <Link to="/scan">
            <Button>扫描工作区</Button>
          </Link>
        </div>
      </header>

      <div className="workbench-metrics">
        <MetricCard label="进行中" value={summary.pendingPush.length} />
        <MetricCard
          label="脏仓库"
          value={summary.dirtyRepositories}
          to="/scan"
          tone="warning"
        />
        <MetricCard
          label="有阻塞"
          value={summary.riskRequirements.length}
          to="/requirements?riskOnly=1"
          tone="risk"
        />
        <MetricCard label="全部工作项" value={summary.totalRequirements} to="/requirements" />
      </div>

      <div className="workbench-body">
        <section className="content-card workbench-primary">
          <SectionHead title="进行中" count={summary.pendingPush.length} />
          <RequirementList
            items={summary.pendingPush}
            emptyText="当前没有开发中、联调、提测或待上线的工作项"
          />
        </section>

        <aside className="workbench-aside">
          <section className="content-card workbench-meta">
            <div className="workbench-meta-row">
              <span className="workbench-meta-label">工作区仓库</span>
              <span className="workbench-meta-value">{summary.totalRepositories}</span>
            </div>
            {summary.dirtyRepositories > 0 ? (
              <p className="workbench-meta-hint">
                有 {summary.dirtyRepositories} 个仓库存在未提交变更，
                <Link className="content-link" to="/scan">
                  去扫描同步
                </Link>
                。
              </p>
            ) : (
              <p className="workbench-meta-hint">本地仓库工作区干净。</p>
            )}
          </section>

          {hasRisk ? (
            <section className="content-card workbench-aside-risk">
              <SectionHead
                title="阻塞与风险"
                count={summary.riskRequirements.length}
                countTone="danger"
              />
              <RequirementList
                items={summary.riskRequirements}
                compact
                limit={3}
                moreTo="/requirements?riskOnly=1"
                moreLabel="查看全部阻塞项"
              />
            </section>
          ) : null}

          <section className="content-card">
            <SectionHead title="待评审" count={summary.pendingConfirm.length} />
            <RequirementList
              items={summary.pendingConfirm}
              compact
              emptyText="暂无待评审工作项"
            />
          </section>

          <section className="content-card">
            <SectionHead title="计划上线" count={summary.upcomingRelease.length} />
            <RequirementList
              items={summary.upcomingRelease}
              compact
              emptyText="暂无填写计划上线时间的工作项"
            />
          </section>
        </aside>
      </div>
    </div>
  );
}
