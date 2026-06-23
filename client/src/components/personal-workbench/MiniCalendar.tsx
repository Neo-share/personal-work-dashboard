import { Button } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';

interface MiniCalendarProps {
  selectedDate: Dayjs;
  onDateChange: (date: Dayjs) => void;
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

export default function MiniCalendar({ selectedDate, onDateChange }: MiniCalendarProps) {
  const today = dayjs();
  const monthStart = selectedDate.startOf('month');
  const daysInMonth = selectedDate.daysInMonth();
  const startWeekday = monthStart.day();

  const cells: Array<{ day: number | null; date?: Dayjs }> = [];
  for (let i = 0; i < startWeekday; i++) cells.push({ day: null });
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, date: selectedDate.date(d) });
  }

  return (
    <div className="pw-mini-calendar">
      <div className="pw-mini-cal-head">
        <Button
          type="text"
          size="small"
          onClick={() => onDateChange(selectedDate.subtract(1, 'month'))}
        >
          ‹
        </Button>
        <span>{selectedDate.format('YYYY年M月')}</span>
        <Button
          type="text"
          size="small"
          onClick={() => onDateChange(selectedDate.add(1, 'month'))}
        >
          ›
        </Button>
      </div>
      <div className="pw-mini-cal-grid">
        {WEEKDAYS.map((w) => (
          <div key={w} style={{ fontWeight: 600, color: '#94a3b8' }}>
            {w}
          </div>
        ))}
        {cells.map((cell, idx) =>
          cell.day === null ? (
            <div key={`empty-${idx}`} />
          ) : (
            <div
              key={cell.day}
              className={[
                'pw-mini-cal-day',
                cell.date?.isSame(today, 'day') ? 'is-today' : '',
                cell.date?.isSame(selectedDate, 'day') ? 'is-selected' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => cell.date && onDateChange(cell.date)}
            >
              {cell.day}
            </div>
          ),
        )}
      </div>
    </div>
  );
}
