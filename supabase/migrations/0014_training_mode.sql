-- Training Mode: the guided, one-exercise/one-set-at-a-time execution
-- experience that "Start Workout" launches, replacing the old behaviour of
-- just opening the program page.
--
-- Deliberately does NOT touch session_logs or logged_sets. Those two tables
-- already are the historical record (migrations 0006 and 0012) and every
-- existing dashboard/profile/coaching/history query assumes a session_logs
-- row means "this happened" — adding an in-progress status there would mean
-- auditing and patching every one of those call sites to exclude it. Instead,
-- an in-progress workout lives entirely in this new table as scratch state;
-- "Finish Workout" reads it and calls the *existing* createSessionLog /
-- createLoggedSet mutations exactly as the manual logging flow always has
-- (see lib/training/mutations.ts's finishWorkout), then this row is deleted.
-- Nothing downstream of session_logs/logged_sets needs to know Training Mode
-- exists.
--
-- No separate "current position" cursor columns: resume position is derived
-- by comparing draft_sets against the program's own exercise sequence
-- (lib/training/sequence.ts) — the first exercise with fewer logged draft
-- sets than its prescription calls for. Storing a redundant cursor risks it
-- drifting from the data it's supposed to describe; deriving it can't.
--
-- Run this once in the Supabase SQL Editor. Safe to re-run.

create table if not exists public.training_mode_sessions (
  id uuid primary key default gen_random_uuid(),
  training_day_id uuid not null references public.training_days (id) on delete cascade,
  athlete_id uuid not null references auth.users (id) on delete cascade,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Array of DraftSet (lib/training/types.ts) — one entry per completed
  -- set/segment so far, in the same shape createLoggedSet's params take.
  -- Scratch space only; never read by anything outside Training Mode.
  draft_sets jsonb not null default '[]'::jsonb,
  -- Record<block_exercise_id, string> — the athlete's free-text note per
  -- exercise (spec: "Left shoulder felt tight"). Folded into logged_sets as
  -- a notes-only row per exercise at Finish Workout time, same as every
  -- other performance data point — see finishWorkout.
  exercise_notes jsonb not null default '{}'::jsonb,
  workout_note text,
  -- At most one in-progress workout per athlete per training day — starting
  -- Training Mode again for a day that already has a draft resumes it
  -- instead of creating a second one.
  unique (training_day_id, athlete_id)
);

create index if not exists training_mode_sessions_athlete_idx on public.training_mode_sessions (athlete_id);

alter table public.training_mode_sessions enable row level security;

drop policy if exists "athletes manage their own training mode sessions" on public.training_mode_sessions;

-- Purely private scratch state — unlike session_logs/logged_sets, a coach
-- never needs to see an unfinished draft, so this is athlete-only for every
-- operation rather than the owner-or-athlete read pattern used elsewhere.
create policy "athletes manage their own training mode sessions"
  on public.training_mode_sessions for all
  using (auth.uid() = athlete_id)
  with check (auth.uid() = athlete_id);

-- ============================================================
-- Previous Performance lookups
-- ============================================================
-- "Compare against the athlete's previous performed workout" (not the
-- programmed one) means matching an exercise across different weeks/days —
-- each week's block_exercises rows are distinct, so the match key is
-- exercise_id/custom_name, not block_exercise_id. Neither column was
-- previously indexed since nothing queried by them directly before now.

create index if not exists block_exercises_exercise_id_idx on public.block_exercises (exercise_id);
create index if not exists block_exercises_custom_name_idx on public.block_exercises (custom_name);
