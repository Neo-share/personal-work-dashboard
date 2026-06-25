import type { PersonalAssistantRefresh } from '@project-manager/shared';
import dayjs from 'dayjs';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import PersonalAssistantPanel from '../components/personal-workbench/PersonalAssistantPanel';
import RecurringTaskPanel from '../components/personal-workbench/RecurringTaskPanel';
import ScheduleTimeline from '../components/personal-workbench/ScheduleTimeline';
import TodoPanel from '../components/personal-workbench/TodoPanel';
import { trpc } from '../lib/trpc';
import '../styles/personal-workbench.css';

type TabKey = 'workspace' | 'recurring';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return '早上好';
  if (hour < 18) return '下午好';
  return '晚上好';
}

export default function PersonalWorkbenchPage() {
  const [tab, setTab] = useState<TabKey>('workspace');
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [modifyTodoId, setModifyTodoId] = useState<number | null>(null);
  const [modifyVersion, setModifyVersion] = useState<number | undefined>();
  const [highlightTodoIds, setHighlightTodoIds] = useState<number[]>([]);
  const highlightTimerRef = useRef<number | null>(null);

  const utils = trpc.useUtils();
  const summaryQuery = trpc.personalWorkbench.summary.useQuery({
    date: selectedDate.toISOString(),
  });

  function handleRefresh(targets?: PersonalAssistantRefresh[]) {
    if (!targets || targets.includes('all')) {
      void utils.personalWorkbench.summary.invalidate();
      void utils.todos.list.invalidate();
      void utils.todos.aiResults.invalidate();
      void utils.schedule.listDay.invalidate();
      void utils.recurringTasks.list.invalidate();
      return;
    }
    if (targets.includes('summary')) void utils.personalWorkbench.summary.invalidate();
    if (targets.includes('todos')) {
      void utils.todos.list.invalidate();
      void utils.todos.aiResults.invalidate();
    }
    if (targets.includes('schedule')) void utils.schedule.listDay.invalidate();
    if (targets.includes('recurringTasks')) void utils.recurringTasks.list.invalidate();
  }

  function handleMaterialized(payload: { todoIds: number[]; taskTitle: string }) {
    setTab('workspace');
    if (highlightTimerRef.current !== null) {
      window.clearTimeout(highlightTimerRef.current);
    }
    if (payload.todoIds.length > 0) {
      setHighlightTodoIds(payload.todoIds);
      highlightTimerRef.current = window.setTimeout(() => {
        setHighlightTodoIds([]);
        highlightTimerRef.current = null;
      }, 2500);
    } else {
      setHighlightTodoIds([]);
    }
  }

  useEffect(() => {
    return () => {
      if (highlightTimerRef.current !== null) {
        window.clearTimeout(highlightTimerRef.current);
      }
    };
  }, []);

  const summary = summaryQuery.data;

  return (
    <div className="personal-workbench">
      <div className="pw-content-row">
        <div className="pw-main">
          <div className="pw-page-tabs">
            <button
              type="button"
              className={`pw-page-tab${tab === 'workspace' ? ' is-active' : ''}`}
              onClick={() => setTab('workspace')}
            >
              日程与事项
            </button>
            <button
              type="button"
              className={`pw-page-tab${tab === 'recurring' ? ' is-active' : ''}`}
              onClick={() => setTab('recurring')}
            >
              定时任务
            </button>
            <Link to="/dev-dashboard" className="pw-page-tab">
              开发域
            </Link>
          </div>

          <div className={`pw-tab-panel${tab === 'workspace' ? ' is-active' : ''}`}>
            <div className="pw-tab-inner">
              <div className="pw-greeting-bar">
                <span>
                  {getGreeting()}，<em>个人工作台</em> 已就绪
                </span>
                <div className="pw-greeting-stats">
                  <span className="pw-stat-pill">
                    日程 <strong>{summary?.scheduleCount ?? '—'}</strong> 条
                  </span>
                  <span className="pw-stat-pill">
                    待办 <strong>{summary?.todoCount ?? '—'}</strong> 项
                  </span>
                  <span
                    className={`pw-stat-pill${(summary?.overdueCount ?? 0) > 0 ? ' is-warn' : ''}`}
                  >
                    逾期 <strong>{summary?.overdueCount ?? '—'}</strong> 项
                  </span>
                  <span className="pw-stat-pill">
                    已完成 <strong>{summary?.completedCount ?? '—'}</strong> 项
                  </span>
                </div>
              </div>

              <div className="pw-dual-panel">
                <TodoPanel
                  highlightTodoIds={highlightTodoIds}
                  onRefresh={() => handleRefresh(['todos', 'summary'])}
                  onEnterModify={(todoId, version) => {
                    setModifyTodoId(todoId);
                    setModifyVersion(version);
                  }}
                />
                <ScheduleTimeline
                  selectedDate={selectedDate}
                  onDateChange={(date) => {
                    setSelectedDate(date);
                    void utils.personalWorkbench.summary.invalidate();
                  }}
                  onRefresh={() => handleRefresh(['schedule', 'summary'])}
                />
              </div>
            </div>
          </div>

          <div className={`pw-tab-panel${tab === 'recurring' ? ' is-active' : ''}`}>
            <RecurringTaskPanel
              onRefresh={() => handleRefresh(['todos', 'summary'])}
              onMaterialized={handleMaterialized}
            />
          </div>
        </div>

        <PersonalAssistantPanel
          onRefresh={handleRefresh}
          modifyTodoId={modifyTodoId}
          modifyVersion={modifyVersion}
          onExitModify={() => {
            setModifyTodoId(null);
            setModifyVersion(undefined);
          }}
          onModifyMode={(todoId, version) => {
            setModifyTodoId(todoId);
            setModifyVersion(version);
          }}
          onEnterModify={(todoId, version) => {
            setModifyTodoId(todoId);
            setModifyVersion(version);
          }}
        />
      </div>
    </div>
  );
}
