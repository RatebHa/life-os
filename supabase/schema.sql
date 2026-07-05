create extension if not exists pgcrypto;

create table if not exists public.domains (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  name text not null,
  icon text not null,
  color text not null,
  created_at text not null,
  updated_at text not null,
  deleted_at text,
  xp_total bigint not null default 0,
  level bigint not null default 1,
  streak_current bigint not null default 0,
  streak_longest bigint not null default 0,
  streak_freeze_tokens bigint not null default 0,
  last_activity_date text,
  primary key (user_id, id)
);

create table if not exists public.tasks (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  domain_id text not null,
  title text not null,
  description text,
  priority text not null default 'medium',
  status text not null default 'todo',
  is_mit boolean not null default false,
  is_top_three boolean not null default false,
  xp_value bigint not null default 30,
  xp_awarded boolean not null default false,
  parent_task_id text,
  goal_id text,
  tags text not null default '[]',
  time_estimate_minutes bigint,
  due_date text,
  planned_for_date text,
  task_kind text not null default 'standard',
  scheduled_for text,
  recurring_template_id text,
  recurrence_type text,
  recurrence_interval bigint,
  recurrence_days text not null default '[]',
  recurrence_anchor_date text,
  completed_at text,
  created_at text not null,
  updated_at text not null,
  deleted_at text,
  attachments text not null default '[]',
  recurrence_rule text,
  time_actual_minutes bigint,
  energy_level text not null default 'medium',
  primary key (user_id, id)
);

create table if not exists public.habits (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  domain_id text not null,
  title text not null,
  description text,
  frequency text not null default 'daily',
  target_days text not null default '[0,1,2,3,4,5,6]',
  xp_per_completion bigint not null default 0,
  cadence_type text not null default 'daily',
  cadence_days text not null default '[0,1,2,3,4,5,6]',
  cadence_interval_days bigint not null default 1,
  cadence_weekly_target bigint not null default 1,
  cadence_anchor_date text,
  target_type text not null default 'checkbox',
  target_value bigint not null default 1,
  minimum_value bigint,
  unit_label text,
  minimum_version text,
  recovery_grace_days bigint not null default 1,
  restart_from_date text,
  streak_current bigint not null default 0,
  streak_longest bigint not null default 0,
  is_active boolean not null default true,
  created_at text not null,
  updated_at text not null,
  deleted_at text,
  primary key (user_id, id)
);

create table if not exists public.habit_logs (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  habit_id text not null,
  completed_date text not null,
  xp_awarded bigint not null default 0,
  value_completed bigint not null default 1,
  status text not null default 'completed',
  skip_reason text,
  created_at text not null,
  updated_at text not null,
  deleted_at text,
  primary key (user_id, id),
  unique (user_id, habit_id, completed_date)
);

create table if not exists public.goals (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  domain_id text not null,
  title text not null,
  description text,
  parent_goal_id text,
  status text not null default 'active',
  next_action text,
  review_date text,
  blocked_by text,
  health text not null default 'on_track',
  target_date text,
  progress_percent bigint not null default 0,
  created_at text not null,
  updated_at text not null,
  deleted_at text,
  primary key (user_id, id)
);

create table if not exists public.notes (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  domain_id text,
  goal_id text,
  title text not null,
  content text not null default '',
  tags text not null default '[]',
  pinned boolean not null default false,
  created_at text not null,
  updated_at text not null,
  deleted_at text,
  primary key (user_id, id)
);

create table if not exists public.inbox_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  content text not null,
  domain_id text,
  source_label text not null default 'manual',
  suggested_kind text not null default 'generic',
  status text not null default 'pending',
  created_at text not null,
  triaged_at text,
  updated_at text not null,
  deleted_at text,
  primary key (user_id, id)
);

create index if not exists idx_domains_user_updated on public.domains(user_id, updated_at desc);
create index if not exists idx_tasks_user_updated on public.tasks(user_id, updated_at desc);
create index if not exists idx_habits_user_updated on public.habits(user_id, updated_at desc);
create index if not exists idx_habit_logs_user_updated on public.habit_logs(user_id, updated_at desc);
create index if not exists idx_goals_user_updated on public.goals(user_id, updated_at desc);
create index if not exists idx_notes_user_updated on public.notes(user_id, updated_at desc);
create index if not exists idx_inbox_user_updated on public.inbox_items(user_id, updated_at desc);

alter table public.domains enable row level security;
alter table public.tasks enable row level security;
alter table public.habits enable row level security;
alter table public.habit_logs enable row level security;
alter table public.goals enable row level security;
alter table public.notes enable row level security;
alter table public.inbox_items enable row level security;

drop policy if exists "lifeos own domains" on public.domains;
create policy "lifeos own domains" on public.domains
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "lifeos own tasks" on public.tasks;
create policy "lifeos own tasks" on public.tasks
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "lifeos own habits" on public.habits;
create policy "lifeos own habits" on public.habits
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "lifeos own habit logs" on public.habit_logs;
create policy "lifeos own habit logs" on public.habit_logs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "lifeos own goals" on public.goals;
create policy "lifeos own goals" on public.goals
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "lifeos own notes" on public.notes;
create policy "lifeos own notes" on public.notes
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "lifeos own inbox" on public.inbox_items;
create policy "lifeos own inbox" on public.inbox_items
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
