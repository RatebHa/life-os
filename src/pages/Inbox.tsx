import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInboxStore } from '../store/useInboxStore';
import { useDomainStore } from '../store/useDomainStore';
import type { DomainId, InboxItem, InboxSource, InboxTriageAction } from '../lib/types';
import { getDefaultDomainId, getDomainLabel, getDomainThemeStyle } from '../lib/domain-utils';

const SOURCE_LABELS: Record<InboxSource, string> = {
  quick_capture: 'QUICK CAPTURE',
  review: 'REVIEW',
  note: 'NOTE',
  manual: 'MANUAL',
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'JUST NOW';
  if (mins < 60) return `${mins}M AGO`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}H AGO`;
  return `${Math.floor(hrs / 24)}D AGO`;
}

function getKindLabel(item: InboxItem): string {
  if (item.suggested_kind === 'task') return 'TASK IDEA';
  if (item.suggested_kind === 'goal') return 'GOAL IDEA';
  if (item.suggested_kind === 'note') return 'NOTE IDEA';
  return 'CAPTURE';
}

export const InboxPage: React.FC = () => {
  const navigate = useNavigate();
  const { items, triageInboxItem, deleteInboxItem, pendingItems, somedayItems } = useInboxStore();
  const domains = useDomainStore((state) => state.domains);
  const [workingId, setWorkingId] = useState<string | null>(null);

  const pending = pendingItems();
  const someday = somedayItems();
  const defaultDomainId = getDefaultDomainId(domains);

  const suggestedRebalanceDomain = useMemo(() => {
    const counts = domains.reduce<Record<DomainId, number>>((acc, domain) => {
      acc[domain.id] = 0;
      return acc;
    }, {});
    pending.forEach((item) => {
      if (item.domain_id && item.domain_id in counts) counts[item.domain_id] += 1;
    });
    return (Object.entries(counts).sort((left, right) => left[1] - right[1])[0]?.[0] ?? defaultDomainId) as DomainId;
  }, [pending, domains, defaultDomainId]);

  async function handleTriage(item: InboxItem, action: InboxTriageAction, domainId?: DomainId | null) {
    setWorkingId(item.id);
    try {
      await triageInboxItem({ id: item.id, action, domain_id: domainId ?? item.domain_id ?? suggestedRebalanceDomain });
      if (action === 'note') navigate('/notes');
      if (action === 'task') navigate('/tasks');
      if (action === 'goal') navigate('/goals');
    } catch (error) {
      console.error(error);
    } finally {
      setWorkingId(null);
    }
  }

  async function handleDelete(itemId: string) {
    setWorkingId(itemId);
    try {
      await deleteInboxItem(itemId);
    } catch (error) {
      console.error(error);
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <div className="page-content fade-in">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div className="page-title">INBOX</div>
          <div className="page-subtitle">CAPTURE FAST. PROCESS LATER.</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="btn btn-ghost" style={{ pointerEvents: 'none' }}>
            {pending.length} PENDING
          </div>
          <div className="btn btn-ghost" style={{ pointerEvents: 'none' }}>
            {someday.length} SOMEDAY
          </div>
        </div>
      </div>

      <hr className="page-sep" />

      {pending.length === 0 ? (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="card-header">
            <span className="card-title">INBOX ZERO</span>
            <span className="card-meta">CLEAR</span>
          </div>
          <div className="card-body">
            <div className="empty-state" style={{ padding: '18px 0' }}>
              <div className="empty-state-title">NO LOOSE ENDS</div>
              <div>Quick capture now lands here, so an empty inbox means your ideas have been processed.</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="card-header">
            <span className="card-title">READY TO TRIAGE</span>
            <span className="card-meta">{pending.length} ITEMS</span>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {pending.map((item) => {
              const busy = workingId === item.id;
              const domainId = item.domain_id ?? suggestedRebalanceDomain;
              return (
                <div key={item.id} data-domain={domainId} style={{ ...getDomainThemeStyle(domainId, domains), border: '1px solid var(--color-border)', background: 'var(--color-surface-hover)', padding: '10px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: 'var(--font-sans)', fontSize: 15, color: 'var(--domain-primary)', letterSpacing: 1 }}>
                        {item.domain_id ? getDomainLabel(item.domain_id, domains).toUpperCase() : 'UNSORTED'}
                      </span>
                      <span style={{ fontSize: 10, color: 'var(--color-text-muted)', letterSpacing: 1 }}>
                        {SOURCE_LABELS[item.source_label]} · {getKindLabel(item)}
                      </span>
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--color-text-muted)', letterSpacing: 1 }}>
                      {relativeTime(item.created_at)}
                    </span>
                  </div>
                  <div style={{ fontSize: 15, color: 'var(--color-text)', marginBottom: 10, whiteSpace: 'pre-wrap' }}>
                    {item.content}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => handleTriage(item, 'task')}>TASK</button>
                    <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => handleTriage(item, 'goal')}>GOAL</button>
                    <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => handleTriage(item, 'note')}>NOTE</button>
                    <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => handleTriage(item, 'someday')}>SOMEDAY</button>
                    <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => handleDelete(item.id)}>DELETE</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <span className="card-title">SOMEDAY / MAYBE</span>
          <span className="card-meta">{someday.length} PARKED</span>
        </div>
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {someday.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
              No parked ideas right now.
            </div>
          ) : (
            someday.map((item) => (
              <div key={item.id} data-domain={item.domain_id ?? undefined} style={{ border: '1px solid var(--color-border)', padding: '8px 10px', background: 'var(--color-surface-hover)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ fontSize: 13, color: 'var(--color-accent)' }}>{item.content}</div>
                  <div style={{ fontSize: 10, color: 'var(--color-text-muted)', letterSpacing: 1 }}>{SOURCE_LABELS[item.source_label]}</div>
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                  <button className="btn btn-ghost btn-sm" disabled={workingId === item.id} onClick={() => handleTriage(item, 'task')}>MAKE TASK</button>
                  <button className="btn btn-ghost btn-sm" disabled={workingId === item.id} onClick={() => handleTriage(item, 'goal')}>MAKE GOAL</button>
                  <button className="btn btn-danger btn-sm" disabled={workingId === item.id} onClick={() => handleDelete(item.id)}>DELETE</button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
