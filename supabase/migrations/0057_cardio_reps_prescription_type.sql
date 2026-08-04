-- Adds 'reps' as a valid prescription_type for cardio-category exercises —
-- bodyweight circuit movements (burpies, mountain climbers, jumping jacks)
-- are counted, not timed/measured/paced, so cardio's existing 6 types
-- (time/distance/calories/heart_rate_zone/rpe/intervals) had no way to
-- express them. 'reps' is already a valid value in the top-level
-- set_prescriptions_prescription_type_check union (added for the mobility
-- category by migration 0056) — only the per-category allow-list inside
-- enforce_valid_prescription_type() needs extending here.
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
    when 'cardio' then array['time', 'distance', 'calories', 'heart_rate_zone', 'rpe', 'intervals', 'coach_notes', 'reps']
    when 'mobility' then array['hold_time', 'reps', 'coach_notes_only']
    else array[]::text[]
  end;

  if new.prescription_type <> all(allowed) then
    raise exception 'prescription_type % is not valid for exercise_category %', new.prescription_type, category;
  end if;

  return new;
end;
$$;
