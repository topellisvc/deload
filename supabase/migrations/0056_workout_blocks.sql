-- Workout Blocks architecture, phase 1 (database): real block_type values
-- for every purpose the Program Builder's new "+ Add Block" type picker
-- offers (Single Exercise, Superset, Circuit, Cardio Session, Warm-up,
-- Mobility, Conditioning/Finisher), plus the settings a Circuit block
-- needs (name, goal, completion method, rest-between-exercises/-rounds,
-- notes, and the generic duration/interval fields several completion
-- methods share).
--
-- 'circuit' already existed in exercise_blocks' block_type check
-- constraint but was never actually written by the app — a block with 3+
-- exercises was just relabeled "Circuit" client-side (exercise-block-
-- card.tsx's groupLabel) while still being block_type='superset'
-- underneath. This migration makes 'circuit' — and the four purpose-based
-- types below — real, explicitly-chosen values instead of a derived
-- label, per the "do not simply add a Circuit option, refactor so
-- different block types can exist naturally" brief.
--
-- 'straight' is renamed to 'single' to match the picker's own "Single
-- Exercise" wording — every existing row (241 of them, confirmed live at
-- authoring time) just gets its block_type value updated in place,
-- nothing else about the row changes. block_role ('warmup'/'main'/
-- 'conditioning', migration 0032) is left untouched and orthogonal to
-- block_type on purpose: block_type answers "what kind of block is this,"
-- block_role answers "which section of the day does it render in" — a
-- Warm-up-typed block still defaults into the warmup section but isn't
-- forced to stay there, same flexibility every other block already has.
--
-- All new columns are nullable so every block created before this
-- migration keeps rendering and behaving exactly as before.
--
-- Run this once in the Supabase SQL Editor (or via the Supabase MCP), after
-- 0055. Safe to re-run.

alter table public.exercise_blocks
  -- Circuit Name (also usable as a plain label for any block type, e.g.
  -- "Warm-up A") — block_exercises already has an equivalent custom_name
  -- for one exercise; blocks never had their own until now.
  add column if not exists custom_name text,
  -- Coach Notes for the whole block ("Move continuously. Focus on quality
  -- movement.") — shown to the athlete before they start it, same idea as
  -- block_exercises.notes but scoped to the whole block instead of one
  -- exercise inside it.
  add column if not exists notes text,
  -- Circuit Goal (Strength/Hypertrophy/Conditioning/Mobility/
  -- Rehabilitation/Warm-up/Power/Endurance) — plain text, not an enum:
  -- "primarily organisational but may also influence future analytics"
  -- per spec, so it doesn't need a hard constraint the way block_type
  -- (which drives real branching logic) does.
  add column if not exists goal text,
  -- Completion Method — each value dynamically changes which of the
  -- fields below are actually shown/used (see lib/programs/
  -- completion-methods.ts, the declarative field map mirroring
  -- prescription-types.ts's existing pattern). Only meaningful for
  -- circuit/superset blocks; null everywhere else.
  add column if not exists completion_method text
    check (completion_method in ('traditional_rounds', 'timed', 'amrap', 'emom', 'for_time', 'quality')),
  -- Rest Between Exercises — the circuit-level default; an individual
  -- exercise's own set_prescriptions.rest_seconds (already exists) can
  -- still override it, which is exactly the "Rest inherited from circuit"
  -- behavior in the spec's own example.
  add column if not exists rest_between_exercises_seconds integer,
  -- Rest Between Rounds.
  add column if not exists rest_between_rounds_seconds integer,
  -- Shared by Timed Circuit (run for this long), AMRAP (as many rounds as
  -- possible in this long), and optionally For Time (a time cap) — same
  -- "one wide nullable column, meaning depends on which type it's
  -- attached to" approach set_prescriptions already uses successfully for
  -- prescription_type, rather than one column per completion method.
  add column if not exists duration_seconds integer,
  -- EMOM's "every N seconds" interval.
  add column if not exists interval_seconds integer;

-- Constraint dropped before the rename below (not after) — the old
-- constraint doesn't permit 'single' any more than the new one permits
-- 'straight', so whichever constraint is in effect during the UPDATE would
-- reject it either way unless neither is.
alter table public.exercise_blocks
  drop constraint exercise_blocks_block_type_check;

update public.exercise_blocks set block_type = 'single' where block_type = 'straight';

alter table public.exercise_blocks
  add constraint exercise_blocks_block_type_check
  check (block_type in (
    'single', 'superset', 'circuit', 'cardio_session', 'warmup', 'mobility', 'conditioning',
    -- Kept valid but not yet written by the app — see "Future Architecture"
    -- (Tri-Set, Giant Set, Complex, Contrast Set, Plyometric, Olympic
    -- Lifting, Partner, Relay use this same column later; dropset already
    -- existed here and is grouped with them for now).
    'dropset'
  ));

alter table public.exercise_blocks
  alter column block_type set default 'single';

-- Forward-compat for Training Mode's future circuit-round sequencing (not
-- built in this phase — see the accompanying plan) — lets a logged set
-- record which round of a circuit/superset it belonged to without a
-- second migration once that work starts. Null for every set logged
-- against a non-round-based block, which is every set logged today.
alter table public.logged_sets
  add column if not exists round_number integer;

-- 'mobility' as a first-class exercise_category, alongside strength/
-- running/cardio (migration 0012's rename from activity_type) — a
-- Mobility block's exercises (stretches, activation drills, band work)
-- don't fit any of the existing three, and forcing them into 'strength'
-- would offer weight/RPE/RIR prescriptions that don't apply. This reuses
-- every bit of existing per-exercise prescription plumbing
-- (set_prescriptions, the enforce_valid_prescription_type() trigger,
-- prescription-types.ts's declarative field map) the same way strength/
-- running/cardio already do — a 4th category, not a new mechanism.
alter table public.block_exercises
  drop constraint block_exercises_exercise_category_check;

alter table public.block_exercises
  add constraint block_exercises_exercise_category_check
  check (exercise_category in ('strength', 'running', 'cardio', 'mobility'));

-- Two new prescription_type values mobility exercises actually need
-- ('hold_time' — "60 sec each side"; 'reps' — "10 reps each side", no
-- weight/RPE attached) — added to the global allowlist (every category's
-- legal types unioned together, same as every prior prescription_type
-- addition, e.g. migration 0028's 'intervals' for cardio) before the
-- per-category trigger below can allow them for 'mobility'.
alter table public.set_prescriptions
  drop constraint set_prescriptions_prescription_type_check;

alter table public.set_prescriptions
  add constraint set_prescriptions_prescription_type_check
  check (prescription_type in (
    'fixed_weight', 'percent_1rm', 'rpe', 'rir', 'rep_range', 'athlete_chooses_weight', 'coach_notes_only',
    'distance', 'time', 'pace', 'heart_rate_zone', 'intervals', 'distance_time', 'coach_notes', 'calories',
    'hold_time', 'reps'
  ));

-- Adds the 'mobility' branch to the same trigger function migration 0028
-- last updated for cardio's 'intervals' — this is what actually decides
-- which prescription types are legal for which exercise_category; the
-- constraint above is just the union of everything any category might
-- ever allow.
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
    when 'cardio' then array['time', 'distance', 'calories', 'heart_rate_zone', 'rpe', 'intervals', 'coach_notes']
    when 'mobility' then array['hold_time', 'reps', 'coach_notes_only']
    else array[]::text[]
  end;

  if new.prescription_type <> all(allowed) then
    raise exception 'prescription_type % is not valid for exercise_category %', new.prescription_type, category;
  end if;

  return new;
end;
$$;
