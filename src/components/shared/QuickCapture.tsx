import React, { useState, useEffect, useRef } from 'react';
import { useInboxStore } from '../../store/useInboxStore';
import { useDomainStore } from '../../store/useDomainStore';
import type { DomainId } from '../../lib/types';
import { getDefaultDomainId, getDomainLabel, getDomainThemeStyle } from '../../lib/domain-utils';

interface QuickCaptureProps {
  open: boolean;
  onClose: () => void;
}

type Mode = 'task' | 'note';

export const QuickCapture: React.FC<QuickCaptureProps> = ({ open, onClose }) => {
  const { captureInboxItem } = useInboxStore();
  const domains = useDomainStore((state) => state.domains);
  const defaultDomain = getDefaultDomainId(domains);
  const hasDomains = domains.length > 0;

  const [mode, setMode] = useState<Mode>('task');
  const [text, setText] = useState('');
  const [domain, setDomain] = useState<DomainId>(defaultDomain);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setText('');
    setSaving(false);
    setDomain(defaultDomain);
    window.setTimeout(() => inputRef.current?.focus(), 50);
  }, [open, defaultDomain]);

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab' && !event.shiftKey) {
        event.preventDefault();
        setMode((value) => value === 'task' ? 'note' : 'task');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!hasDomains || !text.trim() || saving) return;
    setSaving(true);
    try {
      await captureInboxItem({
        content: text.trim(),
        domain_id: domain,
        source_label: 'quick_capture',
        suggested_kind: mode,
      });
      onClose();
    } catch (error) {
      console.error('[QuickCapture]', error);
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(6,14,6,0.80)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 300,
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: 'var(--color-surface)',
          border: '2px solid var(--color-accent)',
          padding: 'var(--space-4) var(--space-6)',
          width: 500,
          maxWidth: '90vw',
          boxShadow: '0 0 40px rgba(124,108,255,0.12)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
          <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
            {(['task', 'note'] as Mode[]).map((value) => (
              <button
                key={value}
                type="button"
                className={mode === value ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-ghost'}
                onClick={() => setMode(value)}
                style={{ padding: '2px var(--space-3)', fontSize: 'var(--text-2xs)', fontWeight: 'var(--font-weight-medium)' }}
              >
                {value.toUpperCase()}
              </button>
            ))}
          </div>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-2xs)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-muted)', letterSpacing: 1 }}>
            TAB TO SWITCH · ESC TO CANCEL
          </span>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {hasDomains ? (
            <>
              <input
                ref={inputRef}
                className="input"
                placeholder={mode === 'task' ? 'WHAT NEEDS TO BE DONE?' : 'NOTE TITLE...'}
                value={text}
                onChange={(event) => setText(event.target.value)}
                style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-weight-regular)', width: '100%' }}
              />

              <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                {domains.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    data-domain={entry.id}
                    className={domain === entry.id ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-ghost'}
                    onClick={() => setDomain(entry.id)}
                    style={{ ...getDomainThemeStyle(entry), flex: 1, minWidth: 120, padding: '3px var(--space-2)', fontSize: 'var(--text-2xs)', fontWeight: 'var(--font-weight-medium)' }}
                  >
                    {entry.icon} {getDomainLabel(entry.id, domains).toUpperCase()}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="empty-state" style={{ padding: 'var(--space-4) 0' }}>
              <div className="empty-state-title">NO DOMAINS YET</div>
              <div>CREATE AT LEAST ONE DOMAIN DURING SETUP BEFORE USING QUICK CAPTURE.</div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-ghost" onClick={onClose} style={{ fontSize: 'var(--text-2xs)', fontWeight: 'var(--font-weight-medium)' }}>
              CANCEL
            </button>
            <button type="submit" className="btn btn-primary" disabled={!hasDomains || !text.trim() || saving} style={{ fontSize: 'var(--text-2xs)', fontWeight: 'var(--font-weight-medium)' }}>
              {saving ? 'CAPTURING...' : 'SEND TO INBOX'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
