import React, { useMemo, useState } from 'react';
import { ROUTINE_PRESETS, buildTaskPayloadFromPreset } from '../lib/template-presets';
import type { CreateHabitPayload, DomainId, EnergyLevel, Priority } from '../lib/types';
import { useTemplateStore } from '../store/useTemplateStore';
import { useTaskStore } from '../store/useTaskStore';
import { useHabitStore } from '../store/useHabitStore';
import { useDomainStore } from '../store/useDomainStore';
import { getDefaultDomainId, getDomainLabel } from '../lib/domain-utils';
import { FormField, TextInput, Textarea, Select } from '../components/shared/form';

type DomainFilter = DomainId | 'all';

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function shiftDate(base: string, days: number): string {
  const next = new Date(`${base}T00:00:00`);
  next.setDate(next.getDate() + days);
  return isoDate(next);
}

function getPresetTitle(presetId: string, domainId: DomainId, domains: ReturnType<typeof useDomainStore.getState>['domains']): string {
  const domainLabel = getDomainLabel(domainId, domains);
  if (presetId === 'self-starter-pack') return `${domainLabel} STARTER PACK`;
  if (presetId === 'builder-focus-pack') return `${domainLabel} FOCUS PACK`;
  if (presetId === 'military-discipline-pack') return `${domainLabel} CONSISTENCY PACK`;
  return '';
}

function getPresetDescription(presetId: string, domainId: DomainId, domains: ReturnType<typeof useDomainStore.getState>['domains']): string {
  const domainLabel = getDomainLabel(domainId, domains);
  if (presetId === 'deep-work-block') return `Create a protected block for high-value ${domainLabel.toLowerCase()} work.`;
  if (presetId === 'self-starter-pack') return `A light bundle to help ${domainLabel.toLowerCase()} stay consistent.`;
  if (presetId === 'builder-focus-pack') return `Starter habits to help ${domainLabel.toLowerCase()} move forward without overload.`;
  if (presetId === 'military-discipline-pack') return `Starter habits to keep ${domainLabel.toLowerCase()} orderly and repeatable.`;
  return '';
}

