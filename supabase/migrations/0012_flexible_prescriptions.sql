-- Flexible exercise categories + prescription types + a real performance log.
--
-- The old model conflated two ideas into one nullable-column grab-bag:
-- block_exercises.activity_type was just 'strength' | 'run', and
-- set_prescriptions.load_type ('weight' | 'percent_1rm' | 'rpe' |
-- 'bodyweight' | 'other') only ever described *how a strength load is
-- expressed*. That's too narrow for real coaching: no cardio category at
-- all, no RIR, no rep-range, no coach-notes-only prescriptions, and —
-- more importantly — no separate record of what an athlete actually did.
-- session_logs (migration 0006) is deliberately day-level only ("the
-- existence of a row IS the done state"); this migration adds the
-- per-exercise performance record that file's own comment flagged as a
-- likely future need.
--
-- Three changes:
--   1. block_exercises.activity_type -> exercise_category, widened from
--      ('strength','run') to ('strength','running','cardio').
--   2. set_prescriptions gains a required prescription_type plus the
--      typed columns each type actually needs (min/max reps, a dedicated
--      weight_value distinct from percent_1rm_value, rir_value,
--      heart_rate_zone, calories, pr_record_type). load_type is retired
--      once every row is backfilled — keeping both would be exactly the
--      kind of duplicated field this redesign is trying to remove.
--   3. A new logged_sets table: the performance side. Nullable
--      set_prescription_id (on delete set null, not cascade) means a
--      coach editing next week's weights doesn't retroactively corrupt
--      last week's historical log — the planned row can change or
--      disappear without the logged row losing its place in
--      (session_log, block_exercise, position). block_exercise_id itself
--      still cascades, matching every other table in this schema
--      (training_days -> session_logs already behaves the same way);
--      changing that broader "structure deleted = its logs go too"
--      precedent is a separate decision, not part of this migration.
--
-- Every valid (category, prescription_type) pairing is enforced by a
-- trigger (RLS/check constraints can't see across the block_exercises join
-- a plain check constraint would need) — same pattern as
-- enforce_message_read_only_update in migration 0011.
--
-- Run this once in the Supabase SQL Editor. Safe to re-run.

-- ============================================================
-- block_exercises: activity_type -> exercise_category
-- ============================================================

alter table public.block_exercises rename column activity_type to exercise_category;

alter table public.block_exercises drop constraint if exists block_exercises_activity_type_check;
alter table public.block_exercises drop constraint if exists block_exercises_exercise_category_check;

update public.block_exercises set exercise_category = 'running' where exercise_category = 'run';

alter table public.block_exercises
  add constraint block_exercises_exercise_category_check
  check (exercise_category in ('strength', 'running', 'cardio'));

-- ============================================================
-- set_prescriptions: prescription_type + typed fields
-- ============================================================

alter table public.set_prescriptions add column if not exists prescription_type text;
alter table public.set_prescriptions add column if not exists min_reps integer;
alter table public.set_prescriptions add column if not exists max_reps integer;
alter table public.set_prescriptions add column if not exists weight_value numeric;
alter table public.set_prescriptions add column if not exists percent_1rm_value numeric;
-- Which personal_records.record_type the percent_1rm suggestion reads
-- from (e.g. 'bench_press') — free text, matching how personal_records
-- itself already stores record_type (see lib/profile/personal-records.ts).
-- Not a foreign key: a PR row for that type may not exist yet at the time
-- a prescription is written, and shouldn't block saving the program.
alter table public.set_prescriptions add column if not exists pr_record_type text;
alter table public.set_prescriptions add column if not exists rpe_value numeric;
alter table public.set_prescriptions add column if not exists rir_value numeric;
alter table public.set_prescriptions add column if not exists heart_rate_zone integer check (heart_rate_zone between 1 and 5);
alter table public.set_prescriptions add column if not exists calories numeric;

-- Backfill prescription_type from the old load_type + the (now renamed)
-- exercise_category, one UPDATE per old case. Existing weight/percent/rpe
-- values move into their new dedicated columns rather than staying
-- crammed into the old generic load_value.
update public.set_prescriptions sp
set prescription_type = 'fixed_weight', weight_value = sp.load_value
from public.block_exercises be
where be.id = sp.block_exercise_id and be.exercise_category = 'strength' and sp.load_type = 'weight';

update public.set_prescriptions sp
set prescription_type = 'percent_1rm', percent_1rm_value = sp.load_value
from public.block_exercises be
where be.id = sp.block_exercise_id and be.exercise_category = 'strength' and sp.load_type = 'percent_1rm';

update public.set_prescriptions sp
set prescription_type = 'rpe', rpe_value = sp.load_value
from public.block_exercises be
where be.id = sp.block_exercise_id and be.exercise_category = 'strength' and sp.load_type = 'rpe';

-- 'bodyweight' had no meaningful numeric load in the old model (its
-- LOAD_TYPE_META unit was null — the UI never showed a value field for
-- it), so the closest honest new type is "the athlete picks the load"
-- rather than inventing a bodyweight-specific type for a handful of rows.
update public.set_prescriptions sp
set prescription_type = 'athlete_chooses_weight'
from public.block_exercises be
where be.id = sp.block_exercise_id and be.exercise_category = 'strength' and sp.load_type = 'bodyweight';

update public.set_prescriptions sp
set prescription_type = 'coach_notes_only'
from public.block_exercises be
where be.id = sp.block_exercise_id and be.exercise_category = 'strength' and sp.load_type = 'other';

-- Running rows previously always carried both distance_meters and
-- duration_seconds together (RunSetRowEditor showed both fields on every
-- row, whether or not either was filled in) — 'distance_time' preserves
-- that exact existing shape losslessly as its own type, alongside the new
-- single-purpose types (distance / time / pace / heart_rate_zone / rpe /
-- intervals) this migration adds for new rows going forward.
update public.set_prescriptions sp
set prescription_type = 'distance_time'
from public.block_exercises be
where be.id = sp.block_exercise_id and be.exercise_category = 'running' and sp.prescription_type is null;

-- Any remaining rows (block_exercise somehow missing, or a category this
-- migration doesn't expect) get a safe, honest fallback rather than being
-- left null.
update public.set_prescriptions set prescription_type = 'coach_notes_only' where prescription_type is null;

alter table public.set_prescriptions alter column prescription_type set not null;

alter table public.set_prescriptions drop constraint if exists set_prescriptions_prescription_type_check;
alter table public.set_prescriptions
  add constraint set_prescriptions_prescription_type_check
  check (prescription_type in (
    -- strength
    'fixed_weight', 'percent_1rm', 'rpe', 'rir', 'rep_range', 'athlete_chooses_weight', 'coach_notes_only',
    -- running
    'distance', 'time', 'pace', 'heart_rate_zone', 'intervals', 'distance_time', 'coach_notes',
    -- cardio adds 'calories' on top of the running set (rpe/heart_rate_zone/distance/time/coach_notes already listed above)
    'calories'
  ));

alter table public.set_prescriptions drop column if exists load_type;
alter table public.set_prescriptions drop column if exists load_value;

-- Cross-column validation a plain check constraint can't express: which
-- prescription_type values are actually legal depends on the *parent*
-- block_exercise's exercise_category, not just this row.
create or replace function public.enforce_valid_prescription_type()
returns trigger
language plpgsql
as $$
declare
  category text;
  allowed text[];
begin
  select exercise_category into category from public.block_exercises where id = new.block_exercise_id;

  allowed := case category
    when 'strength' then array['fixed_weight', 'percent_1rm', 'rpe', 'rir', 'rep_range', 'athlete_chooses_weight', 'coach_notes_only']
    when 'running' then array['distance', 'time', 'pace', 'heart_rate_zone', 'rpe', 'intervals', 'distance_time', 'coach_notes']
    when 'cardio' then array['time', 'distance', 'calories', 'heart_rate_zone', 'rpe', 'coach_notes']
    else array[]::text[]
  end;

  if new.prescription_type <> all(allowed) then
    raise exception 'prescription_type % is not valid for exercise_category %', new.prescription_type, category;
  end if;

  return new;
end;
$$;

drop trigger if exists set_prescriptions_valid_type on public.set_prescriptions;
create trigger set_prescriptions_valid_type
  before insert or update on public.set_prescriptions
  for each row execute function public.enforce_valid_prescription_type();

-- ============================================================
-- logged_sets: the performance side
-- ============================================================
-- One row per actually-performed set (strength) or per performance entry
-- (running/cardio typically log one summary row per exercise, but nothing
-- here stops logging more — e.g. per-interval splits later). Never
-- overwrites set_prescriptions; this is a wholly separate, additive
-- record, exactly per "the logged workout must never overwrite the
-- planned workout."

create table if not exists public.logged_sets (
  id uuid primary key default gen_random_uuid(),
  session_log_id uuid not null references public.session_logs (id) on delete cascade,
  block_exercise_id uuid not null references public.block_exercises (id) on delete cascade,
  -- Which planned row this corresponds to, if any — purely for
  -- provenance/future adherence scoring, never required to render a
  -- planned-vs-performed comparison (that's grouped by block_exercise_id,
  -- not paired row-for-row). See migration header for why this is
  -- `set null`, not `cascade`.
  set_prescription_id uuid references public.set_prescriptions (id) on delete set null,
  position integer not null,
  performed_weight numeric,
  performed_reps integer,
  performed_rpe numeric,
  performed_distance_meters numeric,
  performed_duration_seconds integer,
  performed_pace_seconds_per_km numeric,
  performed_heart_rate integer,
  performed_calories numeric,
  notes text,
  created_at timestamptz not null default now(),
  unique (session_log_id, block_exercise_id, position)
);

create index if not exists logged_sets_session_log_idx on public.logged_sets (session_log_id);
create index if not exists logged_sets_block_exercise_idx on public.logged_sets (block_exercise_id);

alter table public.logged_sets enable row level security;

drop policy if exists "logged sets are readable by the program's owner or athlete" on public.logged_sets;
drop policy if exists "athletes can log their own performance" on public.logged_sets;
drop policy if exists "athletes can edit their own logged sets" on public.logged_sets;
drop policy if exists "athletes can delete their own logged sets" on public.logged_sets;

-- Same owner-or-athlete read pattern as every other table in this schema,
-- reached via session_logs -> training_days -> program_weeks -> programs.
create policy "logged sets are readable by the program's owner or athlete"
  on public.logged_sets for select
  using (
    exists (
      select 1 from public.session_logs sl
      join public.training_days d on d.id = sl.training_day_id
      join public.program_weeks w on w.id = d.week_id
      join public.programs p on p.id = w.program_id
      where sl.id = logged_sets.session_log_id
        and (p.owner_id = auth.uid() or p.athlete_id = auth.uid())
    )
  );

-- Write access is athlete-only, same as session_logs itself — logging
-- what you actually did is self-reported, not something a coach fills in
-- on someone else's behalf.
create policy "athletes can log their own performance"
  on public.logged_sets for insert
  with check (
    exists (select 1 from public.session_logs sl where sl.id = logged_sets.session_log_id and sl.athlete_id = auth.uid())
  );

create policy "athletes can edit their own logged sets"
  on public.logged_sets for update
  using (
    exists (select 1 from public.session_logs sl where sl.id = logged_sets.session_log_id and sl.athlete_id = auth.uid())
  );

create policy "athletes can delete their own logged sets"
  on public.logged_sets for delete
  using (
    exists (select 1 from public.session_logs sl where sl.id = logged_sets.session_log_id and sl.athlete_id = auth.uid())
  );
