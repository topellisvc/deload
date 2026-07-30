-- Closes the rest of the gaps flagged alongside 0048's calf raises:
-- hip_abduction and hip_adduction (unconditional accessory slots in every
-- lower_a/lower_b/legs day split — splits.ts — so these fire far more
-- often than the calf gap did), shoulder_external_rotation (same story for
-- upper_b/pull day splits), neck (sport-specific-templates.ts's combat
-- grappling/striking groups), isometric_tendon (§10's tendon-pain
-- protocol, not yet requested by any template but seeded now for
-- consistency with the rest of this pattern vocabulary), and a second
-- knee_flexion option (Leg Curl Machine was the only one; patterns.ts's
-- own header comment names "leg curl, Nordic, slider" as the three
-- reference options, so Nordic Hamstring Curl is the obvious second entry).
--
-- Two exercises per gap (three for isometric_tendon, one per named
-- presentation — patellar, gluteal, elbow) so each ladder has real
-- most-to-least-demanding structure rather than a single forced pick, the
-- same reasoning 0048's header gives for splitting calf work into two
-- patterns in the first place.
--
-- All seeded as review_status = 'approved' explicitly (see 0048's header
-- on why the column default of 'pending' would otherwise silently exclude
-- these from selection).
--
-- Run this once in the Supabase SQL Editor, after 0048. Safe to re-run —
-- the insert is ON CONFLICT DO NOTHING.

