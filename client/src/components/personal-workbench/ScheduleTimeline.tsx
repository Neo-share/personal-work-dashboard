import { CALENDAR_SOURCE_LABELS, type CalendarSourceType } from '@project-manager/shared';
import { Button, DatePicker, Form, Input, Modal, Switch, message } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useMemo, useState } from 'react';
import { trpc } from '../../lib/trpc';
import MiniCalendar from './MiniCalendar';

const HOUR_HEIGHT = 48;
const TOTAL_HOURS = 24;

interface ScheduleTimelineProps {
  selectedDate: Dayjs;
  onDateChange: (date: Dayjs) => void;
  onRefresh?: () => void;
}

export default function ScheduleTimeline({
  selectedDate,
  onDateChange,
  onRefresh,
}: ScheduleTimelineProps) {
  const [detailId, setDetailId] = useState<number | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [form] = Form.useForm();
  const utils = trpc.useUtils();

  const scheduleQuery = trpc.schedule.listDay.useQuery({
    date: selectedDate.toISOString(),
  });
  const sourcesQuery = trpc.schedule.sources.useQuery();

  const toggleSource = trpc.schedule.setSourceEnabled.useMutation({
    onSuccess: () => {
      void utils.schedule.listDay.invalidate();
      void utils.schedule.sources.invalidate();
    },
  });

  const createScheduleMutation = trpc.schedule.createLocal.useMutation({
    onSuccess: () => {
      void utils.schedule.listDay.invalidate();
      void utils.personalWorkbench.summary.invalidate();
      setAddOpen(false);
      form.resetFields();
      onRefresh?.();
      message.success('日程已添加');
    },
    onError: (err) => message.error(err.message || '添加失败'),
  });

  const detailQuery = trpc.schedule.detail.useQuery(
    { id: detailId! },
    { enabled: detailId !== null },
  );

  const now = dayjs();
  const nowTop =
    selectedDate.isSame(now, 'day') ? (now.hour() + now.minute() / 60) * HOUR_HEIGHT : -1;

  const events = scheduleQuery.data?.events ?? [];

  const blockStyle = (startAt: string, endAt: string) => {
    const start = dayjs(startAt);
    const end = dayjs(endAt);
    const top = (start.hour() + start.minute() / 60) * HOUR_HEIGHT;
    const height = Math.max(((end.diff(start, 'minute') / 60) * HOUR_HEIGHT), 24);
    return { top, height };
  };

  const hours = useMemo(() => Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => i), []);

  function openAddModal() {
    const base = selectedDate.hour(dayjs().hour() + 1).minute(0).second(0);
    form.setFieldsValue({
      title: '',
      startAt: base,
      endAt: base.add(1, 'hour'),
    });
    setAddOpen(true);
  }

  return (
    <div className="pw-panel pw-panel-schedule">
      <div className="pw-panel-head">
        <span className="pw-panel-title">我的日程</span>
        <Button size="small" type="primary" onClick={openAddModal}>
          + 添加日程
        </Button>
      </div>
      <div className="pw-panel-body">
        <div className="pw-source-switches">
          {(sourcesQuery.data ?? []).map((source) => (
            <label key={source.source} style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Switch
                size="small"
                checked={source.enabled}
                onChange={(enabled) =>
                  toggleSource.mutate({ source: source.source, enabled })
                }
              />
              {CALENDAR_SOURCE_LABELS[source.source]}
            </label>
          ))}
        </div>

        {scheduleQuery.data ? (
          <div className="pw-schedule-sync">
            原始 {scheduleQuery.data.rawCount} 条，去重后 {scheduleQuery.data.dedupedCount} 条
          </div>
        ) : null}

        <div className="pw-schedule-layout">
          <MiniCalendar selectedDate={selectedDate} onDateChange={onDateChange} />

          <div className="pw-timeline">
            <div className="pw-timeline-scale">
              {hours.map((h) => (
                <div
                  key={h}
                  className="pw-timeline-hour"
                  style={{ top: h * HOUR_HEIGHT }}
                >
                  {String(h).padStart(2, '0')}:00
                </div>
              ))}
            </div>
            <div
              className="pw-timeline-canvas"
              style={{ height: TOTAL_HOURS * HOUR_HEIGHT }}
            >
              {nowTop >= 0 ? (
                <div className="pw-now-line" style={{ top: nowTop }} />
              ) : null}
              {events.map((event) => {
                const { top, height } = blockStyle(event.startAt, event.endAt);
                return (
                  <div
                    key={event.id}
                    className={`pw-schedule-block${event.isMerged ? ' is-merged' : ''}`}
                    style={{ top, height }}
                    onClick={() => setDetailId(event.id)}
                  >
                    <div>{event.title}</div>
                    <div style={{ fontSize: 10, color: '#64748b' }}>
                      {dayjs(event.startAt).format('HH:mm')} – {dayjs(event.endAt).format('HH:mm')}
                    </div>
                    <div className="pw-schedule-block-sources">
                      {event.sources.map((s) => (
                        <span key={s.id} className="pw-source-tag">
                          {CALENDAR_SOURCE_LABELS[s.source as CalendarSourceType]}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <Modal
        title="添加日程"
        open={addOpen}
        onCancel={() => setAddOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={createScheduleMutation.isPending}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(values: { title: string; startAt: Dayjs; endAt: Dayjs }) => {
            createScheduleMutation.mutate({
              title: values.title,
              startAt: values.startAt.toISOString(),
              endAt: values.endAt.toISOString(),
            });
          }}
        >
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
            <Input placeholder="如：项目评审会" />
          </Form.Item>
          <Form.Item name="startAt" label="开始时间" rules={[{ required: true }]}>
            <DatePicker showTime format="YYYY/MM/DD HH:mm" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="endAt" label="结束时间" rules={[{ required: true }]}>
            <DatePicker showTime format="YYYY/MM/DD HH:mm" style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={detailQuery.data?.title ?? '日程详情'}
        open={detailId !== null}
        onCancel={() => setDetailId(null)}
        footer={null}
      >
        {detailQuery.data?.sources.map((s) => (
          <div key={s.id} style={{ marginBottom: 8, fontSize: 12 }}>
            <strong>{CALENDAR_SOURCE_LABELS[s.source]}</strong>：{s.title}
            <br />
            {dayjs(s.startAt).format('YYYY/MM/DD HH:mm')} – {dayjs(s.endAt).format('HH:mm')}
          </div>
        ))}
      </Modal>
    </div>
  );
}
