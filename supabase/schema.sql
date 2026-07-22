-- Deload database schema.
--
-- Run this once in the Supabase SQL Editor (Project -> SQL Editor -> New
-- query -> paste this whole file -> Run) after creating the project.
--
-- Covers two features:
--   1. Calculator progress tracking (saved_results) -- lets signed-in users
--      see trends over time on 1RM, Body Fat %, ACWR, and Running Pace.
--   2. The training program builder (programs / program_weeks /
--      training_days / exercise_blocks / block_exercises /
--      set_prescriptions) -- covers the full Phase 1-4 plan (self-
--      programming now, coach/client later) even though the Phase 1 UI
--      only ever creates straight-set blocks. Building the full shape now
--      avoids a schema migration when supersets/drop sets/coaching ship
--      later.
--
-- Every table has row-level security enabled so a user can only ever read
-- or write their own data -- Supabase's anon key is safe to ship to the
-- browser specifically because RLS enforces this at the database level,
-- not in application code.

-- ============================================================
-- profiles
-- ============================================================
-- Mirrors auth.users with app-specific fields. auth.users is managed by
-- Supabase Auth directly and shouldn't be queried from client code, so we
-- keep a public-schema shadow row per user instead.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'athlete' check (role in ('athlete', 'coach')),
  display_name text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles are readable by their owner"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles are editable by their owner"
  on public.profiles for update
  using (auth.uid() = id);

-- Auto-create a profile row whenever someone signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- saved_results
-- ============================================================
-- Generic progress-tracking table shared by every calculator that
-- supports "save this result" -- one row per save, tool_slug identifies
-- which tool, result is a free-form JSON snapshot of that tool's output.
-- Keeping this generic avoids a new table per calculator.

create table if not exists public.saved_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  tool_slug text not null,
  result jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists saved_results_user_tool_idx
  on public.saved_results (user_id, tool_slug, created_at desc);

alter table public.saved_results enable row level security;

create policy "saved results are readable by their owner"
  on public.saved_results for select
  using (auth.uid() = user_id);

create policy "saved results are insertable by their owner"
  on public.saved_results for insert
  with check (auth.uid() = user_id);

create policy "saved results are deletable by their owner"
  on public.saved_results for delete
  using (auth.uid() = user_id);

-- ============================================================
-- programs
-- ============================================================
-- owner_id: who created/can edit the program (self, or a coach).
-- athlete_id: who the program is assigned to and trains it. Equal to
-- owner_id for self-programming; different once coach-assigned programs
-- ship in Phase 4.

