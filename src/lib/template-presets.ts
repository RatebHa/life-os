import type { CreateHabitPayload, CreateTaskPayload, DomainId, EnergyLevel, Priority } from './types';

export type RoutinePreset = {
  id: string;
  title: string;
  description: string;
  domain_id: DomainId;
  kind: 'routine' | 'planning' | 'habit_bundle';
  tasks?: Array<{
    title: string;
    description?: string;
    priority: Priority;
    energy_level?: EnergyLevel;
    is_mit: boolean;
    time_estimate_minutes?: number;
    recurrence_rule?: string;
    tags?: string[];
  }>;
  habits?: CreateHabitPayload[];
};

export const ROUTINE_PRESETS: RoutinePreset[] = [
  {
    id: 'morning-reset',
    title: 'Morning Reset',
    description: 'Open the day, scan commitments, and lock in the most important work.',
    domain_id: 'self',
    kind: 'routine',
    tasks: [
      { title: 'Review inbox and clear quick triage', priority: 'medium', energy_level: 'light', is_mit: false, time_estimate_minutes: 10, tags: ['routine', 'morning-reset'] },
      { title: 'Run plan today and lock MIT', priority: 'high', energy_level: 'medium', is_mit: true, time_estimate_minutes: 15, tags: ['routine', 'morning-reset'] },
      { title: 'Prepare environment for first focus block', priority: 'medium', energy_level: 'light', is_mit: false, time_estimate_minutes: 10, tags: ['routine', 'morning-reset'] },
    ],
  },
  {
    id: 'shutdown',
    title: 'Shutdown',
    description: 'Close the day, capture loose ends, and prepare tomorrow.',
    domain_id: 'self',
    kind: 'routine',
    tasks: [
      { title: 'Review wins and unfinished work', priority: 'medium', energy_level: 'light', is_mit: false, time_estimate_minutes: 10, tags: ['routine', 'shutdown'] },
      { title: 'Prep tomorrow MIT and top 3', priority: 'high', energy_level: 'medium', is_mit: true, time_estimate_minutes: 15, tags: ['routine', 'shutdown'] },
      { title: 'Capture anything still in your head', priority: 'medium', energy_level: 'light', is_mit: false, time_estimate_minutes: 10, tags: ['routine', 'shutdown'] },
    ],
  },
  {
    id: 'deep-work-block',
    title: 'Deep Work Block',
    description: 'Create a protected block for high-value builder work.',
    domain_id: 'builder',
    kind: 'routine',
    tasks: [
      { title: 'Deep work block', description: 'Single focus target, notifications off, timer on.', priority: 'high', energy_level: 'deep', is_mit: true, time_estimate_minutes: 90, tags: ['routine', 'deep-work'] },
      { title: 'Define the exact outcome for this block', priority: 'medium', energy_level: 'medium', is_mit: false, time_estimate_minutes: 10, tags: ['routine', 'deep-work'] },
    ],
  },
  {
    id: 'weekly-planning',
    title: 'Weekly Planning Reset',
    description: 'Run the weekly planning ritual and turn it into commitments.',
    domain_id: 'builder',
    kind: 'planning',
    tasks: [
      { title: 'Run weekly planning review', priority: 'high', energy_level: 'medium', is_mit: false, time_estimate_minutes: 30, recurrence_rule: 'weekly', tags: ['planning', 'weekly'] },
      { title: 'Choose next week focus theme', priority: 'medium', energy_level: 'light', is_mit: false, time_estimate_minutes: 10, recurrence_rule: 'weekly', tags: ['planning', 'weekly'] },
      { title: 'Adjust one habit based on recent data', priority: 'medium', energy_level: 'light', is_mit: false, time_estimate_minutes: 15, recurrence_rule: 'weekly', tags: ['planning', 'weekly'] },
    ],
  },
  {
    id: 'self-starter-pack',
    title: 'Self Starter Pack',
    description: 'A light bundle for energy, reflection, and consistency.',
    domain_id: 'self',
    kind: 'habit_bundle',
    habits: [
      { domain_id: 'self', title: 'Drink water after waking', frequency: 'daily', target_days: JSON.stringify([0,1,2,3,4,5,6]), minimum_version: 'One full glass', recovery_grace_days: 1 },
      { domain_id: 'self', title: 'Walk for 10 minutes', frequency: 'daily', target_days: JSON.stringify([0,1,2,3,4,5,6]), minimum_version: 'Walk for 3 minutes', recovery_grace_days: 1 },
      { domain_id: 'self', title: 'Night reflection', frequency: 'weekdays', target_days: JSON.stringify([1,2,3,4,5]), minimum_version: 'Write one sentence', recovery_grace_days: 2 },
    ],
  },
  {
    id: 'builder-focus-pack',
    title: 'Builder Focus Pack',
    description: 'Starter habits for building consistently without overloading.',
    domain_id: 'builder',
    kind: 'habit_bundle',
    habits: [
      { domain_id: 'builder', title: 'Open the project and move one thing forward', frequency: 'weekdays', target_days: JSON.stringify([1,2,3,4,5]), minimum_version: 'Five focused minutes', recovery_grace_days: 1 },
      { domain_id: 'builder', title: 'Triage inbox once per workday', frequency: 'weekdays', target_days: JSON.stringify([1,2,3,4,5]), minimum_version: 'Process one item', recovery_grace_days: 1 },
    ],
  },
  {
    id: 'military-discipline-pack',
    title: 'Military Discipline Pack',
    description: 'Starter habits for order, readiness, and follow-through.',
    domain_id: 'military',
    kind: 'habit_bundle',
    habits: [
      { domain_id: 'military', title: 'Training block', frequency: 'weekdays', target_days: JSON.stringify([1,2,3,4,5]), minimum_version: '10 minute minimum', recovery_grace_days: 2 },
      { domain_id: 'military', title: 'Room reset / gear reset', frequency: 'daily', target_days: JSON.stringify([0,1,2,3,4,5,6]), minimum_version: 'Reset one surface', recovery_grace_days: 1 },
    ],
  },
];

export function buildTaskPayloadFromPreset(
  domainId: DomainId,
  task: NonNullable<RoutinePreset['tasks']>[number],
  dueDate?: string,
): CreateTaskPayload {
  return {
    domain_id: domainId,
    title: task.title,
    description: task.description,
    priority: task.priority,
    is_mit: task.is_mit,
    tags: JSON.stringify(['template-launch', ...(task.tags ?? [])]),
    time_estimate_minutes: task.time_estimate_minutes,
    due_date: dueDate,
    recurrence_rule: task.recurrence_rule,
    energy_level: task.energy_level,
  };
}
