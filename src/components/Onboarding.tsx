import React, { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useTaskStore } from '../store/useTaskStore';
import { useHabitStore } from '../store/useHabitStore';
import { useDomainStore } from '../store/useDomainStore';
import { db } from '../lib/db';
import type { DomainId } from '../lib/types';
import { getDefaultDomainId, getDomainLabel, getDomainThemeStyle } from '../lib/domain-utils';

const STEPS = ['DOMAINS', 'SYSTEM', 'FIRST HABIT', 'FIRST TASK', 'COMPLETE'];

function getDomainSummary(domainLabel: string): string {
  return `${domainLabel.toUpperCase()} / TASKS / HABITS / PROGRESS`;
}

export const Onboarding: React.FC = () => {
  const { appState } = useAppStore();
  const { createTask } = useTaskStore();
  const { createHabit } = useHabitStore();
  const { domains, createDomain, deleteDomain } = useDomainStore();
  const orderedDomains = useMemo(() => domains, [domains]);
  const defaultDomainId = getDefaultDomainId(orderedDomains);
  const hasDomains = orderedDomains.length > 0;

  const [step, setStep] = useState(0);
  const [habitTitle, setHabitTitle] = useState('');
  const [habitDomain, setHabitDomain] = useState<DomainId>(defaultDomainId);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDomain, setTaskDomain] = useState<DomainId>(defaultDomainId);
  const [domainName, setDomainName] = useState('');
  const [domainIcon, setDomainIcon] = useState('[D]');
  const [domainColor, setDomainColor] = useState('#4afa4a');
  const [creatingDomain, setCreatingDomain] = useState(false);
  const [deletingDomainId, setDeletingDomainId] = useState<string | null>(null);
  const [domainError, setDomainError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    if (!hasDomains) return;
    if (!orderedDomains.some((domain) => domain.id === habitDomain)) {
      setHabitDomain(defaultDomainId);
    }
    if (!orderedDomains.some((domain) => domain.id === taskDomain)) {
      setTaskDomain(defaultDomainId);
    }
  }, [defaultDomainId, habitDomain, hasDomains, orderedDomains, taskDomain]);

  if (!appState) return null;
  if (appState.onboarding_complete && hasDomains) return null;

  async function handleAddDomain() {
    if (creatingDomain) return;
    setCreatingDomain(true);
    setDomainError(null);
    try {
      const created = await createDomain({
        name: domainName.trim() || `Domain ${orderedDomains.length + 1}`,
        icon: domainIcon.trim() || '[D]',
        color: domainColor.trim() || '#4afa4a',
      });
      setDomainName('');
      setDomainIcon('[D]');
      setDomainColor('#4afa4a');
      if (!hasDomains) {
        setHabitDomain(created.id);
        setTaskDomain(created.id);
      }
    } catch (error) {
      setDomainError(error instanceof Error ? error.message : String(error));
    } finally {
      setCreatingDomain(false);
    }
  }

  async function handleDeleteDomain(id: string) {
    if (deletingDomainId) return;
    setDeletingDomainId(id);
    setDomainError(null);
    try {
      await deleteDomain(id);
    } catch (error) {
      setDomainError(error instanceof Error ? error.message : String(error));
    } finally {
      setDeletingDomainId(null);
    }
  }

  async function handleFinish() {
    if (!hasDomains) {
      setDomainError('Create at least one domain before entering the system.');
      return;
    }

    setFinishing(true);
    try {
      if (habitTitle.trim()) {
        await createHabit({
          domain_id: habitDomain,
          title: habitTitle.trim(),
          frequency: 'daily',
          target_days: '[0,1,2,3,4,5,6]',
        });
      }
      if (taskTitle.trim()) {
        await createTask({
          domain_id: taskDomain,
          title: taskTitle.trim(),
          priority: 'medium',
          is_mit: true,
        });
      }
      await db.completeOnboarding();
      await useAppStore.getState().loadAppState();
    } catch (error) {
      setDomainError(error instanceof Error ? error.message : String(error));
    } finally {
      setFinishing(false);
    }
  }

  const nextDisabled = step === 0 && !hasDomains;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 600,
        background: 'var(--color-bg)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div style={{ display: 'flex', gap: 8, marginBottom: 32 }}>
        {STEPS.map((label, index) => (
          <div
            key={label}
            style={{
              width: index === step ? 24 : 8,
              height: 8,
              background: index <= step ? 'var(--color-accent)' : 'var(--color-surface-hover)',
              border: '1px solid var(--color-border)',
              transition: 'width 150ms linear',
            }}
          />
        ))}
      </div>

      <div
        style={{
          width: 620,
          maxWidth: '94vw',
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          boxShadow: '0 0 24px rgba(74,250,74,0.15)',
          padding: '32px 36px',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}
      >
        {step === 0 && (
          <>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 40, color: 'var(--color-text)', letterSpacing: 5 }}>
              DEFINE YOUR DOMAINS
            </div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-text-muted)', lineHeight: 1.8, letterSpacing: 1 }}>
              START WITH THE AREAS OF LIFE YOU ACTUALLY WANT TO TRACK. YOU CAN CREATE ONE DOMAIN OR MANY, AND EVERYTHING ELSE IN LIFE OS WILL USE THEM.
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 12 }}>
              <div className="card" style={{ margin: 0 }}>
                <div className="card-header">
                  <span className="card-title">YOUR DOMAINS</span>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, color: 'var(--color-text-muted)' }}>{orderedDomains.length}</span>
                </div>
                <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 220 }}>
                  {!hasDomains ? (
                    <div className="empty-state" style={{ padding: '18px 0' }}>
                      <div className="empty-state-title">NO DOMAINS YET</div>
                      <div>ADD YOUR FIRST AREA TO START BUILDING THE SYSTEM AROUND YOUR LIFE.</div>
                    </div>
                  ) : (
                    orderedDomains.map((domain) => (
                      <div
                        key={domain.id}
                        data-domain={domain.id}
                        style={{
                          ...getDomainThemeStyle(domain),
                          padding: '10px 12px',
                          border: '1px solid var(--domain-primary)',
                          background: 'var(--domain-subtle)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 10,
                        }}
                      >
                        <div>
                          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 20, color: 'var(--domain-primary)', letterSpacing: 3 }}>
                            {domain.icon} {getDomainLabel(domain.id, orderedDomains).toUpperCase()}
                          </div>
                          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 9, color: 'var(--color-text-muted)', letterSpacing: 1 }}>
                            {getDomainSummary(getDomainLabel(domain.id, orderedDomains))}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => void handleDeleteDomain(domain.id)}
                          disabled={deletingDomainId === domain.id}
                        >
                          {deletingDomainId === domain.id ? '...' : 'DELETE'}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="card" style={{ margin: 0 }}>
                <div className="card-header">
                  <span className="card-title">ADD DOMAIN</span>
                </div>
                <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <input className="input" placeholder="DOMAIN NAME" value={domainName} onChange={(event) => setDomainName(event.target.value)} />
                  <input className="input" placeholder="ICON OR TAG" value={domainIcon} maxLength={8} onChange={(event) => setDomainIcon(event.target.value)} />
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input className="input" value={domainColor} onChange={(event) => setDomainColor(event.target.value)} placeholder="#4afa4a" style={{ flex: 1 }} />
                    <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(domainColor) ? domainColor : '#4afa4a'} onChange={(event) => setDomainColor(event.target.value)} style={{ width: 42, height: 42, border: '1px solid var(--color-border)', background: 'var(--color-surface-hover)' }} />
                  </div>
                  <button className="btn btn-primary" type="button" onClick={() => void handleAddDomain()} disabled={creatingDomain}>
                    {creatingDomain ? 'ADDING...' : 'ADD DOMAIN'}
                  </button>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: 9, color: 'var(--color-text-muted)', letterSpacing: 1, lineHeight: 1.6 }}>
                    EXAMPLES: WORK, HEALTH, STUDY, FAMILY, BUSINESS, FITNESS, LANGUAGE, ADMIN.
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 22, color: 'var(--color-text)', letterSpacing: 3 }}>
              HOW THE SYSTEM WORKS
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { icon: '[]', title: 'TASKS', desc: 'Track real work, set priority, link tasks to goals, and keep the board honest.' },
                { icon: '::', title: 'HABITS', desc: 'Keep repeated behaviors honest with schedules, minimum versions, streaks, and recovery.' },
                { icon: '<>', title: 'GOALS', desc: 'Turn longer-term outcomes into next actions, review dates, and linked execution.' },
                { icon: '!!', title: 'PLANNING', desc: 'Use MIT, Top 3, and realistic daily load to make the next move obvious.' },
              ].map((item) => (
                <div
                  key={item.title}
                  style={{
                    display: 'flex',
                    gap: 14,
                    padding: '10px 14px',
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-surface-hover)',
                  }}
                >
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: 20, color: 'var(--color-accent)', minWidth: 24 }}>{item.icon}</span>
                  <div>
                    <div style={{ fontFamily: 'var(--font-sans)', fontSize: 16, color: 'var(--color-text)', letterSpacing: 2 }}>{item.title}</div>
                    <div style={{ fontFamily: 'var(--font-sans)', fontSize: 10, color: 'var(--color-text-muted)', letterSpacing: 1, marginTop: 2 }}>{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 22, color: 'var(--color-text)', letterSpacing: 3 }}>
              CREATE YOUR FIRST HABIT
            </div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 10, color: 'var(--color-text-muted)', letterSpacing: 1 }}>
              START SMALL. PICK ONE REPEATED BEHAVIOR YOU WANT THIS SYSTEM TO HELP YOU MAINTAIN.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontFamily: 'var(--font-sans)', fontSize: 9, color: 'var(--color-text-muted)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>Habit Name</label>
                <input className="input" placeholder="E.G. REVIEW PRIORITIES, WALK, TRAIN, STUDY..." value={habitTitle} onChange={(event) => setHabitTitle(event.target.value)} autoFocus />
              </div>
              <div>
                <label style={{ display: 'block', fontFamily: 'var(--font-sans)', fontSize: 9, color: 'var(--color-text-muted)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>Area</label>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, orderedDomains.length)}, minmax(0, 1fr))`, gap: 6 }}>
                  {orderedDomains.map((domain) => (
                    <button
                      key={domain.id}
                      type="button"
                      data-domain={domain.id}
                      onClick={() => setHabitDomain(domain.id)}
                      className={habitDomain === domain.id ? 'btn btn-primary' : 'btn btn-ghost'}
                      style={{ ...getDomainThemeStyle(domain), fontSize: 11 }}
                    >
                      {getDomainLabel(domain.id, orderedDomains).toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 22, color: 'var(--color-text)', letterSpacing: 3 }}>
              SET YOUR FIRST MIT
            </div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 10, color: 'var(--color-text-muted)', letterSpacing: 1 }}>
              YOUR MOST IMPORTANT TASK IS THE ONE THING THAT MAKES TODAY FEEL REAL IF IT GETS DONE.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontFamily: 'var(--font-sans)', fontSize: 9, color: 'var(--color-text-muted)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>Task Title</label>
                <input className="input" placeholder="WHAT MUST MOVE FORWARD?" value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} autoFocus />
              </div>
              <div>
                <label style={{ display: 'block', fontFamily: 'var(--font-sans)', fontSize: 9, color: 'var(--color-text-muted)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>Area</label>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, orderedDomains.length)}, minmax(0, 1fr))`, gap: 6 }}>
                  {orderedDomains.map((domain) => (
                    <button
                      key={domain.id}
                      type="button"
                      data-domain={domain.id}
                      onClick={() => setTaskDomain(domain.id)}
                      className={taskDomain === domain.id ? 'btn btn-primary' : 'btn btn-ghost'}
                      style={{ ...getDomainThemeStyle(domain), fontSize: 11 }}
                    >
                      {getDomainLabel(domain.id, orderedDomains).toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 36, color: 'var(--color-text)', letterSpacing: 4 }}>
              SYSTEM READY
            </div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-text-muted)', lineHeight: 1.8, letterSpacing: 1 }}>
              YOUR SYSTEM IS LIVE. START IN TODAY, GET ONE HONEST WIN, AND LET THE WORKSPACE LEARN FROM REAL USE OVER TIME.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                'TODAY - RUN PLAN TODAY AND FINISH YOUR MIT',
                'OVERVIEW - CHECK BALANCE AND DRIFT WHEN YOU NEED A WIDER VIEW',
                'THIS WEEK - STABILIZE ONE HABIT INSIDE ONE DOMAIN',
                'LATER - OPEN SETTINGS TO PROTECT BACKUPS AND TUNE THE DISPLAY',
              ].map((tip, index) => (
                <div
                  key={tip}
                  style={{
                    padding: '8px 12px',
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-surface-hover)',
                    fontFamily: 'var(--font-sans)',
                    fontSize: 10,
                    color: 'var(--color-text-muted)',
                    letterSpacing: 1,
                    display: 'flex',
                    gap: 10,
                  }}
                >
                  <span style={{ color: 'var(--color-warning)' }}>{String(index + 1).padStart(2, '0')}.</span>
                  {tip}
                </div>
              ))}
            </div>
          </>
        )}

        {domainError && (
          <div style={{ padding: '8px 10px', border: '1px solid var(--color-danger)', color: 'var(--color-danger)', fontFamily: 'var(--font-sans)', fontSize: 10, letterSpacing: 1 }}>
            {domainError.toUpperCase()}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid var(--color-border)' }}>
          <button
            className="btn btn-ghost"
            onClick={() => setStep((value) => value - 1)}
            style={{ visibility: step === 0 ? 'hidden' : 'visible' }}
          >
            &lt; BACK
          </button>
          {step < STEPS.length - 1 ? (
            <button className="btn btn-primary" onClick={() => setStep((value) => value + 1)} disabled={nextDisabled}>
              {step === 0 && !hasDomains ? 'ADD A DOMAIN FIRST' : 'NEXT >'}
            </button>
          ) : (
            <button className="btn btn-primary" onClick={() => void handleFinish()} disabled={finishing || !hasDomains}>
              {finishing ? 'INITIALIZING...' : 'ENTER SYSTEM'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