export const TemplatesPage: React.FC = () => {
  const { taskTemplates, createTaskTemplate, deleteTaskTemplate } = useTemplateStore();
  const { createTask } = useTaskStore();
  const { createHabit, habits } = useHabitStore();
  const domains = useDomainStore((state) => state.domains);

  const [domainFilter, setDomainFilter] = useState<DomainFilter>('all');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [domainId, setDomainId] = useState<DomainId>(getDefaultDomainId(domains));
  const [priority, setPriority] = useState<Priority>('medium');
  const [energyLevel, setEnergyLevel] = useState<EnergyLevel>('medium');
  const [timeEstimate, setTimeEstimate] = useState('45');
  const [recurrence, setRecurrence] = useState('none');
  const [isMit, setIsMit] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [launchingId, setLaunchingId] = useState<string | null>(null);
  const hasDomains = domains.length > 0;
  const targetDomainId = domainFilter === 'all' ? domainId : domainFilter;

  const today = isoDate(new Date());
  const tomorrow = shiftDate(today, 1);
  const nextWeek = shiftDate(today, 7);

  const filteredTemplates = useMemo(
    () => taskTemplates.filter((template) => domainFilter === 'all' || template.domain_id === domainFilter),
    [domainFilter, taskTemplates],
  );
  const filteredPresets = useMemo(
    () => ROUTINE_PRESETS,
    [],
  );

  async function launchTaskTemplate(templateId: string, dueDate: string) {
    const template = taskTemplates.find((item) => item.id === templateId);
    if (!template) return;
    setLaunchingId(templateId);
    try {
      await createTask({
        domain_id: template.domain_id,
        title: template.title,
        description: template.description ?? undefined,
        priority: template.priority,
        energy_level: template.energy_level,
        is_mit: template.is_mit,
        tags: template.tags,
        time_estimate_minutes: template.time_estimate_minutes ?? undefined,
        due_date: dueDate,
        recurrence_rule: template.recurrence_rule ?? undefined,
      });
    } catch (error) {
      console.error(error);
    } finally {
      setLaunchingId(null);
    }
  }

  async function launchPreset(presetId: string) {
    const preset = ROUTINE_PRESETS.find((item) => item.id === presetId);
    if (!preset || !hasDomains) return;
    setLaunchingId(presetId);
    try {
      if (preset.tasks) {
        const dueDate = preset.kind === 'planning' ? nextWeek : today;
        for (const task of preset.tasks) {
          const base = buildTaskPayloadFromPreset(targetDomainId, task, dueDate);
          await createTask(base);
        }
      }

      if (preset.habits) {
        for (const habit of preset.habits as CreateHabitPayload[]) {
          const alreadyExists = habits.some((existing) => existing.title.trim().toLowerCase() === habit.title.trim().toLowerCase());
          if (alreadyExists) continue;
          await createHabit({ ...habit, domain_id: targetDomainId });
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLaunchingId(null);
    }
  }

  async function handleCreateTemplate(event: React.FormEvent) {
    event.preventDefault();
    if (!hasDomains || !title.trim()) return;
    setSavingTemplate(true);
    try {
      await createTaskTemplate({
        title: title.trim(),
        description: description.trim() || undefined,
        domain_id: domainId,
        priority,
        energy_level: energyLevel,
        is_mit: isMit,
        tags: JSON.stringify(['task-template']),
        time_estimate_minutes: timeEstimate ? parseInt(timeEstimate, 10) : undefined,
        recurrence_rule: recurrence !== 'none' ? recurrence : undefined,
      });
      setTitle('');
      setDescription('');
      setPriority('medium');
      setEnergyLevel('medium');
      setIsMit(false);
      setTimeEstimate('45');
      setRecurrence('none');
    } catch (error) {
      console.error(error);
    } finally {
      setSavingTemplate(false);
    }
  }

  return (
    <div className="page-content fade-in">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
        <div>
          <div className="page-title">ROUTINES & TEMPLATES</div>
          <div className="page-subtitle">ONE-CLICK SYSTEMS FOR REPEATED BEHAVIOR</div>
        </div>
        <Select style={{ width: 180 }} value={domainFilter} onChange={(event) => setDomainFilter(event.target.value as DomainFilter)}>
          <option value="all">ALL DOMAINS</option>
          {domains.map((domain) => (
            <option key={domain.id} value={domain.id}>{getDomainLabel(domain.id, domains).toUpperCase()}</option>
          ))}
        </Select>
      </div>

      <hr className="page-sep" />

      {!hasDomains && (
        <div className="card" style={{ marginBottom: 'var(--space-3)' }}>
          <div className="card-body">
            <div className="empty-state" style={{ padding: 'var(--space-4) 0' }}>
              <div className="empty-state-title">NO DOMAINS YET</div>
              <div>CREATE A DOMAIN DURING SETUP OR IN SETTINGS BEFORE LAUNCHING ROUTINES OR SAVING TEMPLATES.</div>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
        <div className="card">
          <div className="card-header">
            <span className="card-title">SAVED TASK TEMPLATES</span>
            <span className="card-meta">{filteredTemplates.length} STORED</span>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {filteredTemplates.length === 0 ? (
              <div className="empty-state" style={{ padding: 'var(--space-4) 0' }}>
                <div className="empty-state-title">NO SAVED TEMPLATES</div>
                <div>Save a task as a template or create one from scratch here.</div>
              </div>
            ) : (
              filteredTemplates.map((template) => (
                <div key={template.id} data-domain={template.domain_id} style={{ border: '1px solid var(--color-border)', padding: 'var(--space-2) var(--space-3)', background: 'var(--color-surface-hover)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
                    <div>
                      <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-weight-regular)', color: 'var(--color-text)' }}>{template.title}</div>
                      <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-weight-regular)', color: 'var(--color-text-muted)', marginTop: 3 }}>
                        {getDomainLabel(template.domain_id, domains)} · {template.priority.toUpperCase()} · {template.energy_level.toUpperCase()} · {template.time_estimate_minutes ?? 0}M
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <button className="btn btn-ghost btn-sm" disabled={launchingId === template.id} onClick={() => launchTaskTemplate(template.id, today)}>TODAY</button>
                      <button className="btn btn-ghost btn-sm" disabled={launchingId === template.id} onClick={() => launchTaskTemplate(template.id, tomorrow)}>TOMORROW</button>
                      <button className="btn btn-danger btn-sm" disabled={launchingId === template.id} onClick={() => deleteTaskTemplate(template.id).catch(console.error)}>DELETE</button>
                    </div>
                  </div>
                  {template.description && <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-weight-regular)', color: 'var(--color-accent)', marginTop: 'var(--space-2)' }}>{template.description}</div>}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">NEW TASK TEMPLATE</span>
          </div>
          <div className="card-body">
            <form onSubmit={handleCreateTemplate} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <FormField label="Title">
                <TextInput placeholder="Template title" value={title} onChange={(event) => setTitle(event.target.value)} disabled={!hasDomains} />
              </FormField>
              <FormField label="Description">
                <Textarea placeholder="Description" rows={3} value={description} onChange={(event) => setDescription(event.target.value)} style={{ resize: 'none' }} disabled={!hasDomains} />
              </FormField>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
                <FormField label="Domain">
                  <Select value={domainId} onChange={(event) => setDomainId(event.target.value as DomainId)} disabled={!hasDomains}>
                    {domains.map((domain) => (
                      <option key={domain.id} value={domain.id}>{getDomainLabel(domain.id, domains).toUpperCase()}</option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Priority">
                  <Select value={priority} onChange={(event) => setPriority(event.target.value as Priority)}>
                    <option value="low">LOW</option>
                    <option value="medium">MEDIUM</option>
                    <option value="high">HIGH</option>
                    <option value="critical">CRITICAL</option>
                  </Select>
                </FormField>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
                <FormField label="Time Estimate">
                  <TextInput type="number" min={0} value={timeEstimate} onChange={(event) => setTimeEstimate(event.target.value)} placeholder="Time estimate" disabled={!hasDomains} />
                </FormField>
                <FormField label="Recurrence">
                  <Select value={recurrence} onChange={(event) => setRecurrence(event.target.value)} disabled={!hasDomains}>
                    <option value="none">NO REPEAT</option>
                    <option value="daily">DAILY</option>
                    <option value="weekly">WEEKLY</option>
                    <option value="monthly">MONTHLY</option>
                  </Select>
                </FormField>
              </div>
              <FormField label="Energy">
                <Select value={energyLevel} onChange={(event) => setEnergyLevel(event.target.value as EnergyLevel)} disabled={!hasDomains}>
                  <option value="deep">DEEP ENERGY</option>
                  <option value="medium">MEDIUM ENERGY</option>
                  <option value="light">LIGHT ENERGY</option>
                </Select>
              </FormField>
              <button type="button" className={`btn ${isMit ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setIsMit((value) => !value)} disabled={!hasDomains}>
                {isMit ? 'MIT TEMPLATE' : 'MARK AS MIT TEMPLATE'}
              </button>
              <button type="submit" className="btn btn-primary" disabled={!hasDomains || !title.trim() || savingTemplate}>
                {savingTemplate ? 'SAVING...' : 'SAVE TEMPLATE'}
              </button>
            </form>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
        <div className="card">
          <div className="card-header">
            <span className="card-title">ROUTINES & PLANNING PRESETS</span>
            <span className="card-meta">{filteredPresets.filter((preset) => preset.kind !== 'habit_bundle').length} READY</span>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {filteredPresets.filter((preset) => preset.kind !== 'habit_bundle').map((preset) => (
              <div key={preset.id} data-domain={hasDomains ? targetDomainId : undefined} style={{ border: '1px solid var(--color-border)', padding: 'var(--space-2) var(--space-3)', background: 'var(--color-surface-hover)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
                  <div>
                    <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-weight-regular)', color: 'var(--color-text)' }}>{hasDomains ? (getPresetTitle(preset.id, targetDomainId, domains) || preset.title) : preset.title}</div>
                    <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-weight-regular)', color: 'var(--color-text-muted)', marginTop: 3 }}>{hasDomains ? (getPresetDescription(preset.id, targetDomainId, domains) || preset.description) : preset.description}</div>
                  </div>
                  <button className="btn btn-ghost btn-sm" disabled={!hasDomains || launchingId === preset.id} onClick={() => launchPreset(preset.id)}>
                    {launchingId === preset.id ? 'LAUNCHING...' : 'LAUNCH'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">HABIT STARTER PACKS</span>
            <span className="card-meta">{filteredPresets.filter((preset) => preset.kind === 'habit_bundle').length} READY</span>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {filteredPresets.filter((preset) => preset.kind === 'habit_bundle').map((preset) => (
              <div key={preset.id} data-domain={hasDomains ? targetDomainId : undefined} style={{ border: '1px solid var(--color-border)', padding: 'var(--space-2) var(--space-3)', background: 'var(--color-surface-hover)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
                  <div>
                    <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-weight-regular)', color: 'var(--color-text)' }}>{hasDomains ? (getPresetTitle(preset.id, targetDomainId, domains) || preset.title) : preset.title}</div>
                    <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-weight-regular)', color: 'var(--color-text-muted)', marginTop: 3 }}>{hasDomains ? (getPresetDescription(preset.id, targetDomainId, domains) || preset.description) : preset.description}</div>
                  </div>
                  <button className="btn btn-ghost btn-sm" disabled={!hasDomains || launchingId === preset.id} onClick={() => launchPreset(preset.id)}>
                    {launchingId === preset.id ? 'INSTALLING...' : 'ADD PACK'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
