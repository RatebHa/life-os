import React, { useEffect } from 'react';
import { useCalendarStore } from '../store/useCalendarStore';
import { useTaskStore } from '../store/useTaskStore';
import { formatDateDisplay } from '../lib/date-format';

const MONTH_NAMES = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
const DAY_NAMES = ['MON','TUE','WED','THU','FRI','SAT','SUN'];

function getDayOfWeek(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00');
  const dow = d.getDay(); // 0=Sun
  return dow === 0 ? 6 : dow - 1; // 0=Mon
}

function priorityColor(p: string) {
  if (p === 'critical') return 'var(--color-danger)';
  if (p === 'high') return 'var(--color-warning)';
  return 'var(--color-accent)';
}

export const CalendarPage: React.FC = () => {
  const { year, month, days, selectedDate, isLoading, loadMonth, nextMonth, prevMonth, selectDate, dayData } = useCalendarStore();
  const { tasks: allTasks } = useTaskStore();

  useEffect(() => { loadMonth(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const today = new Date().toISOString().slice(0, 10);
  const firstDay = `${year}-${String(month).padStart(2,'0')}-01`;
  const firstDow = getDayOfWeek(firstDay); // 0=Mon

  const selectedDay = selectedDate ? dayData(selectedDate) : null;
  const selectedTasks = selectedDay
    ? allTasks.filter((t) => selectedDay.tasks.some((st) => st.id === t.id))
    : [];

  // suppress unused variable warning — selectedTasks used for potential future expansion
  void selectedTasks;

  return (
    <div className="page-content fade-in">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div className="page-title">CALENDAR</div>
          <div className="page-subtitle">// SCHEDULE LOG — {year}</div>
        </div>
      </div>
      <hr className="page-sep" />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16 }}>
        {/* Calendar Grid */}
        <div>
          {/* Month nav */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
            <button className="btn btn-ghost btn-sm" onClick={prevMonth}>{'<'}</button>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 20, letterSpacing: 3, color: 'var(--color-text)', minWidth: 140, textAlign: 'center' }}>
              {MONTH_NAMES[month - 1]} {year}
            </div>
            <button className="btn btn-ghost btn-sm" onClick={nextMonth}>{'>'}</button>
          </div>

          {/* Day names row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
            {DAY_NAMES.map((d) => (
              <div key={d} style={{ textAlign: 'center', fontFamily: 'var(--font-sans)', fontSize: 9, color: 'var(--color-text-muted)', letterSpacing: 1, padding: '3px 0' }}>
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          {isLoading ? (
            <div className="empty-state"><div className="empty-state-title">LOADING...</div></div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
              {/* Empty cells before first day */}
              {Array.from({ length: firstDow }).map((_, i) => (
                <div key={`empty-${i}`} style={{ border: '1px solid var(--color-surface-hover)', minHeight: 64 }} />
              ))}
              {/* Day cells */}
              {days.map((day) => {
                const isToday = day.date === today;
                const isSelected = day.date === selectedDate;
                const hasTasks = day.tasks.length > 0;
                const hasHabits = day.habits_logged.length > 0;

                return (
                  <div
                    key={day.date}
                    onClick={() => selectDate(isSelected ? null : day.date)}
                    style={{
                      border: isSelected ? '1px solid var(--color-text)' : isToday ? '1px solid var(--color-accent)' : '1px solid var(--color-surface-hover)',
                      background: isSelected ? 'rgba(74,250,74,0.08)' : isToday ? 'var(--color-surface-hover)' : 'transparent',
                      padding: 4,
                      minHeight: 64,
                      cursor: 'crosshair',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2,
                      position: 'relative',
                    }}
                  >
                    {/* Day number */}
                    <div style={{ fontFamily: 'var(--font-sans)', fontSize: 16, color: isToday ? 'var(--color-text)' : 'var(--color-accent)', lineHeight: 1 }}>
                      {parseInt(day.date.slice(8))}
                    </div>

                    {/* Task dots */}
                    {hasTasks && (
                      <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                        {day.tasks.slice(0, 3).map((t) => (
                          <div key={t.id} style={{ width: 6, height: 6, background: priorityColor(t.priority) }} title={t.title} />
                        ))}
                        {day.tasks.length > 3 && (
                          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 9, color: 'var(--color-text-muted)' }}>+{day.tasks.length - 3}</span>
                        )}
                      </div>
                    )}

                    {/* Habit indicator */}
                    {hasHabits && (
                      <div style={{ fontFamily: 'var(--font-sans)', fontSize: 9, color: 'var(--color-text-muted)', letterSpacing: 0.5 }}>
                        {day.habits_logged.length}H
                      </div>
                    )}

                    {/* Activity count */}
                    {(day.tasks.length + day.habits_logged.length) > 0 && (
                      <div style={{
                        position: 'absolute', bottom: 3, right: 3,
                        fontFamily: 'var(--font-sans)', fontSize: 9, color: 'var(--color-text-muted)',
                      }}>
                        {day.tasks.length + day.habits_logged.length}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Day Detail */}
        <div>
          {selectedDay ? (
            <div className="card">
              <div className="card-header">
                <span className="card-title">{formatDateDisplay(selectedDate)}</span>
                <span className="card-meta">{selectedDay.tasks.length + selectedDay.habits_logged.length} SIGNALS</span>
              </div>
              <div className="card-body">
                {/* Tasks */}
                {selectedDay.tasks.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontFamily: 'var(--font-sans)', fontSize: 9, color: 'var(--color-text-muted)', letterSpacing: 2, marginBottom: 6, textTransform: 'uppercase' }}>
                      TASKS ({selectedDay.tasks.length})
                    </div>
                    {selectedDay.tasks.map((st) => (
                      <div key={st.id} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '5px 0', borderBottom: '1px solid var(--color-surface-hover)',
                      }}>
                        <div style={{ width: 6, height: 6, background: priorityColor(st.priority), flexShrink: 0 }} />
                        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: st.status === 'done' ? 'var(--color-text-muted)' : 'var(--color-accent)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: st.status === 'done' ? 'line-through' : 'none' }}>
                          {st.title}
                        </span>
                        <span className={`priority-badge-${st.priority}`}>{st.priority.toUpperCase().slice(0,4)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Habits */}
                {selectedDay.habits_logged.length > 0 && (
                  <div>
                    <div style={{ fontFamily: 'var(--font-sans)', fontSize: 9, color: 'var(--color-text-muted)', letterSpacing: 2, marginBottom: 6, textTransform: 'uppercase' }}>
                      HABITS ({selectedDay.habits_logged.length})
                    </div>
                    {selectedDay.habits_logged.map((h) => (
                      <div key={h.habit_id} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '5px 0', borderBottom: '1px solid var(--color-surface-hover)',
                      }}>
                        <div style={{ width: 6, height: 6, background: 'var(--color-accent)', flexShrink: 0 }} />
                        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-accent)' }}>{h.title}</span>
                      </div>
                    ))}
                  </div>
                )}

                {selectedDay.tasks.length === 0 && selectedDay.habits_logged.length === 0 && (
                  <div className="empty-state" style={{ padding: '20px 0' }}>
                    <div className="empty-state-title" style={{ fontSize: 14 }}>NO ACTIVITY</div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="card" style={{ height: '100%' }}>
              <div className="card-header">
                <span className="card-title">DAY DETAIL</span>
              </div>
              <div className="empty-state" style={{ padding: 30 }}>
                <div className="empty-state-title" style={{ fontSize: 14 }}>SELECT A DATE</div>
                <span className="boot-cursor" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
