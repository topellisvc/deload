-- Adds 'intervals' as a valid prescription_type for the 'cardio' exercise
-- category — until now cardio prescriptions only covered one continuous
-- effort (time/distance/calories/heart_rate_zone/rpe/coach_notes), with no
-- repeat-based structure the way running's 'intervals' type already has
-- ("6 x 400m"). A coach programming "8 x 30s hard / 90s easy on the
-- Assault Bike" had no way to express that as one exercise row.
--
-- 'intervals' is already a globally-allowed prescription_type string (the
-- top-level set_prescriptions_prescription_type_check constraint from
-- migration 0012 lists it under "running"), so only the per-category
-- allowlist inside enforce_valid_prescription_type() needs to change —
-- that trigger is what actually decides which types are legal for which
-- category, the top-level constraint is just the union of everything any
-- category might ever allow.
--
-- Run this once in the Supabase SQL Editor, after 0027. Safe to re-run.

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
    else array[]::text[]
  end;

  if new.prescription_type <> all(allowed) then
    raise exception 'prescription_type % is not valid for exercise_category %', new.prescription_type, category;
  end if;

  return new;
end;
$$;
