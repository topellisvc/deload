-- A coach's personal library of custom exercises — every name they've ever
-- typed into the Program Builder's exercise search that didn't already
-- match the built-in strength catalog or the running/cardio suggestion
-- lists (lib/programs/exercise-catalog.ts) gets saved here, so "Backwards
-- Sled Drag" only has to be typed once: it shows up as a real search result
-- (see lib/programs/exercise-search.ts) every time after that, for every
-- program this coach builds, not just re-typed as a one-off custom_name on
-- a single block_exercises row.
--
-- Deliberately does not touch block_exercises.exercise_id/custom_name at
-- all — an exercise picked from here still lands in custom_name exactly
-- like any other non-catalog name always has (exercise_id stays reserved
-- for the static strength catalog's own ids). This table is purely a
-- per-owner list of "names I've used before," not a new kind of foreign
-- key to thread through the program tree.
--
-- Scoped to owner_id (the coach/self-programmer who typed it), not shared
-- across coaches — "their exercise library," matching how program_templates
-- (migration 0020) is already scoped per-owner rather than global.
--
-- Run this once in the Supabase SQL Editor, after 0030. Safe to re-run.

create table if not exists public.exercise_library (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  category text not null check (category in ('strength', 'running', 'cardio')),
  created_at timestamptz not null default now(),
  -- Case-sensitive uniqueness is enough here: the app itself de-dupes
  -- case-insensitively before ever inserting (see addToExerciseLibrary),
  -- this is a backstop against a genuine double-submit, not the primary
  -- guard.
  unique (owner_id, category, name)
);

create index if not exists exercise_library_owner_category_idx on public.exercise_library (owner_id, category);

alter table public.exercise_library enable row level security;

drop policy if exists "exercise library is readable by its owner" on public.exercise_library;
drop policy if exists "exercise library is insertable by its owner" on public.exercise_library;
drop policy if exists "exercise library is deletable by its owner" on public.exercise_library;

create policy "exercise library is readable by its owner"
  on public.exercise_library for select
  using (auth.uid() = owner_id);

create policy "exercise library is insertable by its owner"
  on public.exercise_library for insert
  with check (auth.uid() = owner_id);

create policy "exercise library is deletable by its owner"
  on public.exercise_library for delete
  using (auth.uid() = owner_id);
