-- Closes the calf_gastroc/calf_soleus gap migration 0045 documented and
-- explicitly left unfixed ("no calf raise ... exists yet — those ladders
-- will be empty until someone adds the exercises"). Confirmed live: zero
-- rows in `exercises` are tagged for either calf pattern, and there isn't
-- even an untagged calf raise to tag — the generator's "no exercise
-- available for main slot (calf_soleus)" warning on a Full Body template
-- is this exact gap surfacing correctly, not a bug in the selection code.
--
-- Two new global (owner_id null) exercises, one per calf pattern, same
-- anatomical split patterns.ts's own header comment already draws for why
-- these are two different SlotPatterns rather than one: knee extended
-- (standing) biases the gastrocnemius, which crosses the knee; knee bent
-- (seated) takes the gastrocnemius out of a shortened, weaker position and
-- shifts the demand onto the soleus underneath it.
--
-- Seeded as review_status = 'approved' explicitly — 0038's column default
-- is 'pending', and its own backfill only covered rows that existed at
-- that migration's run time, not future inserts. Left at the default here
-- would make selectFromLadder's selectableExercisePool silently filter
-- these back out, recreating the exact bug this migration exists to fix.
--
-- Run this once in the Supabase SQL Editor, after 0047. Safe to re-run —
-- the insert is ON CONFLICT DO NOTHING.

insert into public.exercises (
  id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups,
  equipment, difficulty, description,
  instructions_setup, instructions_execution, instructions_breathing, instructions_finishing,
  tags, metadata, owner_id, review_status
) values
  (
    'standing-calf-raise', 'Standing Calf Raise', 'strength', null, 'calves', '{}'::text[],
    'bodyweight', 'beginner',
    'A straight-leg calf raise performed standing, which keeps the knee extended so the gastrocnemius does most of the work.',
    'Stand with the balls of the feet on a raised edge or flat ground, knees straight but not locked, holding a wall or rail for balance if needed.',
    'Rise up onto the toes as high as possible by driving through the balls of the feet, pause briefly at the top, then lower under control until you feel a stretch through the calf.',
    'Exhale as you rise onto the toes; inhale as you lower back down.',
    'Finish with the heels back on the ground and weight balanced evenly across both feet.',
    ARRAY['bodyweight', 'calf-focus', 'isolation', 'accessory']::text[],
    '{"slot_patterns":["calf_gastroc"],"demand_rank":{"calf_gastroc":10}}'::jsonb,
    null, 'approved'
  ),
  (
    'seated-calf-raise', 'Seated Calf Raise', 'strength', null, 'calves', '{}'::text[],
    'machine', 'beginner',
    'A calf raise performed seated with the knees bent, which shifts the demand from the gastrocnemius onto the soleus underneath it.',
    'Sit at the machine with the balls of the feet on the platform and the knee pad resting just above the knees.',
    'Rise up onto the toes as high as possible by driving through the balls of the feet, pause briefly at the top, then lower under control until you feel a stretch through the lower calf.',
    'Exhale as you rise onto the toes; inhale as you lower back down.',
    'Finish with the heels back at the bottom of the range and the knees still bent under the pad.',
    ARRAY['machine', 'calf-focus', 'isolation', 'accessory']::text[],
    '{"slot_patterns":["calf_soleus"],"demand_rank":{"calf_soleus":10}}'::jsonb,
    null, 'approved'
  )
on conflict (id) do nothing;
