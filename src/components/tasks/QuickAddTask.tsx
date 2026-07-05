import React, { useState } from 'react';
import { Modal } from '../shared/Modal';
import { useTaskStore } from '../../store/useTaskStore';
import { useDomainStore } from '../../store/useDomainStore';
import type { DomainId, Priority } from '../../lib/types';
import { getDefaultDomainId, getDomainLabel } from '../../lib/domain-utils';

interface QuickAddTaskProps {
  onClose: () => void;
  defaultDomain?: DomainId;
}

export const QuickAddTask: React.FC<QuickAddTaskProps> = ({ onClose, defaultDomain }) => {
  const { createTask } = useTaskStore();
  const { domains } = useDomainStore();
  const defaultDomainId = defaultDomain ?? getDefaultDomainId(domains);
  const [title, setTitle] = useState('');
  const [domainId, setDomainId] = useState<DomainId>(defaultDomainId);
  const [priority, setPriority] = useState<Priority>('medium');
  const [timeEst, setTimeEst] = useState('');
  const [isMIT, setIsMIT] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    setIsSubmitting(true);

    try {
      const timeMinutes = timeEst ? parseInt(timeEst, 10) : undefined;
      await createTask({
        domain_id: domainId,
        title: title.trim(),
        priority,
        is_mit: isMIT,
        is_top_three: isMIT,
        time_estimate_minutes: timeMinutes,
      });
      onClose();
    } catch (error) {
      console.error('Failed to create task:', error);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="New Task">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          className="input"
          placeholder="What needs to be done?"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          autoFocus
        />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] text-[var(--color-text-muted)] mb-1.5 tracking-wider uppercase">Domain</label>
            <select className="input" value={domainId} onChange={(event) => setDomainId(event.target.value as DomainId)}>
              {domains.map((domain) => (
                <option key={domain.id} value={domain.id}>
                  {domain.icon} {getDomainLabel(domain.id, domains)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] text-[var(--color-text-muted)] mb-1.5 tracking-wider uppercase">Priority</label>
            <select className="input" value={priority} onChange={(event) => setPriority(event.target.value as Priority)}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] text-[var(--color-text-muted)] mb-1.5 tracking-wider uppercase">Time (minutes)</label>
            <input className="input" type="number" placeholder="e.g. 30" value={timeEst} onChange={(event) => setTimeEst(event.target.value)} min="1" />
          </div>

          <div>
            <label className="block text-[11px] text-[var(--color-text-muted)] mb-1.5 tracking-wider uppercase">Most Important</label>
            <button type="button" className={`btn w-full ${isMIT ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setIsMIT((value) => !value)}>
              {isMIT ? '★ MIT' : '☆ Set as MIT'}
            </button>
          </div>
        </div>

        <div className="px-3 py-2 bg-[var(--bg-base)] border border-[var(--border-base)] text-[12px] text-[var(--text-muted)]">
          Quick add creates a clean commitment entry. You can add planning, recurrence, and richer details later from the full task editor.
        </div>

        <div className="flex gap-2 justify-end">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={!title.trim() || isSubmitting}>
            {isSubmitting ? 'Adding...' : 'Add Task'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
