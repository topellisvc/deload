-- Reusable exercise and day templates — "save an exercise's prescription
-- (Bench Press, 5x5 @ 80%, Rest 2min, note) so it can be inserted with one
-- click next time" and "save a whole training day (Upper Strength, Lower
-- Hypertrophy...) for reuse across programs." Same shape and same
-- reasoning as program_templates (migration 0020): a jsonb snapshot of the
-- exact row shape the builder already works with, not a parallel set of
-- relational tables. Both scoped per-owner, matching program_templates and
-- exercise_library (0031).
--
-- exercise_templates.template_data is one BlockExerciseRow-shaped object
-- (exercise_id, custom_name, notes, exercise_category, sets) minus its own
-- id/block_id/position and each set row's id/block_exercise_id/position —
-- addExerciseBlockFromTemplate (mutations.ts) assigns all of those fresh on
-- insert, exactly like duplicateExercise already does for a live exercise.
--
-- day_templates.template_data is one DayRow-shaped object (label,
-- is_rest_day, blocks) minus the day's own id/week_id/position and every
-- nested id/parent-id/position below it — insertDayTemplate (mutations.ts)
-- assigns all of those fresh, the same clone-with-fresh-ids shape addWeek's
-- sourceWeek path and copyDayContents already use.
--
-- Run this once in the Supabase SQL Editor, after 0032. Safe to re-run.

create table if not exists public.exercise_templates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  exercise_category text not null check (exercise_category in ('strength', 'running', 'cardio')),
  template_data jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists exercise_templates_owner_idx on public.exercise_templates (owner_id, created_at desc);

alter table public.exercise_templates enable row level security;

drop policy if exists "exercise templates are readable by their owner" on public.exercise_templates;
drop policy if exists "exercise templates are insertable by their owner" on public.exercise_templates;
drop policy if exists "exercise templates are deletable by their owner" on public.exercise_templates;

create policy "exercise templates are readable by their owner"
  on public.exercise_templates for select
  using (auth.uid() = owner_id);

create policy "exercise templates are insertable by their owner"
  on public.exercise_templates for insert
  with check (auth.uid() = owner_id);

create policy "exercise templates are deletable by their owner"
  on public.exercise_templates for delete
  using (auth.uid() = owner_id);

create table if not exists public.day_templates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  template_data jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists day_templates_owner_idx on public.day_templates (owner_id, created_at desc);

alter table public.day_templates enable row level security;

drop policy if exists "day templates are readable by their owner" on public.day_templates;
drop policy if exists "day templates are insertable by their owner" on public.day_templates;
drop policy if exists "day templates are deletable by their owner" on public.day_templates;

create policy "day templates are readable by their owner"
  on public.day_templates for select
  using (auth.uid() = owner_id);

create policy "day templates are insertable by their owner"
  on public.day_templates for insert
  with check (auth.uid() = owner_id);

create policy "day templates are deletable by their owner"
  on public.day_templates for delete
  using (auth.uid() = owner_id);