insert into public.exercises (
  id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups,
  equipment, difficulty, description,
  instructions_setup, instructions_execution, instructions_breathing, instructions_finishing,
  tags, metadata, owner_id, review_status
) values
  -- hip_abduction
  (
    'band-lateral-walk', 'Band Lateral Walk', 'strength', null, 'glutes', '{}'::text[],
    'resistance_band', 'beginner',
    'A standing hip-abduction drill using a loop band around the ankles or knees — trains the glute medius to control the hip sideways, a common weak link behind knee and lower-back issues.',
    'Set up with a loop resistance band around the ankles (or just above the knees for an easier version), feet hip-width apart, knees slightly bent, hips hinged slightly forward.',
    'Keeping tension on the band throughout, step sideways with one foot, then bring the trailing foot in only partway so the band never goes slack, continuing for the prescribed distance or reps before switching direction.',
    'Breathe naturally throughout — this is a continuous, low-intensity movement rather than a heavy single-effort lift.',
    'Finish standing with feet back under the hips and tension released from the band.',
    ARRAY['resistance_band', 'glute-focus', 'hip-abduction', 'accessory']::text[],
    '{"slot_patterns":["hip_abduction"],"demand_rank":{"hip_abduction":30}}'::jsonb,
    null, 'approved'
  ),
  (
    'cable-hip-abduction', 'Cable Hip Abduction', 'strength', null, 'glutes', '{}'::text[],
    'cable', 'beginner',
    'A cable-based isolation movement that abducts the hip against resistance — lets you load the glute medius directly and progressively, unlike a band.',
    'Set up with an ankle cuff attached to a low cable pulley, cuff around the working ankle, standing side-on to the machine and holding the frame for balance.',
    'Keeping the leg straight and the torso still, sweep the working leg out and away from the machine as far as comfortably possible, then return under control to the starting position.',
    'Exhale as you sweep the leg out; inhale as you return it.',
    'Finish with the working foot back next to the standing foot and the cable under control, not slack.',
    ARRAY['cable', 'glute-focus', 'hip-abduction', 'isolation', 'accessory']::text[],
    '{"slot_patterns":["hip_abduction"],"demand_rank":{"hip_abduction":10}}'::jsonb,
    null, 'approved'
  ),

  -- hip_adduction
  (
    'cable-hip-adduction', 'Cable Hip Adduction', 'strength', null, 'glutes', '{}'::text[],
    'cable', 'beginner',
    'A cable-based isolation movement that adducts the hip against resistance, directly targeting the inner-thigh adductors that squats and hinges barely touch.',
    'Set up with an ankle cuff attached to a low cable pulley positioned out to the side, cuff around the working ankle, standing side-on to the machine so the working leg starts out away from the body.',
    'Keeping the leg straight and the torso still, sweep the working leg across the front of the body toward and past the standing leg, then return under control to the starting position.',
    'Exhale as you sweep the leg across; inhale as you return it.',
    'Finish with the working foot back out at the starting position and the cable under control, not slack.',
    ARRAY['cable', 'adductor-focus', 'hip-adduction', 'isolation', 'accessory']::text[],
    '{"slot_patterns":["hip_adduction"],"demand_rank":{"hip_adduction":20}}'::jsonb,
    null, 'approved'
  ),
  (
    'copenhagen-plank', 'Copenhagen Plank', 'strength', null, 'glutes', '{}'::text[],
    'bodyweight', 'advanced',
    'A side-plank variation with the top leg supported on a bench, widely used to build adductor strength and protect against groin strains — genuinely demanding, and usually built up to from an easier adductor exercise first.',
    'Set up lying on your side, forearm on the floor under the shoulder, top leg resting on a bench with the shin or ankle supported, bottom leg free.',
    'Brace and lift the hips off the floor into a straight line from shoulder to ankle, driving through the supported top leg''s inner thigh, and hold the position for the prescribed time.',
    'Breathe steadily through the hold rather than holding your breath — this is a sustained isometric effort.',
    'Finish by lowering the hips back to the floor under control rather than dropping.',
    ARRAY['bodyweight', 'adductor-focus', 'hip-adduction', 'advanced', 'groin-prevention']::text[],
    '{"slot_patterns":["hip_adduction"],"demand_rank":{"hip_adduction":5}}'::jsonb,
    null, 'approved'
  ),

  -- shoulder_external_rotation
  (
    'band-external-rotation', 'Band External Rotation', 'strength', null, 'shoulders', '{}'::text[],
    'resistance_band', 'beginner',
    'A light, band-resisted rotator-cuff exercise — §10''s own first-line shoulder prophylaxis work, meant to be done for higher reps at low effort rather than trained heavy.',
    'Set up standing side-on to a band anchored at elbow height, elbow tucked against the ribs and bent to 90 degrees, forearm across the stomach holding the band.',
    'Keeping the elbow pinned to the ribs the entire rep, rotate the forearm outward and away from the body, then return under control to the starting position.',
    'Exhale as you rotate outward; inhale as you return.',
    'Finish with the forearm back across the stomach and the elbow still tucked against the ribs.',
    ARRAY['resistance_band', 'rotator-cuff', 'shoulder-prophylaxis', 'accessory']::text[],
    '{"slot_patterns":["shoulder_external_rotation"],"demand_rank":{"shoulder_external_rotation":30}}'::jsonb,
    null, 'approved'
  ),
  (
    'cable-external-rotation', 'Cable External Rotation', 'strength', null, 'shoulders', '{}'::text[],
    'cable', 'intermediate',
    'The same rotator-cuff pattern as the band version, performed on a cable for more consistent, progressive loading.',
    'Set up standing side-on to a low cable pulley, elbow tucked against the ribs and bent to 90 degrees, forearm across the stomach holding the handle.',
    'Keeping the elbow pinned to the ribs the entire rep, rotate the forearm outward and away from the body, then return under control to the starting position.',
    'Exhale as you rotate outward; inhale as you return.',
    'Finish with the forearm back across the stomach and the elbow still tucked against the ribs.',
    ARRAY['cable', 'rotator-cuff', 'shoulder-prophylaxis', 'accessory']::text[],
    '{"slot_patterns":["shoulder_external_rotation"],"demand_rank":{"shoulder_external_rotation":15}}'::jsonb,
    null, 'approved'
  ),

  -- neck
  (
    'neck-harness-extension', 'Neck Harness Extension', 'strength', null, 'full_body', '{}'::text[],
    'machine', 'intermediate',
    'A weighted neck-extension movement using a harness, most associated with combat and contact sports where a strong neck is protective.',
    'Set up wearing a neck harness with a light weight plate attached, hands and knees on the floor (or standing bent at the hips), neck in a neutral, chin-tucked position.',
    'Extend the neck back and up against the harness''s resistance through a comfortable range, then return under control to the starting position.',
    'Exhale as you extend; inhale as you return.',
    'Finish with the neck back in a neutral position and no tension held in the traps or shoulders.',
    ARRAY['machine', 'neck-focus', 'combat-sport', 'accessory']::text[],
    '{"slot_patterns":["neck"],"demand_rank":{"neck":10}}'::jsonb,
    null, 'approved'
  ),
  (
    'manual-resistance-neck-flexion', 'Manual Resistance Neck Flexion', 'strength', null, 'full_body', '{}'::text[],
    'bodyweight', 'beginner',
    'A no-equipment neck exercise using your own hand for resistance — accessible anywhere, and enough to build meaningful neck strength for combat sports without a harness.',
    'Set up seated or standing, one or both hands pressed flat against the forehead, neck in a neutral starting position.',
    'Push the head forward into the hands while the hands resist the motion, holding a steady, moderate effort for the prescribed time, then relax.',
    'Breathe steadily throughout rather than holding your breath.',
    'Finish by relaxing the hands and letting the neck return to a fully neutral position.',
    ARRAY['bodyweight', 'neck-focus', 'combat-sport', 'no-equipment', 'accessory']::text[],
    '{"slot_patterns":["neck"],"demand_rank":{"neck":30}}'::jsonb,
    null, 'approved'
  ),

  -- isometric_tendon (§10: patellar, gluteal, elbow presentations)
  (
    'isometric-wall-sit', 'Isometric Wall Sit', 'strength', null, 'quadriceps', '{}'::text[],
    'bodyweight', 'beginner',
    'A static knee-flexion hold against a wall — §10''s first-line load for painful patellar tendons, meant to be held rather than repped.',
    'Set up with your back against a wall, feet shoulder-width apart and out far enough that the knees sit at roughly 90 degrees when you sink down.',
    'Slide down the wall into the seated hold position and stay there for the prescribed time, keeping the lower back flat against the wall.',
    'Breathe steadily through the hold rather than holding your breath — this is a sustained isometric effort, not a heavy single lift.',
    'Finish by sliding back up the wall to standing rather than dropping out of the hold.',
    ARRAY['bodyweight', 'isometric', 'patellar-tendon', 'tendon-rehab']::text[],
    '{"slot_patterns":["isometric_tendon"],"demand_rank":{"isometric_tendon":20}}'::jsonb,
    null, 'approved'
  ),
  (
    'isometric-single-leg-glute-bridge-hold', 'Isometric Single-Leg Glute Bridge Hold', 'strength', null, 'glutes', '{}'::text[],
    'bodyweight', 'beginner',
    'A held, single-leg version of the glute bridge — §10''s first-line load for painful gluteal tendons, at the top position rather than through repeated reps.',
    'Set up lying on your back, one foot flat on the floor, the other leg extended straight or held at the chest.',
    'Drive through the planted heel to lift the hips into a bridge and hold at the top for the prescribed time, keeping the hips level.',
    'Breathe steadily through the hold rather than holding your breath.',
    'Finish by lowering the hips back to the floor under control.',
    ARRAY['bodyweight', 'isometric', 'glute-tendon', 'tendon-rehab']::text[],
    '{"slot_patterns":["isometric_tendon"],"demand_rank":{"isometric_tendon":25}}'::jsonb,
    null, 'approved'
  ),
  (
    'isometric-wrist-extension-hold', 'Isometric Wrist Extension Hold', 'strength', null, 'forearms', '{}'::text[],
    'dumbbell', 'beginner',
    'A held wrist-extension position under light load — §10''s first-line load for painful elbow (tennis elbow) tendons.',
    'Set up seated, forearm resting on a table or your thigh with the wrist hanging off the edge, a light dumbbell held with an overhand grip.',
    'Extend the wrist up to a comfortable end-range position and hold there for the prescribed time, resisting the dumbbell''s pull downward.',
    'Breathe steadily through the hold rather than holding your breath.',
    'Finish by lowering the wrist back to neutral under control.',
    ARRAY['dumbbell', 'isometric', 'elbow-tendon', 'tendon-rehab']::text[],
    '{"slot_patterns":["isometric_tendon"],"demand_rank":{"isometric_tendon":30}}'::jsonb,
    null, 'approved'
  ),

  -- knee_flexion (second option — leg-curl-machine was the only one)
  (
    'nordic-hamstring-curl', 'Nordic Hamstring Curl', 'strength', null, 'hamstrings', '{}'::text[],
    'bodyweight', 'advanced',
    'A bodyweight, eccentric-emphasis hamstring curl — the single most evidence-backed exercise for hamstring and knee-flexion strength, and genuinely demanding even for trained athletes.',
    'Set up kneeling with the ankles firmly anchored (a partner holding them, or a Nordic curl bench), torso tall and braced from the knees up.',
    'Lower the torso forward as slowly as possible by resisting with the hamstrings, catching yourself with your hands just before the chest reaches the floor, then push back to the starting kneeling position however you can.',
    'Inhale as you lower; exhale as you push back up.',
    'Finish back in the tall kneeling starting position.',
    ARRAY['bodyweight', 'advanced', 'hamstring-focus', 'eccentric', 'knee-flexion']::text[],
    '{"slot_patterns":["knee_flexion"],"demand_rank":{"knee_flexion":15}}'::jsonb,
    null, 'approved'
  )
on conflict (id) do nothing;