create table if not exists public.programs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  athlete_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  discipline text not null default 'resistance' check (discipline in ('resistance', 'running', 'hybrid')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists programs_owner_idx on public.programs (owner_id);
create index if not exists programs_athlete_idx on public.programs (athlete_id);

alter table public.programs enable row level security;

-- Phase 1: owner and athlete are always the same person, so this simple
-- "owner or athlete" check already covers self-programming correctly and
-- needs no changes once coach-assigned programs (Phase 4) add real
-- owner != athlete rows -- an athlete will be able to view/log a
-- coach-assigned program without being able to edit its structure, which
-- is enforced by only exposing edit actions in the UI to the owner, plus
-- the update/delete policies below being owner-only.
create policy "programs are readable by owner or athlete"
  on public.programs for select
  using (auth.uid() = owner_id or auth.uid() = athlete_id);

create policy "programs are insertable by their owner"
  on public.programs for insert
  with check (auth.uid() = owner_id);

create policy "programs are editable by their owner"
  on public.programs for update
  using (auth.uid() = owner_id);

create policy "programs are deletable by their owner"
  on public.programs for delete
  using (auth.uid() = owner_id);

-- ============================================================
-- program_weeks
-- ============================================================

create table if not exists public.program_weeks (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs (id) on delete cascade,
  position integer not null,
  label text,
  -- Nullable self-reference recording which week this one was duplicated
  -- from, if any -- provenance for the "copy week with progression"
  -- feature, not required for the copy itself to work.
  based_on_week_id uuid references public.program_weeks (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (program_id, position)
);

create index if not exists program_weeks_program_idx on public.program_weeks (program_id);

alter table public.program_weeks enable row level security;

create policy "program weeks follow their program's access"
  on public.program_weeks for all
  using (
    exists (
      select 1 from public.programs p
      where p.id = program_weeks.program_id
        and (p.owner_id = auth.uid() or p.athlete_id = auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.programs p
      where p.id = program_weeks.program_id
        and p.owner_id = auth.uid()
    )
  );

-- ============================================================
-- training_days
-- ============================================================

create table if not exists public.training_days (
  id uuid primary key default gen_random_uuid(),
  week_id uuid not null references public.program_weeks (id) on delete cascade,
  position integer not null,
  label text,
  is_rest_day boolean not null default false,
  unique (week_id, position)
);

create index if not exists training_days_week_idx on public.training_days (week_id);

alter table public.training_days enable row level security;

create policy "training days follow their program's access"
  on public.training_days for all
  using (
    exists (
      select 1 from public.program_weeks w
      join public.programs p on p.id = w.program_id
      where w.id = training_days.week_id
        and (p.owner_id = auth.uid() or p.athlete_id = auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.program_weeks w
      join public.programs p on p.id = w.program_id
      where w.id = training_days.week_id
        and p.owner_id = auth.uid()
    )
  );

-- ============================================================
-- exercise_blocks
-- ============================================================
-- A block holds one exercise (straight set) or several (superset/circuit).
-- "rounds" is how many times the whole block repeats -- e.g. a 3-round
-- superset. Drop sets use a single exercise block with multiple
-- set_prescriptions rows on that one exercise instead of multiple rounds.

create table if not exists public.exercise_blocks (
  id uuid primary key default gen_random_uuid(),
  day_id uuid not null references public.training_days (id) on delete cascade,
  position integer not null,
  block_type text not null default 'straight' check (block_type in ('straight', 'superset', 'circuit', 'dropset')),
  rounds integer not null default 1,
  unique (day_id, position)
);

create index if not exists exercise_blocks_day_idx on public.exercise_blocks (day_id);

alter table public.exercise_blocks enable row level security;

create policy "exercise blocks follow their program's access"
  on public.exercise_blocks for all
  using (
    exists (
      select 1 from public.training_days d
      join public.program_weeks w on w.id = d.week_id
      join public.programs p on p.id = w.program_id
      where d.id = exercise_blocks.day_id
        and (p.owner_id = auth.uid() or p.athlete_id = auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.training_days d
      join public.program_weeks w on w.id = d.week_id
      join public.programs p on p.id = w.program_id
      where d.id = exercise_blocks.day_id
        and p.owner_id = auth.uid()
    )
  );

-- ============================================================
-- block_exercises
-- ============================================================
-- exercise_id references the static exercise database in code
-- (src/lib/workout-generator/exercises.ts) by its string id, not a DB
-- foreign key -- that list is versioned in the codebase, not user-edited.
-- custom_name covers exercises outside that list.

create table if not exists public.block_exercises (
  id uuid primary key default gen_random_uuid(),
  block_id uuid not null references public.exercise_blocks (id) on delete cascade,
  position integer not null,
  exercise_id text,
  custom_name text,
  notes text,
  unique (block_id, position),
  constraint block_exercises_has_a_name check (exercise_id is not null or custom_name is not null)
);

create index if not exists block_exercises_block_idx on public.block_exercises (block_id);

alter table public.block_exercises enable row level security;

create policy "block exercises follow their program's access"
  on public.block_exercises for all
  using (
    exists (
      select 1 from public.exercise_blocks b
      join public.training_days d on d.id = b.day_id
      join public.program_weeks w on w.id = d.week_id
      join public.programs p on p.id = w.program_id
      where b.id = block_exercises.block_id
        and (p.owner_id = auth.uid() or p.athlete_id = auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.exercise_blocks b
      join public.training_days d on d.id = b.day_id
      join public.program_weeks w on w.id = d.week_id
      join public.programs p on p.id = w.program_id
      where b.id = block_exercises.block_id
        and p.owner_id = auth.uid()
    )
  );

-- ============================================================
-- set_prescriptions
-- ============================================================
-- One row per distinct set-type within a block exercise. A normal
-- straight set is a single row (e.g. "3 sets x 8 reps @ 100kg" -- the
-- "3 sets" lives in `sets`, not as 3 separate rows). A drop set is
-- multiple rows in position order, one per drop, each with `sets = 1`.

create table if not exists public.set_prescriptions (
  id uuid primary key default gen_random_uuid(),
  block_exercise_id uuid not null references public.block_exercises (id) on delete cascade,
  position integer not null,
  sets integer not null default 1,
  reps text, -- free text: "8", "8-10", "AMRAP", "30s", etc.
  load_type text not null default 'weight' check (load_type in ('weight', 'percent_1rm', 'rpe', 'bodyweight', 'other')),
  load_value numeric,
  rest_seconds integer,
  notes text,
  unique (block_exercise_id, position)
);

create index if not exists set_prescriptions_block_exercise_idx on public.set_prescriptions (block_exercise_id);

alter table public.set_prescriptions enable row level security;

create policy "set prescriptions follow their program's access"
  on public.set_prescriptions for all
  using (
    exists (
      select 1 from public.block_exercises be
      join public.exercise_blocks b on b.id = be.block_id
      join public.training_days d on d.id = b.day_id
      join public.program_weeks w on w.id = d.week_id
      join public.programs p on p.id = w.program_id
      where be.id = set_prescriptions.block_exercise_id
        and (p.owner_id = auth.uid() or p.athlete_id = auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.block_exercises be
      join public.exercise_blocks b on b.id = be.block_id
      join public.training_days d on d.id = b.day_id
      join public.program_weeks w on w.id = d.week_id
      join public.programs p on p.id = w.program_id
      where be.id = set_prescriptions.block_exercise_id
        and p.owner_id = auth.uid()
    )
  );
