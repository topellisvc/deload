-- Reusable program templates: "save as template" / coach tooling.
--
-- Lets anyone (most useful for a coach reusing the same starting point
-- across clients, but not restricted to coaches — a self-programmer
-- reusing their own design is a legitimate use too) turn one of their own
-- programs into a personal, reusable template — distinct from the 3
-- hardcoded starter templates (lib/programs/starter-templates.ts, which
-- aren't stored in the database at all).
--
-- template_data stores the entire ProgramTree.weeks array as-is (jsonb) —
-- the exact same WeekRow[] shape addWeek's sourceWeek clone path already
-- consumes (see lib/programs/starter-templates.ts's placeholder-id
-- precedent: those ids are structural only, never read as real foreign
-- keys). Materializing a template is functionally identical to
-- cloneProgram's per-week addWeek loop, just reading from this stored
-- snapshot instead of a live sibling program — no new relational tables
-- (mirroring program_weeks/training_days/etc. under a "template"
-- namespace) needed for what's fundamentally the same shape.
--
-- Run this once in the Supabase SQL Editor. Safe to re-run.

create table if not exists public.program_templates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  discipline text not null check (discipline in ('resistance', 'running', 'hybrid')),
  template_data jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists program_templates_owner_idx on public.program_templates (owner_id, created_at desc);

alter table public.program_templates enable row level security;

drop policy if exists "program templates are readable by their owner" on public.program_templates;
drop policy if exists "program templates are insertable by their owner" on public.program_templates;
drop policy if exists "program templates are deletable by their owner" on public.program_templates;

create policy "program templates are readable by their owner"
  on public.program_templates for select
  using (auth.uid() = owner_id);

create policy "program templates are insertable by their owner"
  on public.program_templates for insert
  with check (auth.uid() = owner_id);

create policy "program templates are deletable by their owner"
  on public.program_templates for delete
  using (auth.uid() = owner_id);
