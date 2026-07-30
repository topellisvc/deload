-- Same class of gap as 0048/0049 (a data gap, not a code bug this time —
-- unlike the running/cardio warning fixed in the assemble.ts commit
-- alongside 0049): zero exercises anywhere in the library have
-- primary_muscle_group 'biceps' or 'triceps', confirmed live. Every
-- push/pull/legs and push/pull day split (splits.ts's "push" and "pull"
-- cases) unconditionally asks for an accessory(null, "triceps") and
-- accessory(null, "biceps") slot — these are muscle-group-only slots (no
-- SlotPattern, resolved by select-exercises.ts's selectByMuscleGroup, not
-- the Appendix C ladder), so with nothing tagged for either muscle group
-- this fired "no exercise available for main slot (triceps/biceps)" on
-- every Push/Pull day, every push/pull-style program generated.
--
-- No slot_patterns/demand_rank metadata needed — muscle-group-only slots
-- don't walk a ladder, they're just filtered by category + primary_muscle_
-- group + the usual equipment/injury/coaching hard filters (matching the
-- existing untagged isolation accessories already in the library, e.g.
-- dumbbell-lateral-raise, dumbbell-chest-fly).
--
-- Three triceps + four biceps options, spanning every EquipmentAccess tier
-- (patterns.ts's EQUIPMENT_BY_ACCESS) so a bodyweight_only athlete isn't
-- left with nothing: the manual-resistance biceps curl uses the same
-- self-resistance mechanism as 0049's manual-resistance neck flexion for
-- exactly that reason.
--
-- Run this once in the Supabase SQL Editor, after 0049. Safe to re-run —
-- the insert is ON CONFLICT DO NOTHING.

insert into public.exercises (
  id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups,
  equipment, difficulty, description,
  instructions_setup, instructions_execution, instructions_breathing, instructions_finishing,
  tags, metadata, owner_id, review_status
) values
  -- triceps
  (
    'cable-triceps-pushdown', 'Cable Triceps Pushdown', 'strength', null, 'triceps', '{}'::text[],
    'cable', 'beginner',
    'A cable isolation movement for the triceps — one of the most reliable ways to add direct arm volume on top of whatever pressing already provides.',
    'Set up standing facing a high cable pulley with a straight or angled bar attached, elbows tucked against the ribs, hands just outside shoulder-width on the bar.',
    'Keeping the elbows pinned to the ribs, extend the arms down until they''re straight, then return under control to the starting position without letting the elbows drift forward.',
    'Exhale as you press down; inhale as you return.',
    'Finish with the arms extended (not locked hard) and the elbows still tucked against the ribs.',
    ARRAY['cable', 'triceps-focus', 'isolation', 'accessory']::text[],
    '{}'::jsonb,
    null, 'approved'
  ),
  (
    'dumbbell-overhead-triceps-extension', 'Dumbbell Overhead Triceps Extension', 'strength', null, 'triceps', '{}'::text[],
    'dumbbell', 'beginner',
    'An overhead triceps isolation movement — the overhead arm position lengthens the long head of the triceps for a deeper stretch than a pushdown gives.',
    'Set up seated or standing, holding one dumbbell overhead with both hands cupped under the top plate, elbows pointed forward.',
    'Keeping the upper arms still and close to the head, lower the dumbbell behind the head by bending the elbows, then extend back up to the starting position.',
    'Inhale as you lower; exhale as you extend back up.',
    'Finish with the arms extended overhead (not locked hard) and the dumbbell under control.',
    ARRAY['dumbbell', 'triceps-focus', 'isolation', 'accessory']::text[],
    '{}'::jsonb,
    null, 'approved'
  ),
  (
    'bodyweight-bench-dip', 'Bench Dip', 'strength', null, 'triceps', ARRAY['shoulders']::text[],
    'bodyweight', 'intermediate',
    'A bodyweight triceps exercise using a bench or box behind you — the most accessible loaded triceps option when no equipment is available.',
    'Set up with hands on the edge of a bench behind you, fingers pointing forward, legs extended out in front (bent knees for an easier version), hips just in front of the bench.',
    'Lower the hips straight down by bending the elbows until the upper arms are roughly parallel to the floor, then press back up through the hands to full extension.',
    'Inhale on the way down, exhale as you press back up.',
    'Finish with the arms extended (not locked hard) and the hips close to the bench.',
    ARRAY['bodyweight', 'triceps-focus', 'no-equipment', 'accessory']::text[],
    '{}'::jsonb,
    null, 'approved'
  ),

  -- biceps
  (
    'dumbbell-biceps-curl', 'Dumbbell Biceps Curl', 'strength', null, 'biceps', '{}'::text[],
    'dumbbell', 'beginner',
    'The classic dumbbell biceps isolation movement — direct arm volume that pulling compounds only partially provide.',
    'Set up standing or seated, a dumbbell in each hand at the sides, palms facing forward.',
    'Keeping the upper arms still and pinned to the sides, curl the dumbbells up toward the shoulders, then lower under control back to the starting position.',
    'Exhale as you curl up; inhale as you lower.',
    'Finish with the arms extended at the sides and the shoulders relaxed, not shrugged.',
    ARRAY['dumbbell', 'biceps-focus', 'isolation', 'accessory']::text[],
    '{}'::jsonb,
    null, 'approved'
  ),
  (
    'barbell-biceps-curl', 'Barbell Biceps Curl', 'strength', null, 'biceps', '{}'::text[],
    'barbell', 'beginner',
    'A barbell biceps isolation movement — lets both arms be loaded identically and progressed with small, exact jumps.',
    'Set up standing, holding a barbell with an underhand, shoulder-width grip, arms extended in front of the thighs.',
    'Keeping the upper arms still and pinned to the sides, curl the bar up toward the shoulders, then lower under control back to the starting position.',
    'Exhale as you curl up; inhale as you lower.',
    'Finish with the arms extended in front of the thighs and the shoulders relaxed, not shrugged.',
    ARRAY['barbell', 'biceps-focus', 'isolation', 'accessory']::text[],
    '{}'::jsonb,
    null, 'approved'
  ),
  (
    'band-biceps-curl', 'Band Biceps Curl', 'strength', null, 'biceps', '{}'::text[],
    'resistance_band', 'beginner',
    'A band-resisted biceps curl — a minimal-equipment substitute for a dumbbell or barbell curl that still lets load progress over time with a heavier band.',
    'Set up standing on the middle of a resistance band with both feet, holding an end of the band in each hand at the sides, palms facing forward.',
    'Keeping the upper arms still and pinned to the sides, curl the hands up toward the shoulders against the band''s resistance, then lower under control back to the starting position.',
    'Exhale as you curl up; inhale as you lower.',
    'Finish with the arms extended at the sides and tension still on the band, not slack.',
    ARRAY['resistance_band', 'biceps-focus', 'isolation', 'accessory']::text[],
    '{}'::jsonb,
    null, 'approved'
  ),
  (
    'manual-resistance-biceps-curl', 'Manual Resistance Biceps Curl', 'strength', null, 'biceps', '{}'::text[],
    'bodyweight', 'beginner',
    'A no-equipment biceps curl using your own opposite hand for resistance — the only meaningful direct-biceps option when absolutely no equipment is available.',
    'Set up standing or seated, one hand gripping the opposite wrist in front of the body, the gripping hand ready to resist the curl.',
    'Curl the working arm up while the opposite hand resists the motion with a steady, moderate effort, then reverse the resistance to lower back down under control.',
    'Breathe steadily throughout rather than holding your breath.',
    'Finish with the working arm extended and both hands relaxed before switching sides.',
    ARRAY['bodyweight', 'biceps-focus', 'no-equipment', 'accessory']::text[],
    '{}'::jsonb,
    null, 'approved'
  )
on conflict (id) do nothing;
