-- Found by a systematic combinatorial test (every goal x a wide sweep of
-- experience/days/equipment/injury/etc.), not manual QA like 0048-0050 —
-- same class of gap (a real pattern with zero exercises surviving a real
-- constraint combination), caught by simulating assembleWeeks across ~3,100
-- scenarios instead of generating programs by hand one at a time.
--
-- Four gaps, all "every candidate ruled out by equipment/injury filters"
-- rather than "nothing tagged at all" (0048/0049's kind):
--
-- 1. jump: box-jump, broad-jump, lateral-bound, tuck-jump, and jump-squat
--    are ALL FIVE tagged injury_contraindications: ["knee_anterior_patellar"]
--    — so any athlete with that (common) knee presentation gets zero jump
--    options, at any equipment tier, not just a low one. This is the most
--    severe of the four: it's injury-driven, not equipment-driven, so it
--    hits full_gym athletes too. Fixed with a pogo hop — a real, commonly
--    prescribed low-amplitude, ankle-dominant plyometric specifically used
--    for anterior knee pain because it minimises knee flexion under load,
--    unlike every existing jump option here. No knee_anterior_patellar
--    contraindication tag, deliberately.
-- 2. calf_soleus: seated-calf-raise is the only option and it's
--    machine-equipment, so minimal_equipment and bodyweight_only athletes
--    get nothing. Fixed with a bent-knee bodyweight calf raise — bending
--    the knee during a calf raise is the standard no-equipment way to bias
--    the soleus over the gastrocnemius.
-- 3. hip_abduction: band-lateral-walk and cable-hip-abduction both need
--    equipment bodyweight_only doesn't have. Fixed with a clamshell — the
--    standard no-equipment hip abduction exercise.
-- 4. shoulder_external_rotation: band-external-rotation and
--    cable-external-rotation, same bodyweight_only gap. Fixed with a
--    manual-resistance variant, same self-resistance mechanism as 0049's
--    neck flexion and 0050's biceps curl.
--
-- A fifth gap (throw) was also found — medicine-ball-slam is the only throw
-- option and medicine_ball isn't in minimal_equipment/bodyweight_only. Not
-- fixed here: a throw pattern's whole point is an implement to throw, so a
-- bodyweight "substitute" wouldn't train the same thing. Left as a real,
-- disclosed equipment-tier limitation rather than a fabricated exercise.
--
-- Run this once in the Supabase SQL Editor, after 0050. Safe to re-run —
-- the insert is ON CONFLICT DO NOTHING.

insert into public.exercises (
  id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups,
  equipment, difficulty, description,
  instructions_setup, instructions_execution, instructions_breathing, instructions_finishing,
  tags, metadata, owner_id, review_status
) values
  (
    'pogo-hop', 'Pogo Hop', 'plyometrics', 'jump', 'calves', ARRAY['quadriceps']::text[],
    'bodyweight', 'beginner',
    'A small, fast, ankle-dominant hop with minimal knee bend — the standard low-impact jump option for anyone whose knees can''t tolerate a deep-landing plyometric like a box jump or tuck jump.',
    'Stand tall with feet hip-width apart, knees soft but not deeply bent, hands relaxed or on hips.',
    'Hop repeatedly in place using mostly the ankles, keeping ground contact time short and knee bend minimal — think "bouncing," not "jumping high."',
    'Breathe naturally and rhythmically with the hops.',
    'Finish standing tall with the knees soft, not locked.',
    ARRAY['bodyweight', 'no-equipment', 'low-impact', 'plyometric']::text[],
    '{"demand_rank": {"jump": 70}, "slot_patterns": ["jump"]}'::jsonb,
    null, 'approved'
  ),
  (
    'bent-knee-calf-raise', 'Bent-Knee Calf Raise', 'strength', null, 'calves', '{}'::text[],
    'bodyweight', 'beginner',
    'A calf raise performed with the knees bent throughout — bending the knee slackens the gastrocnemius (which crosses the knee) and shifts the load onto the soleus underneath it, the standard no-equipment way to bias soleus work.',
    'Stand with knees bent about 30-45 degrees throughout (like a mini wall-sit position), holding onto something stable for balance if needed.',
    'Keeping the knee bend constant, rise onto the balls of the feet as high as possible, then lower under control back to the start.',
    'Exhale as you rise; inhale as you lower.',
    'Finish with the heels down and the knee bend held, not straightened.',
    ARRAY['bodyweight', 'no-equipment', 'calf-focus', 'accessory']::text[],
    '{"demand_rank": {"calf_soleus": 30}, "slot_patterns": ["calf_soleus"]}'::jsonb,
    null, 'approved'
  ),
  (
    'clamshell', 'Clamshell', 'strength', null, 'glutes', '{}'::text[],
    'bodyweight', 'beginner',
    'The standard no-equipment hip abduction exercise — small, controlled, and reliably felt in the glute even without a band.',
    'Lie on your side with knees bent about 90 degrees, hips stacked, feet together.',
    'Keeping the feet touching, rotate the top knee open toward the ceiling using the hip, then lower under control back to the start without letting the hips roll backward.',
    'Exhale as you open the knee; inhale as you lower.',
    'Finish with the knees together and the hips still stacked, not rolled back.',
    ARRAY['bodyweight', 'no-equipment', 'hip-abduction', 'accessory']::text[],
    '{"demand_rank": {"hip_abduction": 40}, "slot_patterns": ["hip_abduction"]}'::jsonb,
    null, 'approved'
  ),
  (
    'manual-resistance-external-rotation', 'Manual Resistance Shoulder External Rotation', 'strength', null, 'shoulders', '{}'::text[],
    'bodyweight', 'beginner',
    'A no-equipment shoulder external rotation using your own opposite hand for resistance — same self-resistance mechanism as the manual-resistance neck and biceps exercises, for exactly the same reason: no band or cable available.',
    'Stand or sit with the working elbow tucked against the ribs, bent 90 degrees, forearm across the stomach; the opposite hand grips the working wrist to resist the motion.',
    'Rotate the working forearm outward against the resisting hand''s steady, moderate pressure, then reverse the resistance to return under control.',
    'Breathe steadily throughout rather than holding your breath.',
    'Finish with the elbow still tucked to the ribs and both hands relaxed before switching sides.',
    ARRAY['bodyweight', 'no-equipment', 'shoulder-health', 'accessory']::text[],
    '{"demand_rank": {"shoulder_external_rotation": 40}, "slot_patterns": ["shoulder_external_rotation"]}'::jsonb,
    null, 'approved'
  )
on conflict (id) do nothing;
