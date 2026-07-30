-- Task #26: seed the generator's movement-pattern/demand/injury metadata onto
-- the real Exercise Library. Every row in `exercises` currently has
-- `metadata: {}` — patterns.ts's ladders, resolveSlotPatterns() and
-- contraindications() are fully built and tested, but nothing in the library
-- has ever been tagged, so exercise selection (task #14) would currently have
-- nothing to select from.
--
-- SCOPE: strength, olympic_lifting and plyometrics categories only. cardio,
-- mobility, running and stretching exercises aren't consumed through the
-- slot-pattern ladder mechanism by any template built so far — running- and
-- cardio-templates.ts synthesize prescriptions directly (movementPattern is
-- always null on those slots) rather than selecting a library row — so
-- tagging them now would be speculative. Revisit when a template needs to
-- pick a specific row for one of those categories.
--
-- Six exercises in scope are deliberately left untouched: cable-chest-fly,
-- dumbbell-chest-fly, cable-lateral-raise, dumbbell-lateral-raise and
-- straight-arm-pulldown are isolation accessories with no Appendix C ladder
-- to sit on — they stay selectable later via primary_muscle_group matching,
-- not the pattern ladder. killer-crocs is an archived, coach-owned custom
-- exercise (is_archived = true) and irrelevant to seeding.
--
-- WHY SOME ROWS GET AN EXPLICIT EMPTY slot_patterns ARRAY
-- ---------------------------------------------------------
-- resolveSlotPatterns() only falls back to column-based inference when the
-- `slot_patterns` key is *absent*. Several exercises here would be wrongly
-- inferred if left untagged, because the library's coarse movement_pattern
-- column collapses distinctions Appendix C needs:
--   - snatch, clean-and-jerk, hang-clean, power-clean, clean-pull: §6/§7 put
--     the two full competition lifts (snatch, clean-and-jerk) outside the
--     automated path entirely, with no coaching claim able to unlock them.
--     Their movement_pattern is "pull", which inferSlotPatterns already
--     returns [] for — so this is belt-and-suspenders, not load-bearing, but
--     it makes the exclusion an explicit fact in the data rather than an
--     accident of what "pull" happens to infer to today. hang-clean,
--     power-clean and clean-pull are §6's "allowed but not default" middle
--     ground: excluded from the pattern-ladder system the same way, but
--     flagged requires_lift_coaching = true as forward-looking metadata for
--     whichever future template (#22) chooses to query olympic_lifting
--     exercises directly rather than through ladderFor().
--   - depth-jump: movement_pattern = "jump" WOULD infer ["jump"] and become
--     selectable for plyometric work — exactly what §6 excludes ("needs a
--     coach in the room"). This one is load-bearing: without the explicit
--     empty array, depth-jump is wrongly selectable.
--   - cable-crunch, weighted-sit-up: movement_pattern = "anti_rotation" in
--     the library (like plank/side-plank/dead-bug/hanging-knee-raise), which
--     would wrongly infer ["anti_rotation"]. These two are repeated,
--     loaded spinal *flexion* — a different animal from Appendix C's
--     anti-extension/anti-rotation bracing ladders — so they get no
--     slot_pattern at all (no ladder fits) plus a lower_back_flexion_intolerant
--     flag, rather than being left to the wrong inferred ladder.
--
-- WHY THE OTHER four anti_rotation-column EXERCISES GET EXPLICIT, DIFFERENT TAGS
-- --------------------------------------------------------------------------------
-- plank, dead-bug and hanging-knee-raise are isometric/bracing anti-extension
-- work, not anti-rotation — tagged anti_extension. side-plank is Appendix C's
-- explicit bottom rung of the carry/anti-lateral-flexion ladder — tagged
-- carry, not anti_extension or anti_rotation. bird-dog is genuinely the one
-- anti_rotation-pattern exercise the library has (a one-item ladder, since
-- landmine rotation and Pallof press don't exist yet as rows).
--
-- WHY squat/hinge UNILATERAL EXERCISES ALSO NEED EXPLICIT TAGS
-- ----------------------------------------------------------------
-- bulgarian-split-squat, dumbbell-lunge and walking-lunge are tagged `squat`
-- + `quadriceps` in the column, which would infer squat_bilateral — wrong,
-- per patterns.ts's own header comment. jump-squat is also column-tagged
-- `squat`, but is really §6's loaded jump-squat power work, tagged `jump`
-- here instead of either squat ladder.
--
-- KNOWN GAPS, NOT FIXED HERE
-- ----------------------------
-- No exercise in the library covers hip_abduction, hip_adduction,
-- calf_gastroc, calf_soleus, shoulder_external_rotation or isometric_tendon
-- (no cable hip abduction, no Copenhagen adduction, no calf raise, no
-- band external rotation, no isometric hold row exists yet) — those ladders
-- will be empty until someone adds the exercises. leg_curl_machine is the
-- only knee_flexion exercise (no Nordic curl, no GHR, no slider curl exist
-- yet either), so §8's "not just squats and deadlifts" requirement has
-- exactly one option to draw from for now.
update public.exercises as e
set metadata = e.metadata || v.metadata_patch::jsonb
from (values
  -- olympic_lifting
  ('clean-and-jerk', '{"slot_patterns":[]}'),
  ('clean-pull', '{"slot_patterns":[],"requires_lift_coaching":true}'),
  ('hang-clean', '{"slot_patterns":[],"requires_lift_coaching":true}'),
  ('power-clean', '{"slot_patterns":[],"requires_lift_coaching":true}'),
  ('push-press', '{"slot_patterns":["vertical_push"],"demand_rank":{"vertical_push":5}}'),
  ('snatch', '{"slot_patterns":[]}'),

  -- plyometrics
  ('box-jump', '{"slot_patterns":["jump"],"demand_rank":{"jump":20},"injury_contraindications":["knee_anterior_patellar"]}'),
  ('broad-jump', '{"slot_patterns":["jump"],"demand_rank":{"jump":10},"injury_contraindications":["knee_anterior_patellar"]}'),
  ('depth-jump', '{"slot_patterns":[]}'),
  ('lateral-bound', '{"slot_patterns":["jump"],"demand_rank":{"jump":15},"injury_contraindications":["knee_anterior_patellar"]}'),
  ('medicine-ball-slam', '{"slot_patterns":["throw"],"demand_rank":{"throw":10}}'),
  ('plyo-push-up', '{"injury_contraindications":["wrist"]}'),
  ('tuck-jump', '{"slot_patterns":["jump"],"demand_rank":{"jump":25},"injury_contraindications":["knee_anterior_patellar"]}'),

  -- strength — vertical pull
  ('assisted-pull-up-machine', '{"slot_patterns":["vertical_pull"],"demand_rank":{"vertical_pull":30}}'),
  ('chin-up', '{"slot_patterns":["vertical_pull"],"demand_rank":{"vertical_pull":15}}'),
  ('lat-pulldown', '{"slot_patterns":["vertical_pull"],"demand_rank":{"vertical_pull":40}}'),
  ('pull-up', '{"slot_patterns":["vertical_pull"],"demand_rank":{"vertical_pull":10}}'),

  -- strength — horizontal pull
  ('barbell-row', '{"slot_patterns":["horizontal_pull"],"demand_rank":{"horizontal_pull":10}}'),
  ('chest-supported-row-machine', '{"slot_patterns":["horizontal_pull"],"demand_rank":{"horizontal_pull":25}}'),
  ('dumbbell-pullover', '{"slot_patterns":["horizontal_pull"],"demand_rank":{"horizontal_pull":55},"injury_contraindications":["shoulder"]}'),
  ('dumbbell-renegade-row', '{"slot_patterns":["horizontal_pull","anti_rotation"],"demand_rank":{"horizontal_pull":15,"anti_rotation":20}}'),
  ('dumbbell-row', '{"slot_patterns":["horizontal_pull"],"demand_rank":{"horizontal_pull":30}}'),
  ('inverted-row', '{"slot_patterns":["horizontal_pull"],"demand_rank":{"horizontal_pull":40}}'),
  ('rear-delt-fly-machine', '{"slot_patterns":["horizontal_pull"],"demand_rank":{"horizontal_pull":60}}'),
  ('seated-cable-row', '{"slot_patterns":["horizontal_pull"],"demand_rank":{"horizontal_pull":35}}'),

  -- strength — scapular control
  ('band-pull-apart', '{"slot_patterns":["scapular_control"],"demand_rank":{"scapular_control":10}}'),

  -- strength — horizontal push
  ('barbell-bench-press', '{"slot_patterns":["horizontal_push"],"demand_rank":{"horizontal_push":10},"injury_contraindications":["wrist"]}'),
  ('chest-press-machine', '{"slot_patterns":["horizontal_push"],"demand_rank":{"horizontal_push":30}}'),
  ('decline-push-up', '{"slot_patterns":["horizontal_push"],"demand_rank":{"horizontal_push":35},"injury_contraindications":["wrist"]}'),
  ('dumbbell-bench-press', '{"slot_patterns":["horizontal_push"],"demand_rank":{"horizontal_push":20}}'),
  ('dumbbell-floor-press', '{"slot_patterns":["horizontal_push"],"demand_rank":{"horizontal_push":25}}'),
  ('incline-push-up', '{"slot_patterns":["horizontal_push"],"demand_rank":{"horizontal_push":50}}'),
  ('push-up', '{"slot_patterns":["horizontal_push"],"demand_rank":{"horizontal_push":40},"injury_contraindications":["wrist"]}'),

  -- strength — vertical push
  ('barbell-overhead-press', '{"slot_patterns":["vertical_push"],"demand_rank":{"vertical_push":10},"injury_contraindications":["shoulder","lower_back_extension_intolerant","wrist"]}'),
  ('dumbbell-arnold-press', '{"slot_patterns":["vertical_push"],"demand_rank":{"vertical_push":25},"injury_contraindications":["shoulder"]}'),
  ('dumbbell-shoulder-press', '{"slot_patterns":["vertical_push"],"demand_rank":{"vertical_push":30}}'),
  ('machine-shoulder-press', '{"slot_patterns":["vertical_push"],"demand_rank":{"vertical_push":35}}'),
  ('pike-push-up', '{"slot_patterns":["vertical_push"],"demand_rank":{"vertical_push":40}}'),

  -- strength — squat, bilateral
  ('barbell-back-squat', '{"slot_patterns":["squat_bilateral"],"demand_rank":{"squat_bilateral":10},"injury_contraindications":["knee_meniscal_joint_line","hip_anterior_groin"]}'),
  ('barbell-front-squat', '{"slot_patterns":["squat_bilateral"],"demand_rank":{"squat_bilateral":15},"injury_contraindications":["knee_meniscal_joint_line","hip_anterior_groin","wrist"]}'),
  ('leg-press', '{"slot_patterns":["squat_bilateral"],"demand_rank":{"squat_bilateral":30}}'),
  ('goblet-squat', '{"slot_patterns":["squat_bilateral"],"demand_rank":{"squat_bilateral":40}}'),
  ('bodyweight-squat', '{"slot_patterns":["squat_bilateral"],"demand_rank":{"squat_bilateral":60}}'),

  -- strength — squat, unilateral (column-tagged `squat`, would wrongly infer bilateral)
  ('bulgarian-split-squat', '{"slot_patterns":["squat_unilateral"],"demand_rank":{"squat_unilateral":10},"injury_contraindications":["knee_meniscal_joint_line","hip_anterior_groin"]}'),
  ('dumbbell-lunge', '{"slot_patterns":["squat_unilateral"],"demand_rank":{"squat_unilateral":20}}'),
  ('walking-lunge', '{"slot_patterns":["squat_unilateral"],"demand_rank":{"squat_unilateral":30}}'),

  -- strength — loaded jump squat (column-tagged `squat`; really §6 power work)
  ('jump-squat', '{"slot_patterns":["jump"],"demand_rank":{"jump":5},"injury_contraindications":["knee_anterior_patellar"]}'),
  ('leg-extension', '{"injury_contraindications":["knee_anterior_patellar"]}'),

  -- strength — hinge, bilateral (movement_pattern "hinge" never infers; all need tagging)
  ('barbell-deadlift', '{"slot_patterns":["hinge_bilateral"],"demand_rank":{"hinge_bilateral":10},"injury_contraindications":["lower_back_flexion_intolerant"]}'),
  ('barbell-good-morning', '{"slot_patterns":["hinge_bilateral"],"demand_rank":{"hinge_bilateral":15},"injury_contraindications":["lower_back_flexion_intolerant","hip_posterior_hamstring"]}'),
  ('barbell-rdl', '{"slot_patterns":["hinge_bilateral"],"demand_rank":{"hinge_bilateral":20},"injury_contraindications":["hip_posterior_hamstring"]}'),
  ('dumbbell-swing', '{"slot_patterns":["hinge_bilateral"],"demand_rank":{"hinge_bilateral":30}}'),
  ('dumbbell-rdl', '{"slot_patterns":["hinge_bilateral"],"demand_rank":{"hinge_bilateral":40},"injury_contraindications":["hip_posterior_hamstring"]}'),
  ('dumbbell-hip-thrust', '{"slot_patterns":["hinge_bilateral"],"demand_rank":{"hinge_bilateral":50}}'),
  ('glute-bridge', '{"slot_patterns":["hinge_bilateral"],"demand_rank":{"hinge_bilateral":60}}'),

  -- strength — hinge, unilateral
  ('single-leg-rdl-bodyweight', '{"slot_patterns":["hinge_unilateral"],"demand_rank":{"hinge_unilateral":20},"injury_contraindications":["hip_posterior_hamstring"]}'),
  ('single-leg-glute-bridge', '{"slot_patterns":["hinge_unilateral"],"demand_rank":{"hinge_unilateral":40}}'),

  -- strength — knee flexion (only entry the library has; see gap note above)
  ('leg-curl-machine', '{"slot_patterns":["knee_flexion"],"demand_rank":{"knee_flexion":40}}'),

  -- strength — carry / anti-lateral-flexion
  ('farmers-carry', '{"slot_patterns":["carry"],"demand_rank":{"carry":10}}'),
  ('suitcase-carry', '{"slot_patterns":["carry"],"demand_rank":{"carry":20}}'),
  ('waiters-carry', '{"slot_patterns":["carry"],"demand_rank":{"carry":30}}'),
  ('side-plank', '{"slot_patterns":["carry"],"demand_rank":{"carry":50}}'),

  -- strength — anti-extension / anti-rotation (column-tagged `anti_rotation` for all; see notes above)
  ('bird-dog', '{"slot_patterns":["anti_rotation"],"demand_rank":{"anti_rotation":30}}'),
  ('hanging-knee-raise', '{"slot_patterns":["anti_extension"],"demand_rank":{"anti_extension":20}}'),
  ('dead-bug', '{"slot_patterns":["anti_extension"],"demand_rank":{"anti_extension":30}}'),
  ('plank', '{"slot_patterns":["anti_extension"],"demand_rank":{"anti_extension":40}}'),
  ('cable-crunch', '{"slot_patterns":[],"injury_contraindications":["lower_back_flexion_intolerant"]}'),
  ('weighted-sit-up', '{"slot_patterns":[],"injury_contraindications":["lower_back_flexion_intolerant"]}'),

  -- strength — rotational power (column-tagged `rotation`, which never infers)
  ('weighted-russian-twist', '{"slot_patterns":["rotational_power"],"demand_rank":{"rotational_power":50}}'),
  ('russian-twist', '{"slot_patterns":["rotational_power"],"demand_rank":{"rotational_power":60}}'),

  -- strength — no clean ladder fit, injury-flagged only
  ('kettlebell-turkish-get-up', '{"injury_contraindications":["shoulder"]}')
) as v(id, metadata_patch)
where e.id = v.id;
