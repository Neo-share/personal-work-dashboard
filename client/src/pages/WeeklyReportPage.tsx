import { getReportWeekRange, WORK_DOMAIN_LABELS, type WorkDomain } from '@project-manager/shared';
import { Button, DatePicker, Select, Spin, message } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import WeeklyReportPreview from '../components/WeeklyReportPreview';
import { trpc } from '../lib/trpc';

const WORK_DOMAIN_OPTIONS = (Object.keys(WORK_DOMAIN_LABELS) as WorkDomain[]).map((value) => ({
  value,
  label: WORK_DOMAIN_LABELS[value],
}));

export default function WeeklyReportPage() {
  const [referenceDate, setReferenceDate] = useState<Dayjs>(dayjs());
  const [domain, setDomain] = useState<WorkDomain>('dev');
  const [content, setContent] = useState('');
  const [viewMode, setViewMode] = useState<'preview' | 'edit'>('preview');

  const weekRange = useMemo(() => {
    const range = getReportWeekRange(referenceDate.toDate());
    return { start: dayjs(range.start), end: dayjs(range.end) };
  }, [referenceDate]);

  const reportQuery = trpc.weeklyReport.generate.useQuery(
    {
      weekStart: weekRange.start.toISOString(),
      weekEnd: weekRange.end.toISOString(),
      domain,
    },
    { enabled: false },
  );

  useEffect(() => {
    if (reportQuery.data?.content) {
      setContent(reportQuery.data.content);
      setViewMode('preview');
    }
  }, [reportQuery.data?.content]);

  const handleGenerate = () => {
    void reportQuery.refetch();
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      message.success('周报已复制到剪贴板');
    } catch {
      message.error('复制失败，请手动选择文本复制');
    }
  };

  const handlePrevWeek = () => {
    setReferenceDate((value) => value.subtract(7, 'day'));
  };

  const handleNextWeek = () => {
    setReferenceDate((value) => value.add(7, 'day'));
  };

  const handleThisWeek = () => {
    setReferenceDate(dayjs());
  };

  const sectionStats = reportQuery.data?.sections;

  return (
    <div className="weekly-report-page">
      <header className="weekly-report-header content-card">
        <div>
          <h2 className="section-title">周报生成</h2>
          <p className="weekly-report-desc">
            根据需求状态变化自动归入已完成 / 测试中 / 开发中，需求条目附带飞书文档链接。
          </p>
        </div>
        <div className="weekly-report-toolbar">
          <div className="weekly-report-toolbar-row">
            <Button onClick={handlePrevWeek}>上一周</Button>
            <Button onClick={handleThisWeek}>本周</Button>
            <Button onClick={handleNextWeek}>下一周</Button>
            <DatePicker
              value={referenceDate}
              onChange={(value) => {
                if (value) {
                  setReferenceDate(value);
                }
              }}
              allowClear={false}
            />
          </div>
          <div className="weekly-report-toolbar-row">
            <span className="weekly-report-range">
              {weekRange.start.format('YYYY-MM-DD')}（周五）~ {weekRange.end.format('YYYY-MM-DD')}（周四）
            </span>
            <Select
              className="weekly-report-domain"
              value={domain}
              options={WORK_DOMAIN_OPTIONS}
              onChange={setDomain}
            />
            <Button type="primary" onClick={handleGenerate} loading={reportQuery.isFetching}>
              生成周报
            </Button>
            <Button onClick={handleCopy} disabled={!content}>
              复制
            </Button>
          </div>
        </div>
      </header>

      {reportQuery.isFetching && (
        <div className="weekly-report-loading">
          <Spin size="large" tip="正在汇总需求状态变化..." />
        </div>
      )}

      {sectionStats && !reportQuery.isFetching && (
        <div className="weekly-report-stats content-card">
          <span>已完成 {sectionStats.completed.length} 项</span>
          <span>测试中 {sectionStats.testing.length} 项</span>
          <span>开发中 {sectionStats.developing.length} 项</span>
        </div>
      )}

      <section className="content-card weekly-report-editor">
        <div className="weekly-report-view-switch">
          <Button
            type={viewMode === 'preview' ? 'primary' : 'default'}
            size="small"
            onClick={() => setViewMode('preview')}
          >
            预览
          </Button>
          <Button
            type={viewMode === 'edit' ? 'primary' : 'default'}
            size="small"
            onClick={() => setViewMode('edit')}
          >
            编辑
          </Button>
        </div>
        {viewMode === 'preview' ? (
          <WeeklyReportPreview content={content} />
        ) : (
          <textarea
            className="weekly-report-textarea"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="点击「生成周报」后，内容将显示在此处，可继续手工补充下周安排、生产 BUG 等。"
            rows={24}
          />
        )}
      </section>
    </div>
  );
}
