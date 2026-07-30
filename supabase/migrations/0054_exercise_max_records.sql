-- exercise_max_records: an append-only history of estimated 1RMs per
-- athlete per exercise — "a library of an athlete's max weights" the
-- athlete/coach can watch progress over time, one row per test. Unlike
-- personal_records (upserted on (user_id, record_type), so only the latest
-- value ever survives) this deliberately keeps every test as its own row.
--
-- exercise_id is text, matching exercises.id's own type — this covers ANY
-- exercise in the library, not just the 4 fixed lift strings
-- personal_records.record_type is limited to (bench_press/squat/deadlift/
-- overhead_press). That's what makes the manual program builder's new
-- "test max before" checkbox (block_exercises.test_max_before, below) work
-- for arbitrary exercises rather than only the 4 main lifts.
create table public.exercise_max_records (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references auth.users(id) on delete cascade,
  exercise_id text not null references public.exercises(id) on delete cascade,
  estimated_1rm_kg numeric not null,
  performed_on date not null default current_date,
  -- Best-effort provenance only ("tested during this program's testing
  -- week") — nullable and on delete set null, since the history itself
  -- should outlive any one program the way personal_records already
  -- outlives whatever session first recorded it.
  program_id uuid references public.programs(id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.exercise_max_records is
  'Append-only history of estimated 1RMs per athlete per exercise (any exercise, not just the 4 main lifts) — a "library of maxes" for progress tracking and for auto-suggesting percent_1rm weights. See saveExerciseMaxRecords in lib/training/mutations.ts.';

create index exercise_max_records_athlete_exercise_idx
  on public.exercise_max_records (athlete_id, exercise_id, performed_on desc);

alter table public.exercise_max_records enable row level security;

-- Same owner-only shape as personal_records (migration 0009) — no coach-read
-- policy exists for personal_records either, so this doesn't add one.
create policy "exercise max records are readable by their owner"
  on public.exercise_max_records for select
  using (auth.uid() = athlete_id);

create policy "exercise max records are insertable by their owner"
  on public.exercise_max_records for insert
  with check (auth.uid() = athlete_id);

create policy "exercise max records are deletable by their owner"
  on public.exercise_max_records for delete
  using (auth.uid() = athlete_id);

-- test_max_before: the manual program builder's new per-exercise "Test max
-- before" checkbox — marks that this specific exercise usage should get a
-- max-test set generated into the program's inserted testing week (see the
-- builder's "Add testing week" button). Lives on block_exercises (one
-- usage/instance of an exercise within a block), not set_prescriptions,
-- since it's about "should this exercise be tested," independent of any
-- one set's own fields — the generated test set itself is a normal
-- set_prescriptions row with is_max_test = true (migration 0052), same as
-- the generator's own testing-week rows.
alter table public.block_exercises
  add column if not exists test_max_before boolean not null default false;

comment on column public.block_exercises.test_max_before is
  'Manual program builder: "Test max before" checkbox. The program''s testing week (program_weeks.is_testing_week) is generated/synced to include one max-test set per exercise flagged true anywhere in the program.';

-- is_testing_week: marks the one week (if any) the builder's "Add testing
-- week" button generated — lets it find "the" testing week again on a
-- repeat click (to sync in newly-flagged exercises) instead of guessing
-- from position or label text, which a coach could rename.
alter table public.program_weeks
  add column if not exists is_testing_week boolean not null default false;

comment on column public.program_weeks.is_testing_week is
  'True for the one week (always inserted at position 1) the manual builder''s "Add testing week" button generated. Lets the button find and re-sync it on later clicks.';
