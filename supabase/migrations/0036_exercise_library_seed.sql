-- Seeds the Exercise Library with 100 exercises spanning every category in
-- the spec (strength, running, cardio, mobility, stretching, plyometrics,
-- olympic_lifting). The 62 strength exercises reuse the exact ids from
-- lib/workout-generator/exercises.ts (see 0035's header comment) so every
-- existing program's block_exercises.exercise_id keeps resolving with zero
-- data migration. All seeded here as global (owner_id null) exercises,
-- selectable by any coach in the Program Builder's exercise picker.
--
-- Generated from a structured dataset rather than hand-typed SQL — see the
-- session's working notes if this ever needs regenerating/extending.
--
-- Run this once in the Supabase SQL Editor, after 0035. Safe to re-run —
-- every insert is ON CONFLICT DO NOTHING.

-- ============================================================
-- exercises
-- ============================================================

insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('bodyweight-squat', 'Bodyweight Squat', 'strength', 'squat', 'quadriceps', ARRAY['glutes','hamstrings']::text[], 'bodyweight', 'beginner', 'A foundational squat pattern using only body weight — the entry point for building squat mechanics before adding load.', 'Set up with feet shoulder-width apart, toes turned out slightly, arms extended forward for balance.', 'Sit back and down by bending the hips and knees together, keeping the chest up and the spine neutral, until the thighs are at least parallel to the floor. Drive through the whole foot, weighting the heels and midfoot to stand back up, finishing with hips fully extended.', 'Take a full breath and brace the core before descending; hold that brace through the bottom and exhale as you pass the hardest part of the ascent.', 'Finish standing tall with knees locked out softly and hips fully open, weight balanced over the middle of the foot.', ARRAY['bodyweight','beginner-friendly','warm-up','foundational']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('jump-squat', 'Jump Squat', 'strength', 'squat', 'quadriceps', ARRAY['glutes','calves']::text[], 'bodyweight', 'intermediate', 'An explosive variation of the bodyweight squat that trains lower-body power output.', 'Set up with feet shoulder-width apart, arms relaxed at the sides ready to swing.', 'Sit back and down by bending the hips and knees together, keeping the chest up, until the thighs are roughly parallel to the floor. Drive through the whole foot, exploding upward through the hips, knees and ankles to stand back up, finishing with hips fully extended.', 'Take a full breath and brace the core before descending; hold that brace through the bottom and exhale as you pass the hardest part of the ascent.', 'Finish standing tall with knees locked out softly and hips fully open, weight balanced over the middle of the foot.', ARRAY['plyometric','power','bodyweight','explosive']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('bulgarian-split-squat', 'Bulgarian Split Squat', 'strength', 'squat', 'quadriceps', ARRAY['glutes']::text[], 'bodyweight', 'intermediate', 'A single-leg squat variation with the rear foot elevated behind you, exposing and correcting side-to-side strength imbalances.', 'Set up with the rear foot resting laces-down on a bench behind you, front foot far enough forward that the knee stays over the ankle.', 'Sit back and down by bending the hips and knees together, keeping the torso mostly upright with a slight forward lean, until the rear knee nearly touches the floor. Drive through the front foot, pushing straight up to stand back up, finishing with hips fully extended.', 'Take a full breath and brace the core before descending; hold that brace through the bottom and exhale as you pass the hardest part of the ascent.', 'Finish standing tall with knees locked out softly and hips fully open, weight balanced over the middle of the foot.', ARRAY['unilateral','single-leg','glutes','accessory']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('walking-lunge', 'Walking Lunge', 'strength', 'squat', 'quadriceps', ARRAY['glutes','hamstrings']::text[], 'bodyweight', 'beginner', 'A traveling single-leg squat pattern that builds unilateral strength and hip control step by step.', 'Set up with feet hip-width apart, hands on hips or holding light weights at the sides.', 'Sit back and down by bending the hips and knees together, keeping a tall, upright torso, until the rear knee lightly grazes the floor. Drive through the front foot, pushing through the heel to step into the next rep to stand back up, finishing with hips fully extended.', 'Take a full breath and brace the core before descending; hold that brace through the bottom and exhale as you pass the hardest part of the ascent.', 'Finish standing tall with knees locked out softly and hips fully open, weight balanced over the middle of the foot.', ARRAY['unilateral','bodyweight','warm-up','dynamic']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('goblet-squat', 'Goblet Squat', 'strength', 'squat', 'quadriceps', ARRAY['glutes','core']::text[], 'dumbbell', 'beginner', 'A front-loaded squat holding a single dumbbell at the chest — one of the most reliable ways to teach and clean up squat mechanics.', 'Set up with feet just outside shoulder-width, holding one dumbbell vertically against the chest with both hands.', 'Sit back and down by bending the hips and knees together, keeping an upright torso, using the dumbbell''s position to keep you honest, until the elbows touch the insides of the knees at the bottom. Drive through the whole foot, keeping the dumbbell close to the chest the entire rep to stand back up, finishing with hips fully extended.', 'Take a full breath and brace the core before descending; hold that brace through the bottom and exhale as you pass the hardest part of the ascent.', 'Finish standing tall with knees locked out softly and hips fully open, weight balanced over the middle of the foot.', ARRAY['dumbbell','beginner-friendly','squat-pattern','warm-up']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('dumbbell-lunge', 'Dumbbell Lunge', 'strength', 'squat', 'quadriceps', ARRAY['glutes','hamstrings']::text[], 'dumbbell', 'intermediate', 'A loaded version of the walking or stationary lunge, holding dumbbells at the sides to add resistance to the single-leg pattern.', 'Set up with feet hip-width apart, a dumbbell hanging in each hand at the sides.', 'Sit back and down by bending the hips and knees together, keeping a tall, braced torso, until the rear knee lightly grazes the floor. Drive through the front foot, keeping the dumbbells from swinging to stand back up, finishing with hips fully extended.', 'Take a full breath and brace the core before descending; hold that brace through the bottom and exhale as you pass the hardest part of the ascent.', 'Finish standing tall with knees locked out softly and hips fully open, weight balanced over the middle of the foot.', ARRAY['dumbbell','unilateral','accessory']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('barbell-back-squat', 'Barbell Back Squat', 'strength', 'squat', 'quadriceps', ARRAY['glutes','hamstrings','core']::text[], 'barbell', 'advanced', 'The classic loaded squat with the bar racked across the upper back — a cornerstone lower-body strength and mass builder.', 'Set up with the bar racked across the upper traps (or lower on the rear delts for a low-bar setup), feet shoulder-width, unracked and walked back two steps.', 'Sit back and down by bending the hips and knees together, keeping a rigid, braced torso with a neutral spine, until the hip crease drops just below the top of the knee. Drive through the whole foot, driving the knees out as you stand to stand back up, finishing with hips fully extended.', 'Take a full breath and brace the core before descending; hold that brace through the bottom and exhale as you pass the hardest part of the ascent.', 'Finish standing tall with knees locked out softly and hips fully open, weight balanced over the middle of the foot.', ARRAY['barbell','powerlifting','strength','competition-lift','bilateral']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('barbell-front-squat', 'Barbell Front Squat', 'strength', 'squat', 'quadriceps', ARRAY['glutes','core']::text[], 'barbell', 'advanced', 'A more upright, quad-dominant squat variation with the bar racked across the front of the shoulders.', 'Set up with the bar resting on the front deltoids in a clean-grip or crossed-arm rack, elbows lifted high.', 'Sit back and down by bending the hips and knees together, keeping an upright torso — the elbows staying high is what keeps the bar from rolling forward, until the hip crease drops below the top of the knee. Drive through the whole foot, keeping the elbows up throughout the ascent to stand back up, finishing with hips fully extended.', 'Take a full breath and brace the core before descending; hold that brace through the bottom and exhale as you pass the hardest part of the ascent.', 'Finish standing tall with knees locked out softly and hips fully open, weight balanced over the middle of the foot.', ARRAY['barbell','olympic-style','quad-dominant','strength']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('leg-press', 'Leg Press', 'strength', 'squat', 'quadriceps', ARRAY['glutes','hamstrings']::text[], 'machine', 'beginner', 'A machine-based squat pattern that lets you load the legs heavily with less balance and bracing demand than a barbell squat.', 'Set up with feet shoulder-width on the platform, back flat against the pad.', 'Sit back and down by bending the hips and knees together, keeping the lower back pressed flat against the pad throughout, until the knees reach roughly 90 degrees or your comfortable depth without the hips lifting off the pad. Drive through the whole foot, pressing the platform away without locking the knees hard to stand back up, finishing with hips fully extended.', 'Take a full breath and brace the core before descending; hold that brace through the bottom and exhale as you pass the hardest part of the ascent.', 'Finish standing tall with knees locked out softly and hips fully open, weight balanced over the middle of the foot.', ARRAY['machine','beginner-friendly','quad-dominant']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('leg-extension', 'Leg Extension', 'strength', 'squat', 'quadriceps', '{}'::text[], 'machine', 'beginner', 'An isolation machine movement that targets the quadriceps directly through knee extension alone.', 'Set up with seated with the back against the pad and the shin pad resting just above the ankles.', 'Sit back and down by bending the hips and knees together, keeping the torso and hips stable against the seat, until the knees start bent at roughly 90 degrees. Drive through straightening the knees under control rather than kicking the weight up to stand back up, finishing with hips fully extended.', 'Take a full breath and brace the core before descending; hold that brace through the bottom and exhale as you pass the hardest part of the ascent.', 'Finish standing tall with knees locked out softly and hips fully open, weight balanced over the middle of the foot.', ARRAY['machine','isolation','accessory','quad-focus']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('glute-bridge', 'Glute Bridge', 'strength', 'hinge', 'glutes', ARRAY['hamstrings']::text[], 'bodyweight', 'beginner', 'A floor-based hip extension exercise that''s often the first step in teaching people to feel their glutes work.', 'Set up with lying on your back, knees bent, feet flat on the floor close to the glutes.', 'Push the hips back while keeping a soft bend in the knees, lowering the hips along a straight vertical line until you feel a stretch through the hamstrings, then drive the hips forward to return to standing.', 'Brace and inhale at the top before the hips break backward; exhale as the hips drive forward to lockout.', 'Finish with hips fully extended, glutes squeezed, and the hips back to the start position under control.', ARRAY['bodyweight','beginner-friendly','glute-activation','warm-up']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('single-leg-glute-bridge', 'Single-Leg Glute Bridge', 'strength', 'hinge', 'glutes', ARRAY['hamstrings','core']::text[], 'bodyweight', 'intermediate', 'A unilateral progression of the glute bridge that adds a stability and single-leg strength demand.', 'Set up with lying on your back, one foot flat on the floor and the other leg extended straight or held at the chest.', 'Push the hips back while keeping a soft bend in the knees, lowering the hips along a straight vertical line, resisting rotation toward the unsupported side until you feel a stretch through the hamstrings, then drive the hips forward to return to standing.', 'Brace and inhale at the top before the hips break backward; exhale as the hips drive forward to lockout.', 'Finish with hips fully extended, glutes squeezed, and the hips back to the start position under control.', ARRAY['bodyweight','unilateral','glute-focus','core-stability']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('single-leg-rdl-bodyweight', 'Single-Leg Romanian Deadlift', 'strength', 'hinge', 'hamstrings', ARRAY['glutes','core']::text[], 'bodyweight', 'intermediate', 'A balance-and-hamstring exercise performed on one leg, building unilateral posterior chain strength and stability without external load.', 'Set up with standing on one leg with a soft bend in the standing knee.', 'Push the hips back while keeping a soft bend in the knees, lowering the torso along a straight line as it tips forward while the free leg extends back for counterbalance until you feel a stretch through the hamstrings, then drive the hips forward to return to standing.', 'Brace and inhale at the top before the hips break backward; exhale as the hips drive forward to lockout.', 'Finish with hips fully extended, glutes squeezed, and the torso back to the start position under control.', ARRAY['bodyweight','unilateral','balance','hamstring-focus']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('dumbbell-rdl', 'Dumbbell Romanian Deadlift', 'strength', 'hinge', 'hamstrings', ARRAY['glutes','back']::text[], 'dumbbell', 'beginner', 'A hip-hinge movement holding dumbbells at the sides — an accessible way to load the hamstrings and glutes through a hinge pattern.', 'Set up with standing with a dumbbell in each hand in front of the thighs, feet hip-width apart.', 'Push the hips back while keeping a soft bend in the knees, lowering the dumbbells along close to the legs until you feel a stretch through the hamstrings, then drive the hips forward to return to standing.', 'Brace and inhale at the top before the hips break backward; exhale as the hips drive forward to lockout.', 'Finish with hips fully extended, glutes squeezed, and the dumbbells back to the start position under control.', ARRAY['dumbbell','hamstring-focus','hinge-pattern','accessory']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('dumbbell-hip-thrust', 'Dumbbell Hip Thrust', 'strength', 'hinge', 'glutes', ARRAY['hamstrings']::text[], 'dumbbell', 'intermediate', 'An elevated hip extension movement with a dumbbell loaded across the hips — one of the most direct glute-building exercises available.', 'Set up with upper back braced against a bench, feet flat on the floor, a dumbbell held across the hip crease.', 'Push the hips back while keeping a soft bend in the knees, lowering the hips along a straight vertical line up and down until you feel a stretch through the hamstrings, then drive the hips forward to return to standing.', 'Brace and inhale at the top before the hips break backward; exhale as the hips drive forward to lockout.', 'Finish with hips fully extended, glutes squeezed, and the hips back to the start position under control.', ARRAY['dumbbell','glute-focus','hip-extension','accessory']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('dumbbell-swing', 'Dumbbell Swing', 'strength', 'hinge', 'glutes', ARRAY['hamstrings','core']::text[], 'dumbbell', 'intermediate', 'A ballistic hip-hinge movement that trains explosive hip extension using momentum generated from the hips, not the arms.', 'Set up with feet slightly wider than shoulder-width, holding one dumbbell with both hands in front of the hips.', 'Push the hips back while keeping a soft bend in the knees, lowering the dumbbell along an arc, driven entirely by the hips snapping forward, not the arms lifting until you feel a stretch through the hamstrings, then drive the hips forward to return to standing.', 'Brace and inhale at the top before the hips break backward; exhale as the hips drive forward to lockout.', 'Finish with hips fully extended, glutes squeezed, and the dumbbell back to the start position under control.', ARRAY['dumbbell','ballistic','power','hinge-pattern']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('barbell-rdl', 'Barbell Romanian Deadlift', 'strength', 'hinge', 'hamstrings', ARRAY['glutes','back']::text[], 'barbell', 'intermediate', 'A barbell hip-hinge that builds hamstring and glute strength through a long, controlled range of motion.', 'Set up with standing with the bar at hip height, hands just outside the legs.', 'Push the hips back while keeping a soft bend in the knees, lowering the bar along close against the thighs and shins the entire rep until you feel a stretch through the hamstrings, then drive the hips forward to return to standing.', 'Brace and inhale at the top before the hips break backward; exhale as the hips drive forward to lockout.', 'Finish with hips fully extended, glutes squeezed, and the bar back to the start position under control.', ARRAY['barbell','hamstring-focus','hinge-pattern','strength']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('barbell-deadlift', 'Barbell Deadlift', 'strength', 'hinge', 'hamstrings', ARRAY['glutes','back','forearms']::text[], 'barbell', 'advanced', 'A full hip-hinge pull from the floor and one of the most fundamental strength movements — trains the entire posterior chain in one lift.', 'Set up with the bar over the middle of the feet, shins close to the bar, hips set below the shoulders and above the knees, a flat back and braced core.', 'Push the hips back while keeping a soft bend in the knees, lowering the bar along close to the shins and thighs the entire pull until you feel a stretch through the hamstrings, then drive the hips forward to return to standing.', 'Brace and inhale at the top before the hips break backward; exhale as the hips drive forward to lockout.', 'Finish with hips fully extended, glutes squeezed, and the bar back to the start position under control.', ARRAY['barbell','powerlifting','strength','competition-lift','bilateral']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('barbell-good-morning', 'Barbell Good Morning', 'strength', 'hinge', 'hamstrings', ARRAY['glutes','back']::text[], 'barbell', 'advanced', 'A hip-hinge performed with the bar racked on the back like a squat — builds posterior chain strength and hinge control under load.', 'Set up with the bar racked across the upper back like a back squat, feet hip-width apart, a soft bend in the knees.', 'Push the hips back while keeping a soft bend in the knees, lowering the torso along forward while the hips push back, keeping the bar over the mid-foot until you feel a stretch through the hamstrings, then drive the hips forward to return to standing.', 'Brace and inhale at the top before the hips break backward; exhale as the hips drive forward to lockout.', 'Finish with hips fully extended, glutes squeezed, and the torso back to the start position under control.', ARRAY['barbell','hinge-pattern','posterior-chain','accessory']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('leg-curl-machine', 'Leg Curl Machine', 'strength', 'hinge', 'hamstrings', '{}'::text[], 'machine', 'beginner', 'An isolation machine movement that targets the hamstrings directly through knee flexion.', 'Set up with lying face down (or seated, depending on the machine) with the pad resting just above the heels.', 'Push the hips back while keeping a soft bend in the knees, lowering the pad along in a controlled arc as the knees bend until you feel a stretch through the hamstrings, then drive the hips forward to return to standing.', 'Brace and inhale at the top before the hips break backward; exhale as the hips drive forward to lockout.', 'Finish with hips fully extended, glutes squeezed, and the pad back to the start position under control.', ARRAY['machine','isolation','accessory','hamstring-focus']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('push-up', 'Push-Up', 'strength', 'push', 'chest', ARRAY['triceps','shoulders','core']::text[], 'bodyweight', 'beginner', 'The classic bodyweight horizontal pressing movement — trains the chest, shoulders and triceps together while demanding full-body core control.', 'Set up with hands roughly shoulder-width apart on the floor, body in a straight line from head to heels.', 'Lower the chest under control until the chest nearly touches the floor, keeping the elbows at roughly a 45-degree angle from the torso, then press back up to full extension.', 'Inhale on the way down, exhale forcefully as you press through the sticking point.', 'Finish with arms extended (not locked hard) and shoulder blades still in contact with the bench or floor.', ARRAY['bodyweight','beginner-friendly','compound','warm-up']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('incline-push-up', 'Incline Push-Up', 'strength', 'push', 'chest', ARRAY['triceps','shoulders']::text[], 'bodyweight', 'beginner', 'A regressed push-up variation performed with the hands elevated on a bench or box, reducing the load for beginners building toward a full push-up.', 'Set up with hands on an elevated surface like a bench, body in a straight line from head to heels.', 'Lower the chest under control until the chest nearly touches the elevated surface, keeping the elbows at roughly a 45-degree angle from the torso, then press back up to full extension.', 'Inhale on the way down, exhale forcefully as you press through the sticking point.', 'Finish with arms extended (not locked hard) and shoulder blades still in contact with the bench or floor.', ARRAY['bodyweight','regression','beginner-friendly']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('decline-push-up', 'Decline Push-Up', 'strength', 'push', 'chest', ARRAY['shoulders','triceps']::text[], 'bodyweight', 'intermediate', 'A progressed push-up variation with the feet elevated, increasing the load on the chest and shoulders and shifting emphasis upward.', 'Set up with hands on the floor, feet elevated on a bench or box, body in a straight line.', 'Lower the chest under control until the chest nearly touches the floor, keeping the elbows at roughly a 45-degree angle from the torso, then press back up to full extension.', 'Inhale on the way down, exhale forcefully as you press through the sticking point.', 'Finish with arms extended (not locked hard) and shoulder blades still in contact with the bench or floor.', ARRAY['bodyweight','progression','upper-chest']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('dumbbell-bench-press', 'Dumbbell Bench Press', 'strength', 'push', 'chest', ARRAY['triceps','shoulders']::text[], 'dumbbell', 'beginner', 'A horizontal press performed with dumbbells rather than a barbell, allowing a greater range of motion and independent arm control.', 'Set up with lying on a flat bench, a dumbbell in each hand at chest level, feet flat on the floor.', 'Lower the dumbbells under control until the dumbbells reach chest level, a little deeper than a barbell allows, keeping the elbows at roughly a 45-degree angle from the torso, then press back up to full extension.', 'Inhale on the way down, exhale forcefully as you press through the sticking point.', 'Finish with arms extended (not locked hard) and shoulder blades still in contact with the bench or floor.', ARRAY['dumbbell','chest-focus','compound']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('dumbbell-floor-press', 'Dumbbell Floor Press', 'strength', 'push', 'chest', ARRAY['triceps','shoulders']::text[], 'dumbbell', 'beginner', 'A joint-friendly pressing variation performed lying on the floor, which naturally limits the range of motion at the shoulder.', 'Set up with lying flat on the floor with knees bent, a dumbbell in each hand at chest level.', 'Lower the dumbbells under control until the upper arms touch the floor, keeping the elbows at roughly a 45-degree angle from the torso, then press back up to full extension.', 'Inhale on the way down, exhale forcefully as you press through the sticking point.', 'Finish with arms extended (not locked hard) and shoulder blades still in contact with the bench or floor.', ARRAY['dumbbell','joint-friendly','chest-focus']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('dumbbell-chest-fly', 'Dumbbell Chest Fly', 'strength', 'push', 'chest', '{}'::text[], 'dumbbell', 'intermediate', 'An isolation movement that targets the chest through horizontal adduction of the arms, without the triceps taking over as in a press.', 'Set up with lying on a flat bench, dumbbells held above the chest with a slight bend in the elbows.', 'Lower the dumbbells under control until the arms reach chest level in a wide arc, keeping the elbows at roughly a 45-degree angle from the torso, then press back up to full extension.', 'Inhale on the way down, exhale forcefully as you press through the sticking point.', 'Finish with arms extended (not locked hard) and shoulder blades still in contact with the bench or floor.', ARRAY['dumbbell','isolation','chest-focus','accessory']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('barbell-bench-press', 'Barbell Bench Press', 'strength', 'push', 'chest', ARRAY['triceps','shoulders']::text[], 'barbell', 'advanced', 'The classic barbell horizontal press and one of the three powerlifting competition lifts — a primary measure of upper-body pressing strength.', 'Set up with lying on a flat bench, eyes under the bar, feet planted flat, shoulder blades pulled together and down.', 'Lower the bar under control until the bar touches the chest, keeping the elbows at roughly a 45-degree angle from the torso, then press back up to full extension.', 'Inhale on the way down, exhale forcefully as you press through the sticking point.', 'Finish with arms extended (not locked hard) and shoulder blades still in contact with the bench or floor.', ARRAY['barbell','powerlifting','strength','competition-lift','bilateral']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('chest-press-machine', 'Chest Press Machine', 'strength', 'push', 'chest', ARRAY['triceps','shoulders']::text[], 'machine', 'beginner', 'A guided horizontal press that removes the stability demands of a free-weight press, letting you focus purely on the pushing muscles.', 'Set up with seated with the back against the pad, handles at chest height.', 'Lower the handles under control until the handles reach chest level, keeping the elbows at roughly a 45-degree angle from the torso, then press back up to full extension.', 'Inhale on the way down, exhale forcefully as you press through the sticking point.', 'Finish with arms extended (not locked hard) and shoulder blades still in contact with the bench or floor.', ARRAY['machine','beginner-friendly','chest-focus']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('cable-chest-fly', 'Cable Chest Fly', 'strength', 'push', 'chest', '{}'::text[], 'cable', 'intermediate', 'A cable-based isolation fly that keeps constant tension on the chest throughout the entire range of motion, unlike a dumbbell fly.', 'Set up with standing centered between two cable stacks, one handle in each hand, a slight forward lean and staggered stance.', 'Lower the handles under control until the hands meet in front of the chest, keeping the elbows at roughly a 45-degree angle from the torso, then press back up to full extension.', 'Inhale on the way down, exhale forcefully as you press through the sticking point.', 'Finish with arms extended (not locked hard) and shoulder blades still in contact with the bench or floor.', ARRAY['cable','isolation','chest-focus','accessory']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('pike-push-up', 'Pike Push-Up', 'strength', 'push', 'shoulders', ARRAY['triceps']::text[], 'bodyweight', 'intermediate', 'A bodyweight vertical pressing movement performed in a pike position, an accessible way to build overhead pressing strength before loading a barbell overhead.', 'Set up with hands and feet on the floor, hips lifted high into an inverted-V position.', 'Press the head straight overhead in a vertical path, keeping the ribs down and core braced so the lower back doesn''t overextend, until the arms are fully locked out overhead.', 'Inhale and brace before the press, exhale as the load passes your eyeline.', 'Finish with the load stacked directly over the shoulders and the head pushed slightly through the arms.', ARRAY['bodyweight','shoulder-focus','progression-toward-handstand']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('dumbbell-shoulder-press', 'Dumbbell Shoulder Press', 'strength', 'push', 'shoulders', ARRAY['triceps']::text[], 'dumbbell', 'beginner', 'A vertical press performed with dumbbells at shoulder height, building overhead pressing strength with a naturally shoulder-friendly path.', 'Set up with seated or standing, a dumbbell in each hand at shoulder height, palms facing forward.', 'Press the dumbbells straight overhead in a vertical path, keeping the ribs down and core braced so the lower back doesn''t overextend, until the arms are fully locked out overhead.', 'Inhale and brace before the press, exhale as the load passes your eyeline.', 'Finish with the load stacked directly over the shoulders and the head pushed slightly through the arms.', ARRAY['dumbbell','shoulder-focus','compound']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('dumbbell-arnold-press', 'Dumbbell Arnold Press', 'strength', 'push', 'shoulders', ARRAY['triceps']::text[], 'dumbbell', 'intermediate', 'A rotational overhead press variation that adds shoulder rotation to the standard press, working the deltoid through a fuller range.', 'Set up with seated, dumbbells held at shoulder height with palms facing you.', 'Press the dumbbells straight overhead in a vertical path, keeping the ribs down and core braced so the lower back doesn''t overextend, until the arms are fully locked out overhead.', 'Inhale and brace before the press, exhale as the load passes your eyeline.', 'Finish with the load stacked directly over the shoulders and the head pushed slightly through the arms.', ARRAY['dumbbell','shoulder-focus','rotational']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('dumbbell-lateral-raise', 'Dumbbell Lateral Raise', 'strength', 'push', 'shoulders', '{}'::text[], 'dumbbell', 'beginner', 'An isolation movement for the side deltoids, raising the dumbbells out to the sides rather than pressing overhead.', 'Set up with standing with a dumbbell in each hand at the sides, a soft bend in the elbows.', 'Press the dumbbells straight overhead in a vertical path, keeping the ribs down and core braced so the lower back doesn''t overextend, until the arms are fully locked out overhead.', 'Inhale and brace before the press, exhale as the load passes your eyeline.', 'Finish with the load stacked directly over the shoulders and the head pushed slightly through the arms.', ARRAY['dumbbell','isolation','shoulder-focus','accessory']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('barbell-overhead-press', 'Barbell Overhead Press', 'strength', 'push', 'shoulders', ARRAY['triceps','core']::text[], 'barbell', 'advanced', 'A standing barbell press overhead — a demanding full-body strength movement that also tests core and shoulder stability under load.', 'Set up with standing, the bar racked at the front of the shoulders, hands just outside shoulder-width, feet hip-width apart.', 'Press the bar straight overhead in a vertical path, keeping the ribs down and core braced so the lower back doesn''t overextend, until the arms are fully locked out overhead.', 'Inhale and brace before the press, exhale as the load passes your eyeline.', 'Finish with the load stacked directly over the shoulders and the head pushed slightly through the arms.', ARRAY['barbell','strength','standing-press','compound']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('machine-shoulder-press', 'Machine Shoulder Press', 'strength', 'push', 'shoulders', ARRAY['triceps']::text[], 'machine', 'beginner', 'A guided vertical press that removes balance demands, letting beginners build pressing strength safely.', 'Set up with seated with the back against the pad, handles at shoulder height.', 'Press the handles straight overhead in a vertical path, keeping the ribs down and core braced so the lower back doesn''t overextend, until the arms are fully locked out overhead.', 'Inhale and brace before the press, exhale as the load passes your eyeline.', 'Finish with the load stacked directly over the shoulders and the head pushed slightly through the arms.', ARRAY['machine','beginner-friendly','shoulder-focus']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('cable-lateral-raise', 'Cable Lateral Raise', 'strength', 'push', 'shoulders', '{}'::text[], 'cable', 'intermediate', 'A cable-based isolation raise that keeps constant tension on the side delt throughout the range, unlike a dumbbell raise which loses tension at the top and bottom.', 'Set up with standing side-on to the cable stack, the handle in the hand furthest from the machine.', 'Press the handle straight overhead in a vertical path, keeping the ribs down and core braced so the lower back doesn''t overextend, until the arms are fully locked out overhead.', 'Inhale and brace before the press, exhale as the load passes your eyeline.', 'Finish with the load stacked directly over the shoulders and the head pushed slightly through the arms.', ARRAY['cable','isolation','shoulder-focus','accessory']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('inverted-row', 'Inverted Row', 'strength', 'pull', 'back', ARRAY['biceps']::text[], 'bodyweight', 'beginner', 'A bodyweight horizontal pulling movement performed under a bar or rings, a natural bodyweight regression toward the barbell row.', 'Set up with lying under a fixed bar, hands just outside shoulder-width, body in a straight line, heels on the floor.', 'Pull the chest toward the torso by driving the elbows back and squeezing the shoulder blades together, then extend the arms fully to return to the start under control.', 'Exhale as you pull, inhale as you control the return to full extension.', 'Finish with the shoulder blades pinched together and the arms fully extended without letting the torso collapse forward.', ARRAY['bodyweight','pull-pattern','beginner-friendly']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('dumbbell-row', 'Dumbbell Row', 'strength', 'pull', 'back', ARRAY['biceps']::text[], 'dumbbell', 'beginner', 'A single-arm horizontal pulling movement, usually performed supported on a bench, that builds back thickness and allows a focus on one side at a time.', 'Set up with one knee and hand supported on a bench, the other foot on the floor, a dumbbell in the free hand hanging straight down.', 'Pull the dumbbell toward the torso by driving the elbows back and squeezing the shoulder blades together, then extend the arms fully to return to the start under control.', 'Exhale as you pull, inhale as you control the return to full extension.', 'Finish with the shoulder blades pinched together and the arms fully extended without letting the torso collapse forward.', ARRAY['dumbbell','unilateral','back-focus','accessory']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('dumbbell-renegade-row', 'Dumbbell Renegade Row', 'strength', 'pull', 'back', ARRAY['core','biceps']::text[], 'dumbbell', 'advanced', 'A combined plank and row that layers a horizontal pull onto an anti-rotation core challenge.', 'Set up with a high plank position with hands gripping dumbbells on the floor, feet set wide for stability.', 'Pull one dumbbell at a time toward the torso by driving the elbows back and squeezing the shoulder blades together, then extend the arms fully to return to the start under control.', 'Exhale as you pull, inhale as you control the return to full extension.', 'Finish with the shoulder blades pinched together and the arms fully extended without letting the torso collapse forward.', ARRAY['dumbbell','core-stability','anti-rotation','advanced']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('barbell-row', 'Barbell Row', 'strength', 'pull', 'back', ARRAY['biceps']::text[], 'barbell', 'advanced', 'A bent-over horizontal pull with a barbell — a heavy-loading staple for building back thickness and pulling strength.', 'Set up with a hip-hinge position with the torso roughly 45 degrees to the floor, the bar hanging at arm''s length.', 'Pull the bar toward the torso by driving the elbows back and squeezing the shoulder blades together, then extend the arms fully to return to the start under control.', 'Exhale as you pull, inhale as you control the return to full extension.', 'Finish with the shoulder blades pinched together and the arms fully extended without letting the torso collapse forward.', ARRAY['barbell','back-focus','strength','bilateral']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('seated-cable-row', 'Seated Cable Row', 'strength', 'pull', 'back', ARRAY['biceps']::text[], 'cable', 'beginner', 'A seated horizontal cable pull that isolates the back muscles with a stable base, removing the hinge-hold demand of a barbell row.', 'Set up with seated with feet on the platform, knees slightly bent, torso upright, handle held at arm''s length.', 'Pull the handle toward the torso by driving the elbows back and squeezing the shoulder blades together, then extend the arms fully to return to the start under control.', 'Exhale as you pull, inhale as you control the return to full extension.', 'Finish with the shoulder blades pinched together and the arms fully extended without letting the torso collapse forward.', ARRAY['cable','back-focus','beginner-friendly']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('chest-supported-row-machine', 'Chest-Supported Row Machine', 'strength', 'pull', 'back', ARRAY['biceps']::text[], 'machine', 'beginner', 'A row performed with the chest braced against a pad, removing any lower back stress and letting you focus purely on the pulling muscles.', 'Set up with chest against the pad, handles at arm''s length.', 'Pull the handles toward the torso by driving the elbows back and squeezing the shoulder blades together, then extend the arms fully to return to the start under control.', 'Exhale as you pull, inhale as you control the return to full extension.', 'Finish with the shoulder blades pinched together and the arms fully extended without letting the torso collapse forward.', ARRAY['machine','beginner-friendly','back-focus']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('rear-delt-fly-machine', 'Rear Delt Fly Machine', 'strength', 'pull', 'shoulders', ARRAY['back']::text[], 'machine', 'beginner', 'An isolation movement for the rear deltoids and upper back, often neglected relative to the front and side delts.', 'Set up with seated facing the pad, handles held with arms extended in front.', 'Pull the handles toward the torso by driving the elbows back and squeezing the shoulder blades together, then extend the arms fully to return to the start under control.', 'Exhale as you pull, inhale as you control the return to full extension.', 'Finish with the shoulder blades pinched together and the arms fully extended without letting the torso collapse forward.', ARRAY['machine','isolation','rear-delt-focus','accessory']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('pull-up', 'Pull-Up', 'strength', 'pull', 'back', ARRAY['biceps','forearms']::text[], 'bodyweight', 'advanced', 'A vertical bodyweight pull with an overhand grip — one of the clearest tests of relative upper-body pulling strength.', 'Set up with hanging from a bar with an overhand grip just outside shoulder-width, arms fully extended.', 'Pull the chest down toward the upper chest by driving the elbows down and back, leading with the chest rather than the chin, then extend the arms fully to return to a dead hang or start position.', 'Exhale on the pull up/down, inhale as you lower back to the start.', 'Finish with the arms fully extended and shoulder blades reset, no shrugging at the top.', ARRAY['bodyweight','competition-lift','back-focus','advanced']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('chin-up', 'Chin-Up', 'strength', 'pull', 'back', ARRAY['biceps']::text[], 'bodyweight', 'advanced', 'A vertical bodyweight pull with an underhand grip, which biases the biceps more than a pull-up while still building the back.', 'Set up with hanging from a bar with an underhand grip roughly shoulder-width, arms fully extended.', 'Pull the chin down toward the upper chest by driving the elbows down and back, leading with the chest rather than the chin, then extend the arms fully to return to a dead hang or start position.', 'Exhale on the pull up/down, inhale as you lower back to the start.', 'Finish with the arms fully extended and shoulder blades reset, no shrugging at the top.', ARRAY['bodyweight','back-focus','biceps-focus','advanced']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('dumbbell-pullover', 'Dumbbell Pullover', 'strength', 'pull', 'back', ARRAY['chest']::text[], 'dumbbell', 'intermediate', 'A unique pulling movement performed lying across a bench, working the lats through shoulder extension rather than elbow flexion.', 'Set up with lying across a bench with just the upper back supported, one dumbbell held with both hands above the chest.', 'Pull the dumbbell down toward the upper chest by driving the elbows down and back, leading with the chest rather than the chin, then extend the arms fully to return to a dead hang or start position.', 'Exhale on the pull up/down, inhale as you lower back to the start.', 'Finish with the arms fully extended and shoulder blades reset, no shrugging at the top.', ARRAY['dumbbell','lat-focus','isolation','accessory']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('lat-pulldown', 'Lat Pulldown', 'strength', 'pull', 'back', ARRAY['biceps']::text[], 'cable', 'beginner', 'A seated vertical pulling movement on a cable machine, often used as a more accessible alternative or accessory to the pull-up.', 'Set up with seated with thighs secured under the pad, gripping the bar just outside shoulder-width.', 'Pull the bar down toward the upper chest by driving the elbows down and back, leading with the chest rather than the chin, then extend the arms fully to return to a dead hang or start position.', 'Exhale on the pull up/down, inhale as you lower back to the start.', 'Finish with the arms fully extended and shoulder blades reset, no shrugging at the top.', ARRAY['cable','back-focus','beginner-friendly']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('assisted-pull-up-machine', 'Assisted Pull-Up Machine', 'strength', 'pull', 'back', ARRAY['biceps']::text[], 'machine', 'beginner', 'A machine that counterbalances part of your bodyweight, letting you build toward an unassisted pull-up with full range of motion.', 'Set up with kneeling or standing on the platform, gripping the handles with an overhand grip.', 'Pull the chest down toward the upper chest by driving the elbows down and back, leading with the chest rather than the chin, then extend the arms fully to return to a dead hang or start position.', 'Exhale on the pull up/down, inhale as you lower back to the start.', 'Finish with the arms fully extended and shoulder blades reset, no shrugging at the top.', ARRAY['machine','regression','back-focus','beginner-friendly']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('straight-arm-pulldown', 'Straight-Arm Pulldown', 'strength', 'pull', 'back', '{}'::text[], 'cable', 'intermediate', 'An isolation cable movement for the lats performed with straight arms, isolating shoulder extension without biceps involvement.', 'Set up with standing facing a high cable, gripping a bar or rope with arms extended overhead.', 'Pull the bar down toward the upper chest by driving the elbows down and back, leading with the chest rather than the chin, then extend the arms fully to return to a dead hang or start position.', 'Exhale on the pull up/down, inhale as you lower back to the start.', 'Finish with the arms fully extended and shoulder blades reset, no shrugging at the top.', ARRAY['cable','isolation','lat-focus','accessory']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('plank', 'Plank', 'strength', 'anti_rotation', 'core', ARRAY['shoulders']::text[], 'bodyweight', 'beginner', 'A static hold on the forearms and toes that builds core bracing and anti-extension strength.', 'Set up with forearms on the floor, elbows under the shoulders, body in a straight line from head to heels.', 'Hold the position rigidly for time, resisting the hips sagging or piking.', 'Breathe steadily through the hold or rep rather than holding your breath — exhale on the hardest part of each rep.', 'Finish with the spine in a neutral, controlled position — stop the set the moment form starts to break down.', ARRAY['bodyweight','isometric','beginner-friendly','warm-up']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('side-plank', 'Side Plank', 'strength', 'anti_rotation', 'core', ARRAY['shoulders','glutes']::text[], 'bodyweight', 'beginner', 'A lateral static hold that trains the obliques and lateral hip stability through anti-lateral-flexion strength.', 'Set up with lying on one side, propped on the forearm with elbow under the shoulder, body in a straight line, feet stacked or staggered.', 'Lift the hips off the floor and hold the straight line for time, keeping the hips from sagging or rotating.', 'Breathe steadily through the hold or rep rather than holding your breath — exhale on the hardest part of each rep.', 'Finish with the spine in a neutral, controlled position — stop the set the moment form starts to break down.', ARRAY['bodyweight','isometric','oblique-focus']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('dead-bug', 'Dead Bug', 'strength', 'anti_rotation', 'core', '{}'::text[], 'bodyweight', 'beginner', 'A floor-based core exercise that trains anti-extension and coordination by moving opposite arms and legs while keeping the lower back pinned flat.', 'Set up with lying on your back, arms reaching straight up and knees bent to 90 degrees over the hips.', 'Slowly lower one arm overhead and the opposite leg toward the floor while keeping the lower back pressed flat, then return and switch sides.', 'Breathe steadily through the hold or rep rather than holding your breath — exhale on the hardest part of each rep.', 'Finish with the spine in a neutral, controlled position — stop the set the moment form starts to break down.', ARRAY['bodyweight','anti-extension','beginner-friendly','core-control']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('bird-dog', 'Bird Dog', 'strength', 'anti_rotation', 'core', ARRAY['glutes','back']::text[], 'bodyweight', 'beginner', 'A quadruped core stability exercise that trains anti-rotation strength by extending opposite arm and leg while keeping the spine still.', 'Set up with on hands and knees, hands under the shoulders and knees under the hips, spine in a neutral position.', 'Extend one arm forward and the opposite leg straight back at the same time, keeping the hips and shoulders square, then return and switch sides.', 'Breathe steadily through the hold or rep rather than holding your breath — exhale on the hardest part of each rep.', 'Finish with the spine in a neutral, controlled position — stop the set the moment form starts to break down.', ARRAY['bodyweight','anti-rotation','beginner-friendly','core-control']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('hanging-knee-raise', 'Hanging Knee Raise', 'strength', 'anti_rotation', 'core', ARRAY['forearms']::text[], 'bodyweight', 'intermediate', 'A hanging core exercise that trains the lower abdominals and hip flexors through controlled knee flexion while resisting body swing.', 'Set up with hanging from a bar with arms fully extended, legs straight.', 'Curl the knees up toward the chest using the abs, then lower back to a dead hang under control.', 'Breathe steadily through the hold or rep rather than holding your breath — exhale on the hardest part of each rep.', 'Finish with the spine in a neutral, controlled position — stop the set the moment form starts to break down.', ARRAY['bodyweight','lower-ab-focus','hanging']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('russian-twist', 'Russian Twist', 'strength', 'rotation', 'core', '{}'::text[], 'bodyweight', 'beginner', 'A seated rotational core exercise that trains the obliques through controlled side-to-side twisting.', 'Set up with seated with knees bent, torso leaned back roughly 45 degrees, feet lifted or on the floor.', 'Rotate the torso to touch the floor on one side, then the other, keeping the rotation coming from the torso rather than just swinging the arms.', 'Breathe steadily through the hold or rep rather than holding your breath — exhale on the hardest part of each rep.', 'Finish with the spine in a neutral, controlled position — stop the set the moment form starts to break down.', ARRAY['bodyweight','rotational','oblique-focus']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('weighted-russian-twist', 'Weighted Russian Twist', 'strength', 'rotation', 'core', '{}'::text[], 'dumbbell', 'intermediate', 'A loaded version of the Russian twist holding a dumbbell, adding resistance to the rotational core pattern.', 'Set up with seated with knees bent, torso leaned back roughly 45 degrees, holding one dumbbell with both hands.', 'Rotate the torso to bring the dumbbell to one side near the floor, then the other, keeping the movement controlled.', 'Breathe steadily through the hold or rep rather than holding your breath — exhale on the hardest part of each rep.', 'Finish with the spine in a neutral, controlled position — stop the set the moment form starts to break down.', ARRAY['dumbbell','rotational','oblique-focus','accessory']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('weighted-sit-up', 'Weighted Sit-Up', 'strength', 'anti_rotation', 'core', '{}'::text[], 'dumbbell', 'intermediate', 'A loaded sit-up holding a weight at the chest, adding resistance to the classic spinal flexion core movement.', 'Set up with lying on the back, knees bent, feet anchored, a dumbbell held at the chest.', 'Curl the torso up to a seated position using the abs, then lower back down under control.', 'Breathe steadily through the hold or rep rather than holding your breath — exhale on the hardest part of each rep.', 'Finish with the spine in a neutral, controlled position — stop the set the moment form starts to break down.', ARRAY['dumbbell','ab-focus','accessory']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('cable-crunch', 'Cable Crunch', 'strength', 'anti_rotation', 'core', '{}'::text[], 'cable', 'intermediate', 'A kneeling cable exercise that loads spinal flexion directly, letting you progressively overload the abs beyond bodyweight crunches.', 'Set up with kneeling below a high cable, rope held near the head, hips stacked over the knees.', 'Crunch the torso down by flexing the spine, bringing the elbows toward the thighs, then return to the start under control.', 'Breathe steadily through the hold or rep rather than holding your breath — exhale on the hardest part of each rep.', 'Finish with the spine in a neutral, controlled position — stop the set the moment form starts to break down.', ARRAY['cable','ab-focus','accessory']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('farmers-carry', 'Farmer''s Carry', 'strength', 'carry', 'full_body', ARRAY['core','forearms']::text[], 'dumbbell', 'beginner', 'A loaded carry holding a dumbbell in each hand and walking — one of the simplest and most effective full-body strength and grip exercises.', 'Set up with standing tall with a heavy dumbbell in each hand at the sides, shoulders pulled back and down.', 'Walk forward with short, controlled steps, keeping the torso upright and the load from swinging or pulling you to one side, for the prescribed distance or time.', 'Breathe steadily and rhythmically with your steps rather than bracing and holding your breath the whole carry.', 'Set the load down under control rather than dropping it, keeping the back flat throughout.', ARRAY['dumbbell','full-body','grip-strength','conditioning']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('suitcase-carry', 'Suitcase Carry', 'strength', 'carry', 'core', ARRAY['forearms','full_body']::text[], 'dumbbell', 'intermediate', 'A single-sided loaded carry holding weight in only one hand, which strongly challenges the obliques to resist lateral flexion.', 'Set up with standing tall with one dumbbell held at the side, the opposite hand free.', 'Walk forward with short, controlled steps, keeping the torso upright and the load from swinging or pulling you to one side, for the prescribed distance or time.', 'Breathe steadily and rhythmically with your steps rather than bracing and holding your breath the whole carry.', 'Set the load down under control rather than dropping it, keeping the back flat throughout.', ARRAY['dumbbell','unilateral','anti-lateral-flexion','conditioning']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('waiters-carry', 'Waiter''s Carry', 'strength', 'carry', 'shoulders', ARRAY['core','triceps']::text[], 'dumbbell', 'intermediate', 'An overhead loaded carry holding a single dumbbell locked out above the shoulder, demanding serious shoulder and core stability while walking.', 'Set up with one dumbbell pressed overhead with the arm locked out, the other hand free, walking with a tall posture.', 'Walk forward with short, controlled steps, keeping the torso upright and the load from swinging or pulling you to one side, for the prescribed distance or time.', 'Breathe steadily and rhythmically with your steps rather than bracing and holding your breath the whole carry.', 'Set the load down under control rather than dropping it, keeping the back flat throughout.', ARRAY['dumbbell','overhead-stability','unilateral','conditioning']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('easy-run', 'Easy Run', 'running', null, 'full_body', ARRAY['calves','quadriceps']::text[], 'bodyweight', 'beginner', 'A low-intensity, conversational-pace run used for aerobic base-building and recovery between harder sessions.', 'Choose a flat, comfortable route and start at a pace where you could hold a full conversation.', 'Run at a relaxed, conversational pace throughout — if you''re breathing too hard to talk in full sentences, slow down.', 'Settle into a rhythmic breathing pattern — roughly one breath every 2-3 strides at easy pace, shortening as intensity rises.', 'Ease off the pace over the final minutes rather than stopping abruptly, then walk for a few minutes to cool down.', ARRAY['running','aerobic-base','recovery','zone-2']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('tempo-run', 'Tempo Run', 'running', null, 'full_body', ARRAY['calves']::text[], 'bodyweight', 'intermediate', 'A sustained effort run at a ''comfortably hard'' pace, typically close to lactate threshold, that trains the body to clear and buffer lactate more efficiently.', 'Warm up for 10-15 minutes at an easy pace before starting the tempo effort.', 'Hold a steady, comfortably hard pace — one you could sustain for about an hour if pushed — for the prescribed duration, then cool down.', 'Settle into a rhythmic breathing pattern — roughly one breath every 2-3 strides at easy pace, shortening as intensity rises.', 'Ease off the pace over the final minutes rather than stopping abruptly, then walk for a few minutes to cool down.', ARRAY['running','threshold','intermediate']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('interval-400m', '400m Intervals', 'running', null, 'full_body', ARRAY['calves','quadriceps']::text[], 'bodyweight', 'advanced', 'Repeated 400m efforts at a fast, controlled pace with recovery between reps — builds speed, running economy, and VO2max.', 'Warm up thoroughly with 10-15 minutes of easy running plus a few strides before the first interval.', 'Run each 400m rep at a hard, controlled pace, then take the prescribed recovery (walk or easy jog) before the next rep.', 'Settle into a rhythmic breathing pattern — roughly one breath every 2-3 strides at easy pace, shortening as intensity rises.', 'Ease off the pace over the final minutes rather than stopping abruptly, then walk for a few minutes to cool down.', ARRAY['running','speed','vo2max','interval']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('long-run', 'Long Run', 'running', null, 'full_body', ARRAY['calves','quadriceps','hamstrings']::text[], 'bodyweight', 'intermediate', 'The week''s longest continuous run, building aerobic endurance and durability at an easy-to-moderate pace.', 'Fuel and hydrate beforehand, and plan a route or loop that covers the prescribed distance/time.', 'Run at an easy, sustainable pace for the full prescribed distance or duration, allowing pace to drift slightly slower in the back half if needed.', 'Settle into a rhythmic breathing pattern — roughly one breath every 2-3 strides at easy pace, shortening as intensity rises.', 'Ease off the pace over the final minutes rather than stopping abruptly, then walk for a few minutes to cool down.', ARRAY['running','endurance','aerobic-base']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('hill-sprints', 'Hill Sprints', 'running', null, 'glutes', ARRAY['calves','quadriceps','hamstrings']::text[], 'bodyweight', 'advanced', 'Short, maximal-effort sprints up an incline that build power, running mechanics, and strength with less impact stress than flat sprinting.', 'Find a moderate hill (roughly 6-10% grade) and warm up thoroughly with easy jogging plus a few build-up strides.', 'Sprint hard uphill for the prescribed distance/time (typically 8-15 seconds), then walk back down as full recovery before the next rep.', 'Settle into a rhythmic breathing pattern — roughly one breath every 2-3 strides at easy pace, shortening as intensity rises.', 'Ease off the pace over the final minutes rather than stopping abruptly, then walk for a few minutes to cool down.', ARRAY['running','power','sprint','hill']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('fartlek-run', 'Fartlek Run', 'running', null, 'full_body', ARRAY['calves']::text[], 'bodyweight', 'intermediate', 'An unstructured speed-play run alternating faster surges with easy running by feel, rather than fixed intervals — a flexible way to add speed work without a track.', 'Warm up with 10 minutes of easy running before starting to play with pace.', 'Alternate faster surges (by landmark, time, or feel) with easy recovery running throughout, varying the length and intensity of surges as you like.', 'Settle into a rhythmic breathing pattern — roughly one breath every 2-3 strides at easy pace, shortening as intensity rises.', 'Ease off the pace over the final minutes rather than stopping abruptly, then walk for a few minutes to cool down.', ARRAY['running','speed-play','aerobic','fun']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('rowing-erg', 'Rowing Erg', 'cardio', null, 'back', ARRAY['hamstrings','core','biceps']::text[], 'cardio_machine', 'beginner', 'A full-body cardio modality on a rowing ergometer that combines a leg drive, hip hinge, and pulling motion in one continuous cycle.', 'Set the damper (typically 3-5 for most training), strap in, and start in the catch position — knees bent, arms extended, shins vertical.', 'Sequence each stroke as legs, then back, then arms on the drive; reverse the order — arms, back, then legs — on the recovery.', 'Match your breathing rate to effort — controlled and rhythmic at easy pace, deeper and faster as intervals intensify.', 'Reduce intensity gradually over the last couple of minutes rather than stopping outright.', ARRAY['cardio','full-body','conditioning','machine']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('assault-bike', 'Assault Bike', 'cardio', null, 'full_body', ARRAY['quadriceps','shoulders']::text[], 'cardio_machine', 'intermediate', 'A fan-bike cardio modality that uses both arms and legs simultaneously, making it a demanding full-body conditioning tool for intervals.', 'Set the seat height so the knee has a slight bend at full leg extension.', 'Push and pull the handles in sync with the legs, adjusting effort to the prescribed pace or interval structure.', 'Match your breathing rate to effort — controlled and rhythmic at easy pace, deeper and faster as intervals intensify.', 'Reduce intensity gradually over the last couple of minutes rather than stopping outright.', ARRAY['cardio','full-body','interval','conditioning']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('stationary-bike', 'Stationary Bike', 'cardio', null, 'quadriceps', ARRAY['hamstrings','glutes']::text[], 'cardio_machine', 'beginner', 'A low-impact cardio modality on a stationary bike, useful for aerobic conditioning with minimal joint stress.', 'Set the seat height so the knee has a slight bend at the bottom of the pedal stroke.', 'Pedal at the prescribed cadence and resistance for the target duration or interval structure.', 'Match your breathing rate to effort — controlled and rhythmic at easy pace, deeper and faster as intervals intensify.', 'Reduce intensity gradually over the last couple of minutes rather than stopping outright.', ARRAY['cardio','low-impact','beginner-friendly']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('stairmaster', 'Stairmaster', 'cardio', null, 'glutes', ARRAY['quadriceps','calves']::text[], 'cardio_machine', 'beginner', 'A stepping cardio machine that heavily targets the glutes and quads while building lower-body conditioning.', 'Start the machine at an easy pace to find your rhythm before increasing to the target intensity.', 'Step at a steady, controlled pace for the prescribed duration, using light handrail contact for balance only, not support.', 'Match your breathing rate to effort — controlled and rhythmic at easy pace, deeper and faster as intervals intensify.', 'Reduce intensity gradually over the last couple of minutes rather than stopping outright.', ARRAY['cardio','glute-focus','conditioning']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('ski-erg', 'Ski Erg', 'cardio', null, 'full_body', ARRAY['back','shoulders','core']::text[], 'cardio_machine', 'intermediate', 'A full-body cardio modality using a double-pole skiing motion, heavily engaging the lats, core, and posterior chain.', 'Set the handles at a height where you can reach them with arms extended overhead.', 'Pull the handles down and back by hinging at the hips and driving the lats, then return to the overhead reach with control.', 'Match your breathing rate to effort — controlled and rhythmic at easy pace, deeper and faster as intervals intensify.', 'Reduce intensity gradually over the last couple of minutes rather than stopping outright.', ARRAY['cardio','full-body','lat-focus','machine']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('jump-rope', 'Jump Rope', 'cardio', null, 'calves', ARRAY['shoulders','forearms']::text[], 'bodyweight', 'beginner', 'A simple, portable cardio modality that builds coordination, calf endurance, and conditioning with just a rope.', 'Adjust the rope length so the handles reach roughly armpit height when standing on the middle of the rope.', 'Jump with small, controlled hops just high enough to clear the rope, turning the rope primarily with the wrists rather than the whole arm.', 'Match your breathing rate to effort — controlled and rhythmic at easy pace, deeper and faster as intervals intensify.', 'Reduce intensity gradually over the last couple of minutes rather than stopping outright.', ARRAY['cardio','coordination','conditioning','portable']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('hip-flexor-mobilization', 'Hip Flexor Mobilization', 'mobility', null, 'quadriceps', ARRAY['glutes']::text[], 'bodyweight', 'beginner', 'A kneeling drill that opens up the hip flexors, which often become tight from prolonged sitting and limit hip extension in squats and running.', 'Kneel in a half-kneeling position, back knee down and front foot flat on the floor.', 'Squeeze the glute of the down leg and shift the hips forward slightly until a stretch is felt in the front of the hip, holding or pulsing gently for the prescribed time.', 'Move with your breath — inhale to set up each rep, exhale as you move deeper into the range.', 'Return to the start position under control rather than releasing suddenly.', ARRAY['mobility','hip-flexors','warm-up']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('thoracic-spine-rotation', 'Thoracic Spine Rotation', 'mobility', 'rotation', 'back', ARRAY['shoulders']::text[], 'bodyweight', 'intermediate', 'A quadruped rotational drill that improves upper-back mobility, useful for anyone whose thoracic spine is stiff from sitting or heavy pressing.', 'Start on hands and knees, one hand behind the head with the elbow pointing down toward the opposite hand.', 'Rotate the elbow up and open the chest toward the ceiling, following the movement with the eyes, then return and repeat for reps before switching sides.', 'Move with your breath — inhale to set up each rep, exhale as you move deeper into the range.', 'Return to the start position under control rather than releasing suddenly.', ARRAY['mobility','thoracic-spine','warm-up']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('ankle-dorsiflexion-mobilization', 'Ankle Dorsiflexion Mobilization', 'mobility', null, 'calves', '{}'::text[], 'bodyweight', 'beginner', 'A half-kneeling drill that improves ankle dorsiflexion, a key limiting factor in squat depth and running mechanics.', 'Kneel in a half-kneeling position with the front foot a few inches from a wall.', 'Drive the front knee forward over the toes toward the wall without the heel lifting, holding briefly at end range before returning.', 'Move with your breath — inhale to set up each rep, exhale as you move deeper into the range.', 'Return to the start position under control rather than releasing suddenly.', ARRAY['mobility','ankle','warm-up']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('worlds-greatest-stretch', 'World''s Greatest Stretch', 'mobility', 'rotation', 'full_body', ARRAY['hamstrings','hip-flexors']::text[], 'bodyweight', 'intermediate', 'A multi-part dynamic stretch flowing through a lunge, rotation, and hamstring stretch — a popular full-body warm-up movement before training.', 'Step into a long lunge position with the back leg straight and both hands on the floor inside the front foot.', 'Rotate the front-side arm up toward the ceiling, following it with the eyes, then return the hand to the floor and straighten the front leg to add a hamstring stretch before repeating on the other side.', 'Move with your breath — inhale to set up each rep, exhale as you move deeper into the range.', 'Return to the start position under control rather than releasing suddenly.', ARRAY['mobility','full-body','dynamic','warm-up']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('cat-cow', 'Cat-Cow', 'mobility', null, 'back', ARRAY['core']::text[], 'bodyweight', 'beginner', 'A gentle quadruped spinal mobility flow alternating between flexion and extension, commonly used to warm up the spine.', 'Start on hands and knees with a neutral spine, hands under the shoulders and knees under the hips.', 'Alternate between arching the back and lifting the chest and tailbone (cow) and rounding the spine while tucking the chin and tailbone (cat), moving smoothly between the two.', 'Move with your breath — inhale to set up each rep, exhale as you move deeper into the range.', 'Return to the start position under control rather than releasing suddenly.', ARRAY['mobility','spine','warm-up','beginner-friendly']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('90-90-hip-switch', '90/90 Hip Switch', 'mobility', 'rotation', 'glutes', ARRAY['core']::text[], 'bodyweight', 'intermediate', 'A seated hip mobility drill that moves between internal and external rotation on both hips, useful for improving overall hip range of motion.', 'Sit with both knees bent to roughly 90 degrees, one leg rotated in front and one out to the side.', 'Lift both knees and rotate them to switch sides, landing in the mirrored 90/90 position, keeping the movement controlled rather than using momentum to flop over.', 'Move with your breath — inhale to set up each rep, exhale as you move deeper into the range.', 'Return to the start position under control rather than releasing suddenly.', ARRAY['mobility','hip-rotation','warm-up']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('standing-hamstring-stretch', 'Standing Hamstring Stretch', 'stretching', null, 'hamstrings', '{}'::text[], 'bodyweight', 'beginner', 'A standing static stretch for the hamstrings, commonly used post-workout or as part of a cooldown.', 'Place one heel on a low surface (or the floor) with the leg straight, keeping the standing leg slightly bent.', 'Hinge forward from the hips, keeping the front leg''s knee straight, until a stretch is felt through the back of the thigh, and hold for the prescribed time.', 'Breathe slowly and fully throughout the hold — each exhale is a chance to sink a little further into the stretch without forcing it.', 'Come out of the stretch slowly and under control rather than snapping back to the start.', ARRAY['stretching','hamstrings','cooldown','static']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('couch-stretch', 'Couch Stretch', 'stretching', null, 'quadriceps', ARRAY['hip-flexors']::text[], 'bodyweight', 'intermediate', 'A deep static stretch for the quadriceps and hip flexors performed with the rear foot elevated against a wall or couch.', 'Kneel with the back shin against a wall or couch, back foot pointing up, front foot flat on the floor.', 'Squeeze the glute of the back leg and gently shift the hips forward and upright until a stretch is felt through the front of the hip and thigh, holding for the prescribed time.', 'Breathe slowly and fully throughout the hold — each exhale is a chance to sink a little further into the stretch without forcing it.', 'Come out of the stretch slowly and under control rather than snapping back to the start.', ARRAY['stretching','quadriceps','hip-flexors','deep-stretch']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('doorway-chest-stretch', 'Doorway Chest Stretch', 'stretching', null, 'chest', ARRAY['shoulders']::text[], 'bodyweight', 'beginner', 'A simple static stretch using a doorway to open up the chest and front of the shoulders, useful for anyone who presses or sits a lot.', 'Stand in a doorway with the forearm braced against the frame, elbow at roughly shoulder height.', 'Step forward through the doorway until a stretch is felt across the chest and front shoulder, holding for the prescribed time before switching sides.', 'Breathe slowly and fully throughout the hold — each exhale is a chance to sink a little further into the stretch without forcing it.', 'Come out of the stretch slowly and under control rather than snapping back to the start.', ARRAY['stretching','chest','shoulders','cooldown']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('seated-figure-four-stretch', 'Seated Figure-Four Stretch', 'stretching', null, 'glutes', '{}'::text[], 'bodyweight', 'beginner', 'A seated static stretch that targets the glutes and hip rotators by crossing one ankle over the opposite knee.', 'Sit tall, cross one ankle over the opposite knee, forming a figure-4 shape with the legs.', 'Gently hinge forward from the hips while keeping the back flat until a stretch is felt in the glute of the crossed leg, holding for the prescribed time.', 'Breathe slowly and fully throughout the hold — each exhale is a chance to sink a little further into the stretch without forcing it.', 'Come out of the stretch slowly and under control rather than snapping back to the start.', ARRAY['stretching','glutes','hip-rotators','cooldown']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('childs-pose', 'Child''s Pose', 'stretching', null, 'back', ARRAY['shoulders']::text[], 'bodyweight', 'beginner', 'A gentle resting stretch for the lower back, hips, and shoulders, commonly used to close out a mobility or cooldown session.', 'Kneel with the big toes together and knees apart, then sit the hips back toward the heels.', 'Reach the arms forward along the floor and lower the chest toward the ground, holding the position and breathing deeply for the prescribed time.', 'Breathe slowly and fully throughout the hold — each exhale is a chance to sink a little further into the stretch without forcing it.', 'Come out of the stretch slowly and under control rather than snapping back to the start.', ARRAY['stretching','lower-back','cooldown','restorative']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('standing-quad-stretch', 'Standing Quad Stretch', 'stretching', null, 'quadriceps', '{}'::text[], 'bodyweight', 'beginner', 'A classic standing static stretch for the quadriceps, holding the ankle behind the body.', 'Stand tall, holding onto something for balance if needed, and grab one ankle behind you.', 'Pull the heel gently toward the glute while keeping the knees close together and the hips level, holding for the prescribed time before switching sides.', 'Breathe slowly and fully throughout the hold — each exhale is a chance to sink a little further into the stretch without forcing it.', 'Come out of the stretch slowly and under control rather than snapping back to the start.', ARRAY['stretching','quadriceps','cooldown','static']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('box-jump', 'Box Jump', 'plyometrics', 'jump', 'quadriceps', ARRAY['glutes','calves']::text[], 'bodyweight', 'intermediate', 'An explosive jumping movement onto an elevated box, training vertical power and the ability to absorb landing force.', 'Stand facing a box at a height you can land on with both feet softly, feet hip-width apart.', 'Dip the hips and swing the arms back, then explode upward and forward, landing softly on the box with knees bent, then step down (don''t jump down) between reps.', 'Exhale sharply on the explosive effort; take a full breath and reset between reps rather than rushing the next one.', 'Step back down off the box rather than jumping down, to protect the joints from repeated landing stress.', ARRAY['plyometric','power','explosive','lower-body']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('broad-jump', 'Broad Jump', 'plyometrics', 'jump', 'glutes', ARRAY['quadriceps','hamstrings']::text[], 'bodyweight', 'intermediate', 'A horizontal explosive jump for maximum distance, training hip and leg power in the horizontal plane.', 'Stand with feet hip-width apart, arms ready to swing back.', 'Swing the arms back and dip the hips, then explode forward and up, driving the arms forward, and land softly with bent knees, sticking the landing before resetting.', 'Exhale sharply on the explosive effort; take a full breath and reset between reps rather than rushing the next one.', 'Absorb the landing with soft knees and hips before resetting for the next rep — quality over speed.', ARRAY['plyometric','power','explosive','horizontal']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('depth-jump', 'Depth Jump', 'plyometrics', 'jump', 'quadriceps', ARRAY['glutes','calves']::text[], 'bodyweight', 'advanced', 'An advanced plyometric drill that steps off a box and immediately rebounds upon landing, training reactive strength and fast force absorption.', 'Stand on a low box (start conservative — 12-18 inches for most people).', 'Step off the box (don''t jump off), and the instant your feet touch the ground, explode immediately back up into a maximal vertical jump, minimizing ground contact time.', 'Exhale sharply on the explosive effort; take a full breath and reset between reps rather than rushing the next one.', 'Land the final jump softly with bent knees, then reset fully before the next rep.', ARRAY['plyometric','reactive-strength','advanced','power']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('lateral-bound', 'Lateral Bound', 'plyometrics', 'jump', 'glutes', ARRAY['quadriceps','hamstrings']::text[], 'bodyweight', 'intermediate', 'A single-leg lateral jump that trains explosive power and stability in the frontal plane, valuable for change-of-direction sports.', 'Stand on one leg with a slight bend in the knee and hip.', 'Push off explosively to the side, landing on the opposite leg with a soft, stable landing, then immediately bound back the other way.', 'Exhale sharply on the explosive effort; take a full breath and reset between reps rather than rushing the next one.', 'Stick each landing for a full second before the next bound, especially early in training this pattern.', ARRAY['plyometric','lateral','unilateral','power']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('tuck-jump', 'Tuck Jump', 'plyometrics', 'jump', 'quadriceps', ARRAY['glutes','core']::text[], 'bodyweight', 'intermediate', 'A vertical jump bringing the knees up toward the chest at peak height, training explosive power and hip flexor speed.', 'Stand with feet hip-width apart, knees slightly bent.', 'Jump straight up explosively, driving both knees up toward the chest at the top of the jump, then land softly with bent knees ready for the next rep.', 'Exhale sharply on the explosive effort; take a full breath and reset between reps rather than rushing the next one.', 'Absorb the landing with soft knees and hips before resetting for the next rep — quality over speed.', ARRAY['plyometric','power','explosive','core']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('plyo-push-up', 'Plyo Push-Up', 'plyometrics', 'push', 'chest', ARRAY['triceps','shoulders']::text[], 'bodyweight', 'advanced', 'An explosive push-up variation where the hands leave the floor at the top, building upper-body power.', 'Set up in a standard push-up position, body in a straight line.', 'Lower under control as in a normal push-up, then explode upward hard enough that the hands leave the floor briefly, landing softly with bent elbows to absorb the impact.', 'Exhale sharply on the explosive effort; take a full breath and reset between reps rather than rushing the next one.', 'Absorb the landing with soft knees and hips before resetting for the next rep — quality over speed.', ARRAY['plyometric','upper-body-power','advanced']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('power-clean', 'Power Clean', 'olympic_lifting', 'pull', 'full_body', ARRAY['quadriceps','back','shoulders']::text[], 'barbell', 'advanced', 'An explosive full-body pull that catches the bar in a partial-depth squat on the front of the shoulders — trains total-body power production.', 'Set up over the bar as in a deadlift, shins close to the bar, hips slightly higher than a deadlift start, shoulders over the bar.', 'Pull the bar from the floor, accelerating hard as it passes the knees, extend violently through the hips (triple extension), then pull yourself under the bar to catch it on the front of the shoulders in a quarter-squat.', 'Take a full brace-and-breath at the start position before initiating the pull; exhale explosively as you finish the extension.', 'Stand the bar up fully once caught, under control.', ARRAY['barbell','olympic-lift','power','full-body','advanced']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('hang-clean', 'Hang Clean', 'olympic_lifting', 'pull', 'full_body', ARRAY['quadriceps','back','shoulders']::text[], 'barbell', 'advanced', 'A clean variation starting from a hang position above the knee rather than the floor, isolating the explosive second-pull portion of the lift.', 'Start standing with the bar at mid-thigh, hips hinged slightly back, shoulders over the bar.', 'Explosively extend the hips (triple extension) to accelerate the bar upward, then pull yourself under to catch it on the front of the shoulders in a quarter-squat.', 'Take a full brace-and-breath at the start position before initiating the pull; exhale explosively as you finish the extension.', 'Stand the bar up fully once caught, under control.', ARRAY['barbell','olympic-lift','power','advanced']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('snatch', 'Snatch', 'olympic_lifting', 'pull', 'full_body', ARRAY['shoulders','back','quadriceps']::text[], 'barbell', 'advanced', 'The most technical Olympic lift — a single explosive pull that takes the bar from the floor directly overhead in one motion.', 'Set up over the bar with a wide, snatch-width grip, shins close to the bar, hips slightly higher than a deadlift start.', 'Pull the bar from the floor, accelerating hard past the knees, extend violently through the hips, then pull yourself under the bar to catch it overhead in a full squat with arms locked out.', 'Take a full brace-and-breath at the start position before initiating the pull; exhale explosively as you finish the extension.', 'Stand the bar up fully once caught, with the bar stacked over the mid-foot.', ARRAY['barbell','olympic-lift','power','technical','advanced']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('clean-and-jerk', 'Clean and Jerk', 'olympic_lifting', 'pull', 'full_body', ARRAY['quadriceps','back','shoulders']::text[], 'barbell', 'advanced', 'A two-part Olympic lift combining a clean (bar to the shoulders) with a jerk (bar driven overhead) — the ultimate test of total-body power.', 'Set up over the bar as for a clean, then after catching and standing the clean up, reset the feet under the hips for the jerk.', 'Complete the clean to the shoulders, stand it up fully, then dip the knees slightly and drive the bar overhead explosively, splitting or squatting the feet to receive it locked out overhead.', 'Take a full brace-and-breath at the start position before initiating the pull; exhale explosively as you finish the extension.', 'Stand the feet back together with the bar locked out fully overhead before lowering it back down.', ARRAY['barbell','olympic-lift','power','technical','advanced','competition-lift']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('push-press', 'Push Press', 'olympic_lifting', 'push', 'shoulders', ARRAY['triceps','quadriceps']::text[], 'barbell', 'intermediate', 'An overhead press that uses a slight leg drive to help move heavier loads than a strict press, bridging strength and power work.', 'Stand with the bar racked at the front of the shoulders, feet hip-width apart.', 'Dip the knees slightly and drive straight up through the legs, using that momentum to help press the bar overhead to full lockout.', 'Take a full brace-and-breath at the start position before initiating the pull; exhale explosively as you finish the extension.', 'Finish with the bar stacked over the mid-foot and the arms fully locked out.', ARRAY['barbell','power','shoulder-focus']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('clean-pull', 'Clean Pull', 'olympic_lifting', 'pull', 'back', ARRAY['quadriceps','hamstrings']::text[], 'barbell', 'advanced', 'A clean without the catch — pulling the bar explosively through full extension and shrugging tall, used to build pulling strength and power for the full clean.', 'Set up exactly as for a clean, shins close to the bar, hips slightly higher than a deadlift start.', 'Pull the bar from the floor, accelerating hard past the knees, then finish with a violent hip extension and a tall shrug, without bending the arms to pull under.', 'Take a full brace-and-breath at the start position before initiating the pull; exhale explosively as you finish the extension.', 'Let the bar settle back to the floor under control after the extension.', ARRAY['barbell','olympic-lift','pulling-strength','accessory']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('kettlebell-turkish-get-up', 'Turkish Get-Up', 'strength', null, 'full_body', ARRAY['shoulders','core','glutes']::text[], 'kettlebell', 'advanced', 'A slow, multi-step movement from lying to standing while holding a kettlebell locked out overhead — builds shoulder stability, core control, and total-body coordination.', 'Lie on your back holding a light kettlebell locked out overhead in one hand, same-side knee bent, opposite arm and leg out at 45 degrees.', 'Move through each checkpoint deliberately — press to an elbow, then a hand, lift the hips through to a bridge, sweep the back leg through to kneeling, then stand up — keeping the kettlebell locked out overhead throughout.', 'Take a full breath and brace before each checkpoint transition; exhale as you move through the harder positions.', 'Reverse the same checkpoints in order to return to the floor under control rather than dropping into the lying position.', ARRAY['kettlebell','full-body','shoulder-stability','advanced','coordination']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('band-pull-apart', 'Band Pull-Apart', 'strength', 'pull', 'shoulders', ARRAY['back']::text[], 'resistance_band', 'beginner', 'A simple resistance-band exercise for the rear delts and upper back, commonly used as a warm-up or high-volume accessory movement.', 'Hold a resistance band with both hands at shoulder height, arms extended straight in front of you, hands shoulder-width apart.', 'Pull the band apart by driving the arms out to the sides, squeezing the shoulder blades together, then return to the start under control.', 'Exhale as you pull the band apart, inhale as you return to the start.', 'Finish with the arms fully extended out to the sides and the shoulder blades squeezed together.', ARRAY['resistance-band','warm-up','rear-delt-focus','high-volume']::text[], null)
on conflict (id) do nothing;
insert into public.exercises (id, name, category, movement_pattern, primary_muscle_group, secondary_muscle_groups, equipment, difficulty, description, instructions_setup, instructions_execution, instructions_breathing, instructions_finishing, tags, owner_id) values
  ('medicine-ball-slam', 'Medicine Ball Slam', 'plyometrics', 'throw', 'core', ARRAY['shoulders','full_body']::text[], 'medicine_ball', 'intermediate', 'An explosive full-body throwing movement that slams a medicine ball into the floor with maximum force — trains power output and is a great way to safely express aggression/intensity in training.', 'Stand with feet shoulder-width apart, holding a medicine ball overhead with both hands, arms fully extended.', 'Explosively slam the ball straight down into the floor in front of you, driving through the core and hips, then catch the rebound or pick it back up to reset for the next rep.', 'Take a full breath overhead, exhale sharply and forcefully at the moment of the slam.', 'Reset fully between reps — pick the ball back up and return to the overhead start position before the next slam.', ARRAY['medicine-ball','explosive','power','full-body','conditioning']::text[], null)
on conflict (id) do nothing;

-- ============================================================
-- exercise_coaching_cues
-- ============================================================

delete from public.exercise_coaching_cues where exercise_id in (select id from public.exercises where owner_id is null);
insert into public.exercise_coaching_cues (exercise_id, cue, position) values
  ('bodyweight-squat', 'Push the knees out in line with the toes', 0),
  ('bodyweight-squat', 'Keep the chest proud and the weight through the heels', 1),
  ('bodyweight-squat', 'Sit back like you''re reaching for a chair', 2),
  ('jump-squat', 'Load the hips like a normal squat before exploding up', 0),
  ('jump-squat', 'Swing the arms up to help drive the jump', 1),
  ('jump-squat', 'Land soft with bent knees, straight into the next rep', 2),
  ('bulgarian-split-squat', 'Keep most of the weight on the front leg', 0),
  ('bulgarian-split-squat', 'Drive straight up through the front heel', 1),
  ('bulgarian-split-squat', 'Keep the front knee tracking over the front foot, not caving in', 2),
  ('walking-lunge', 'Take a long enough step that the front shin stays vertical', 0),
  ('walking-lunge', 'Keep the torso tall rather than leaning forward', 1),
  ('walking-lunge', 'Push off the front heel to drive into the next step', 2),
  ('goblet-squat', 'Keep the dumbbell close to the chest the whole rep', 0),
  ('goblet-squat', 'Use your elbows brushing your knees as a depth check', 1),
  ('goblet-squat', 'Drive the floor away rather than just standing the weight up', 2),
  ('dumbbell-lunge', 'Keep the dumbbells hanging straight down, not swinging', 0),
  ('dumbbell-lunge', 'Drive through the front heel to stand', 1),
  ('dumbbell-lunge', 'Keep the torso stacked over the hips, not leaning forward', 2),
  ('barbell-back-squat', 'Brace hard before unracking and keep that brace all the way down', 0),
  ('barbell-back-squat', 'Drive the knees out in line with the toes', 1),
  ('barbell-back-squat', 'Keep the bar path vertical over the middle of the foot', 2),
  ('barbell-front-squat', 'Keep the elbows lifted high the entire rep', 0),
  ('barbell-front-squat', 'Stay taller through the torso than a back squat', 1),
  ('barbell-front-squat', 'Keep the bar balanced over the mid-foot', 2),
  ('leg-press', 'Keep the lower back flat against the pad the whole set', 0),
  ('leg-press', 'Press through the whole foot, not just the toes', 1),
  ('leg-press', 'Stop the descent before the hips start to round off the pad', 2),
  ('leg-extension', 'Control the weight down rather than letting it drop', 0),
  ('leg-extension', 'Squeeze the quads hard at the top of each rep', 1),
  ('leg-extension', 'Keep the hips pinned to the seat throughout', 2),
  ('glute-bridge', 'Squeeze the glutes hard at the top rather than just lifting the hips', 0),
  ('glute-bridge', 'Keep the ribs down, don''t overextend the lower back', 1),
  ('glute-bridge', 'Push through the heels, not the toes', 2),
  ('single-leg-glute-bridge', 'Keep the hips square, don''t let one side drop', 0),
  ('single-leg-glute-bridge', 'Drive through the single planted heel', 1),
  ('single-leg-glute-bridge', 'Keep the extended leg relaxed rather than fighting for height', 2),
  ('single-leg-rdl-bodyweight', 'Keep the hips square to the floor throughout', 0),
  ('single-leg-rdl-bodyweight', 'Reach the free leg straight back as the torso tips forward', 1),
  ('single-leg-rdl-bodyweight', 'Keep a slight bend in the standing knee the whole rep', 2),
  ('dumbbell-rdl', 'Keep the dumbbells brushing the legs on the way down', 0),
  ('dumbbell-rdl', 'Push the hips straight back, not down', 1),
  ('dumbbell-rdl', 'Keep a soft bend in the knees throughout, don''t turn it into a squat', 2),
  ('dumbbell-hip-thrust', 'Tuck the chin slightly and drive through the heels', 0),
  ('dumbbell-hip-thrust', 'Squeeze the glutes hard and pause briefly at the top', 1),
  ('dumbbell-hip-thrust', 'Keep the ribs down through the whole rep', 2),
  ('dumbbell-swing', 'Snap the hips forward hard to drive the swing, don''t lift with the arms', 0),
  ('dumbbell-swing', 'Keep the arms relaxed — they just guide the weight', 1),
  ('dumbbell-swing', 'Let the weight float, don''t muscle it up to shoulder height', 2),
  ('barbell-rdl', 'Keep the bar dragging up the legs, not drifting forward', 0),
  ('barbell-rdl', 'Push the hips back as the primary movement, not the knees bending', 1),
  ('barbell-rdl', 'Stop the descent once the hamstrings are fully stretched and the back starts to round', 2),
  ('barbell-deadlift', 'Take the slack out of the bar before pulling', 0),
  ('barbell-deadlift', 'Push the floor away with your legs rather than yanking with the back', 1),
  ('barbell-deadlift', 'Keep the bar in contact with the legs throughout the pull', 2),
  ('barbell-good-morning', 'Keep the knee bend constant throughout, don''t let it turn into a squat', 0),
  ('barbell-good-morning', 'Push the hips back first before the torso tips', 1),
  ('barbell-good-morning', 'Only go as low as the back can stay flat', 2),
  ('leg-curl-machine', 'Curl the weight up with control, don''t jerk it', 0),
  ('leg-curl-machine', 'Lower the weight back down slowly rather than letting it drop', 1),
  ('leg-curl-machine', 'Keep the hips pinned to the pad throughout', 2),
  ('push-up', 'Keep the body in one straight line, don''t let the hips sag or pike up', 0),
  ('push-up', 'Keep the elbows at roughly 45 degrees, not flared straight out', 1),
  ('push-up', 'Push the floor away rather than just straightening the arms', 2),
  ('incline-push-up', 'Keep the same straight body line as a full push-up', 0),
  ('incline-push-up', 'Lower the elevation over time as you get stronger', 1),
  ('incline-push-up', 'Keep the elbows at roughly 45 degrees', 2),
  ('decline-push-up', 'Keep the body rigid even with the feet elevated', 0),
  ('decline-push-up', 'Don''t let the higher foot position turn into a pike', 1),
  ('decline-push-up', 'Control the descent rather than dropping', 2),
  ('dumbbell-bench-press', 'Keep the shoulder blades pulled together and down on the bench', 0),
  ('dumbbell-bench-press', 'Press the dumbbells in a slight arc, not straight up', 1),
  ('dumbbell-bench-press', 'Control the dumbbells down rather than letting them drop', 2),
  ('dumbbell-floor-press', 'Let the upper arms rest briefly on the floor between reps', 0),
  ('dumbbell-floor-press', 'Press in a slight arc back up to the start', 1),
  ('dumbbell-floor-press', 'Keep the wrists stacked directly over the elbows', 2),
  ('dumbbell-chest-fly', 'Keep a soft, fixed bend in the elbows throughout', 0),
  ('dumbbell-chest-fly', 'Lower the dumbbells in a wide arc, not straight down', 1),
  ('dumbbell-chest-fly', 'Squeeze the chest to bring the arms back together', 2),
  ('barbell-bench-press', 'Set the shoulder blades pulled together and down before unracking', 0),
  ('barbell-bench-press', 'Keep the feet driving into the floor for a stable base', 1),
  ('barbell-bench-press', 'Touch the chest lightly, don''t bounce the bar', 2),
  ('chest-press-machine', 'Keep the shoulder blades pinned to the pad', 0),
  ('chest-press-machine', 'Press out fully without locking the elbows hard', 1),
  ('chest-press-machine', 'Control the return rather than letting the weight stack slam', 2),
  ('cable-chest-fly', 'Keep a soft, fixed bend in the elbows', 0),
  ('cable-chest-fly', 'Lead with the hands meeting in front of the chest, not the shoulders rounding forward', 1),
  ('cable-chest-fly', 'Control the stretch back out rather than letting the cables yank the arms back', 2),
  ('pike-push-up', 'Keep the hips high throughout, don''t let the pike flatten out', 0),
  ('pike-push-up', 'Aim the crown of the head toward the floor between the hands', 1),
  ('pike-push-up', 'Press through the whole hand, not just the fingers', 2),
  ('dumbbell-shoulder-press', 'Brace the core to keep the ribs from flaring', 0),
  ('dumbbell-shoulder-press', 'Press the dumbbells slightly inward toward each other at the top', 1),
  ('dumbbell-shoulder-press', 'Keep the wrists stacked over the elbows throughout', 2),
  ('dumbbell-arnold-press', 'Rotate the palms outward as you press, finishing facing forward', 0),
  ('dumbbell-arnold-press', 'Keep the rotation smooth and controlled, not rushed', 1),
  ('dumbbell-arnold-press', 'Brace the core to avoid arching the back', 2),
  ('dumbbell-lateral-raise', 'Lead with the elbows, not the hands', 0),
  ('dumbbell-lateral-raise', 'Raise to roughly shoulder height, not higher', 1),
  ('dumbbell-lateral-raise', 'Control the descent rather than letting the arms drop', 2),
  ('barbell-overhead-press', 'Squeeze the glutes and brace the core to avoid arching the back', 0),
  ('barbell-overhead-press', 'Move the head back slightly to let the bar pass, then push it through at the top', 1),
  ('barbell-overhead-press', 'Finish with the bar stacked directly over the mid-foot', 2),
  ('machine-shoulder-press', 'Keep the back flat against the pad throughout', 0),
  ('machine-shoulder-press', 'Press up without shrugging the shoulders', 1),
  ('machine-shoulder-press', 'Control the weight back down rather than letting it drop', 2),
  ('cable-lateral-raise', 'Lead with the elbow, keeping a soft bend throughout', 0),
  ('cable-lateral-raise', 'Raise to roughly shoulder height', 1),
  ('cable-lateral-raise', 'Keep the torso still, don''t lean away from the cable to cheat the weight up', 2),
  ('inverted-row', 'Keep the body in one straight line throughout', 0),
  ('inverted-row', 'Pull the chest to the bar, not just the chin', 1),
  ('inverted-row', 'Squeeze the shoulder blades together at the top', 2),
  ('dumbbell-row', 'Pull the elbow back and up rather than out to the side', 0),
  ('dumbbell-row', 'Keep the torso still, don''t rotate to help the pull', 1),
  ('dumbbell-row', 'Lower the dumbbell all the way down for a full stretch', 2),
  ('dumbbell-renegade-row', 'Keep the hips square, resist rotating as you row', 0),
  ('dumbbell-renegade-row', 'Widen the stance for more stability if needed', 1),
  ('dumbbell-renegade-row', 'Row with control rather than yanking the weight up', 2),
  ('barbell-row', 'Hold the hinge position steady, don''t let the torso rise as you fatigue', 0),
  ('barbell-row', 'Pull the bar to the lower ribs/upper stomach', 1),
  ('barbell-row', 'Keep the core braced to protect the lower back', 2),
  ('seated-cable-row', 'Keep the torso upright, don''t lean back to yank the weight', 0),
  ('seated-cable-row', 'Pull the handle to the lower stomach, elbows close to the body', 1),
  ('seated-cable-row', 'Let the shoulder blades protract fully on the stretch', 2),
  ('chest-supported-row-machine', 'Keep the chest pinned to the pad throughout', 0),
  ('chest-supported-row-machine', 'Drive the elbows back and squeeze the shoulder blades', 1),
  ('chest-supported-row-machine', 'Control the weight back to a full stretch', 2),
  ('rear-delt-fly-machine', 'Lead with the elbows, keep a soft bend in the arms', 0),
  ('rear-delt-fly-machine', 'Squeeze the shoulder blades together at the back of the movement', 1),
  ('rear-delt-fly-machine', 'Control the return rather than letting the weight snap forward', 2),
  ('pull-up', 'Start from a full dead hang each rep', 0),
  ('pull-up', 'Drive the elbows down and back rather than just curling up', 1),
  ('pull-up', 'Avoid excessive kipping/swinging on strict sets', 2),
  ('chin-up', 'Start from a full dead hang each rep', 0),
  ('chin-up', 'Pull the chest up toward the bar', 1),
  ('chin-up', 'Lower under control rather than dropping', 2),
  ('dumbbell-pullover', 'Keep a fixed, soft bend in the elbows throughout', 0),
  ('dumbbell-pullover', 'Lower the dumbbell back behind the head in an arc', 1),
  ('dumbbell-pullover', 'Lead the movement with the lats, not the arms', 2),
  ('lat-pulldown', 'Lean back slightly and pull the bar to the upper chest', 0),
  ('lat-pulldown', 'Drive the elbows down and back', 1),
  ('lat-pulldown', 'Avoid using momentum by leaning back too far', 2),
  ('assisted-pull-up-machine', 'Use just enough assistance to complete full-range reps', 0),
  ('assisted-pull-up-machine', 'Pull the chest toward the handles, not just the chin', 1),
  ('assisted-pull-up-machine', 'Reduce the assistance over time as you get stronger', 2),
  ('straight-arm-pulldown', 'Keep the arms straight throughout, elbows barely bending', 0),
  ('straight-arm-pulldown', 'Pull down in an arc to the thighs, leading with the lats', 1),
  ('straight-arm-pulldown', 'Control the return back to the start', 2),
  ('plank', 'Squeeze the glutes and brace the core the whole hold', 0),
  ('plank', 'Keep the head in a neutral line with the spine', 1),
  ('plank', 'Stop the set once the hips start to sag', 2),
  ('side-plank', 'Stack the shoulders and hips directly over each other', 0),
  ('side-plank', 'Push the hips up rather than just forward', 1),
  ('side-plank', 'Keep the top hip stacked, don''t let it roll forward or back', 2),
  ('dead-bug', 'Keep the lower back pressed flat into the floor the whole time', 0),
  ('dead-bug', 'Move slowly and with control, not fast', 1),
  ('dead-bug', 'Only lower the arm and leg as far as the back can stay flat', 2),
  ('bird-dog', 'Keep the hips level, don''t let them rotate toward the moving leg', 0),
  ('bird-dog', 'Reach long through the fingertips and heel, not just lifting', 1),
  ('bird-dog', 'Move slowly rather than swinging the limbs up', 2),
  ('hanging-knee-raise', 'Curl the pelvis under rather than just swinging the legs up', 0),
  ('hanging-knee-raise', 'Control the descent instead of letting the legs drop', 1),
  ('hanging-knee-raise', 'Minimize body swing throughout the set', 2),
  ('russian-twist', 'Rotate from the torso, not just the arms', 0),
  ('russian-twist', 'Keep the chest lifted throughout, don''t round forward', 1),
  ('russian-twist', 'Control the speed rather than whipping side to side', 2),
  ('weighted-russian-twist', 'Keep the dumbbell close to the body through the rotation', 0),
  ('weighted-russian-twist', 'Rotate from the torso, not just swinging the arms', 1),
  ('weighted-russian-twist', 'Keep the chest lifted throughout', 2),
  ('weighted-sit-up', 'Curl up vertebra by vertebra rather than yanking up', 0),
  ('weighted-sit-up', 'Keep the dumbbell close to the chest throughout', 1),
  ('weighted-sit-up', 'Lower back down with control, not a free-fall', 2),
  ('cable-crunch', 'Crunch by flexing the spine, not just bending at the hips', 0),
  ('cable-crunch', 'Keep the hips relatively still, let the rib cage do the moving', 1),
  ('cable-crunch', 'Squeeze the abs hard at the bottom of each rep', 2),
  ('farmers-carry', 'Keep the shoulders pulled back, don''t let them round forward', 0),
  ('farmers-carry', 'Take controlled, purposeful steps', 1),
  ('farmers-carry', 'Brace the core like you''re about to be tapped in the stomach', 2),
  ('suitcase-carry', 'Resist leaning toward the loaded side', 0),
  ('suitcase-carry', 'Keep both shoulders level throughout the walk', 1),
  ('suitcase-carry', 'Brace the core hard on the loaded side', 2),
  ('waiters-carry', 'Keep the wrist stacked directly over the shoulder throughout', 0),
  ('waiters-carry', 'Brace the core to avoid leaning away from the load', 1),
  ('waiters-carry', 'Keep the arm locked out, don''t let the elbow bend under fatigue', 2),
  ('easy-run', 'Keep the pace conversational the entire run', 0),
  ('easy-run', 'Let cadence stay light and quick rather than long, heavy strides', 1),
  ('easy-run', 'Resist the urge to speed up just because you feel good', 2),
  ('tempo-run', 'Aim for an effort you could just barely hold a short sentence at', 0),
  ('tempo-run', 'Start conservatively — it''s easy to go out too fast on tempo pace', 1),
  ('tempo-run', 'Keep the effort steady rather than surging and slowing', 2),
  ('interval-400m', 'Hold the same pace across every rep rather than fading', 0),
  ('interval-400m', 'Use the recovery interval fully — don''t rush into the next rep', 1),
  ('interval-400m', 'Keep the effort controlled and fast, not an all-out sprint that falls apart by rep three', 2),
  ('long-run', 'Start slower than feels necessary — long runs are earned in the back half', 0),
  ('long-run', 'Practice race-day fueling/hydration on longer efforts', 1),
  ('long-run', 'Let form loosen slightly late in the run rather than forcing perfect mechanics through fatigue', 2),
  ('hill-sprints', 'Drive the knees up and pump the arms aggressively', 0),
  ('hill-sprints', 'Walk all the way back down for full recovery, don''t jog it', 1),
  ('hill-sprints', 'Prioritize quality over quantity — stop if sprint mechanics start to break down', 2),
  ('fartlek-run', 'Let effort guide the surges rather than sticking to a rigid structure', 0),
  ('fartlek-run', 'Keep recovery segments genuinely easy', 1),
  ('fartlek-run', 'Use landmarks (a tree, a lamppost) to make surges feel more natural', 2),
  ('rowing-erg', 'Drive with the legs first, not the arms', 0),
  ('rowing-erg', 'Keep the sequence consistent: legs-back-arms on the drive', 1),
  ('rowing-erg', 'Control the recovery, don''t rush back to the catch', 2),
  ('assault-bike', 'Push and pull evenly with both arms and legs', 0),
  ('assault-bike', 'Keep the torso relatively stable rather than rocking excessively', 1),
  ('assault-bike', 'Pace intervals evenly rather than starting too hard', 2),
  ('stationary-bike', 'Keep a smooth, circular pedal stroke rather than just stomping down', 0),
  ('stationary-bike', 'Maintain a stable, relaxed upper body', 1),
  ('stationary-bike', 'Adjust resistance rather than only cadence to control intensity', 2),
  ('stairmaster', 'Stand tall rather than leaning heavily on the rails', 0),
  ('stairmaster', 'Use full steps rather than tiny, rushed ones', 1),
  ('stairmaster', 'Keep a steady rhythm rather than surging and slowing', 2),
  ('ski-erg', 'Hinge at the hips to add power, don''t just use the arms', 0),
  ('ski-erg', 'Drive down through the lats, not just pulling with the arms', 1),
  ('ski-erg', 'Keep the core braced through each pull', 2),
  ('jump-rope', 'Keep jumps small and low, just clearing the rope', 0),
  ('jump-rope', 'Turn the rope from the wrists, not big arm circles', 1),
  ('jump-rope', 'Stay light on the feet rather than landing flat and hard', 2),
  ('hip-flexor-mobilization', 'Squeeze the glute of the back leg to deepen the stretch', 0),
  ('hip-flexor-mobilization', 'Keep the torso tall rather than leaning forward', 1),
  ('hip-flexor-mobilization', 'Move into the stretch gradually rather than forcing it', 2),
  ('thoracic-spine-rotation', 'Keep the hips still, isolate the rotation to the upper back', 0),
  ('thoracic-spine-rotation', 'Follow the movement with your eyes to encourage a full rotation', 1),
  ('thoracic-spine-rotation', 'Move slowly rather than swinging through the range', 2),
  ('ankle-dorsiflexion-mobilization', 'Keep the heel glued to the floor throughout', 0),
  ('ankle-dorsiflexion-mobilization', 'Drive the knee toward the wall, tracking over the toes', 1),
  ('ankle-dorsiflexion-mobilization', 'Move to end range gradually rather than forcing it', 2),
  ('worlds-greatest-stretch', 'Keep the back leg straight throughout for a full hip flexor stretch', 0),
  ('worlds-greatest-stretch', 'Rotate through the upper back on the arm reach, not just the shoulder', 1),
  ('worlds-greatest-stretch', 'Move through each position with control rather than rushing', 2),
  ('cat-cow', 'Move slowly and let the movement flow segment by segment through the spine', 0),
  ('cat-cow', 'Coordinate the breath with the movement', 1),
  ('cat-cow', 'Keep the arms and hips relatively still, let the spine do the moving', 2),
  ('90-90-hip-switch', 'Keep the chest tall rather than collapsing forward', 0),
  ('90-90-hip-switch', 'Control the switch, don''t just fall from side to side', 1),
  ('90-90-hip-switch', 'Keep both shins on the ground once settled in each position', 2),
  ('standing-hamstring-stretch', 'Hinge from the hips, not by rounding the upper back', 0),
  ('standing-hamstring-stretch', 'Keep the front knee straight but not locked hard', 1),
  ('standing-hamstring-stretch', 'Ease into the stretch rather than bouncing', 2),
  ('couch-stretch', 'Squeeze the back glute to deepen the hip flexor portion', 0),
  ('couch-stretch', 'Keep the torso as upright as the stretch allows', 1),
  ('couch-stretch', 'Ease in gradually — this stretch is intense for most people', 2),
  ('doorway-chest-stretch', 'Keep the forearm firmly against the door frame', 0),
  ('doorway-chest-stretch', 'Step through slowly rather than lunging in hard', 1),
  ('doorway-chest-stretch', 'Keep the torso upright, don''t lean the head forward', 2),
  ('seated-figure-four-stretch', 'Keep the back flat as you hinge forward', 0),
  ('seated-figure-four-stretch', 'Keep the crossed ankle relaxed rather than flexed hard', 1),
  ('seated-figure-four-stretch', 'Hinge from the hips, not by rounding the shoulders', 2),
  ('childs-pose', 'Sit the hips back toward the heels as far as comfortable', 0),
  ('childs-pose', 'Let the arms relax forward rather than pressing hard into the floor', 1),
  ('childs-pose', 'Breathe deeply into the lower back throughout the hold', 2),
  ('standing-quad-stretch', 'Keep the knees close together throughout', 0),
  ('standing-quad-stretch', 'Keep the hips level, don''t let the pulled-up leg''s hip rotate out', 1),
  ('standing-quad-stretch', 'Stand tall rather than leaning forward to compensate for balance', 2),
  ('box-jump', 'Land softly with the knees bent, absorbing the impact', 0),
  ('box-jump', 'Step down off the box, never jump down', 1),
  ('box-jump', 'Choose a box height you can stick the landing on consistently', 2),
  ('broad-jump', 'Swing the arms aggressively forward to add distance', 0),
  ('broad-jump', 'Land with bent knees and stick the landing before moving', 1),
  ('broad-jump', 'Rest fully between reps to keep quality high', 2),
  ('depth-jump', 'Minimize the time your feet spend on the ground between landing and jumping', 0),
  ('depth-jump', 'Step off the box, don''t jump off it', 1),
  ('depth-jump', 'Only progress box height once ground contact time stays short at the current height', 2),
  ('lateral-bound', 'Stick the landing on one leg before bounding back', 0),
  ('lateral-bound', 'Push off explosively through the whole foot', 1),
  ('lateral-bound', 'Keep the landing knee tracking over the foot, not caving in', 2),
  ('tuck-jump', 'Drive the knees up hard and fast at the top of the jump', 0),
  ('tuck-jump', 'Land soft with bent knees every time', 1),
  ('tuck-jump', 'Keep the torso upright rather than folding forward to meet the knees', 2),
  ('plyo-push-up', 'Keep the body rigid throughout, even through the explosive phase', 0),
  ('plyo-push-up', 'Land with soft, bent elbows to absorb the impact', 1),
  ('plyo-push-up', 'Only attempt this once standard push-ups are comfortably strong', 2),
  ('power-clean', 'Keep the bar close to the body throughout the pull', 0),
  ('power-clean', 'Extend the hips violently at the top of the pull before catching', 1),
  ('power-clean', 'Catch the bar with elbows fast and high, not lagging behind', 2),
  ('hang-clean', 'Keep the bar close against the thighs during the hang position', 0),
  ('hang-clean', 'Explode the hips forward hard before pulling with the arms', 1),
  ('hang-clean', 'Catch with the elbows high and fast', 2),
  ('snatch', 'Keep the bar close to the body the entire pull', 0),
  ('snatch', 'Finish full hip extension before pulling yourself under', 1),
  ('snatch', 'Catch overhead with the arms locked and the bar stacked over the mid-foot', 2),
  ('clean-and-jerk', 'Reset your breath and stance between the clean and the jerk', 0),
  ('clean-and-jerk', 'Keep the dip for the jerk short and vertical, not a deep squat', 1),
  ('clean-and-jerk', 'Drive the bar straight up, then get the body under it fast', 2),
  ('push-press', 'Keep the dip short and vertical, not a squat', 0),
  ('push-press', 'Drive the legs first, then finish with the arms', 1),
  ('push-press', 'Keep the bar path close to the face on the way up', 2),
  ('clean-pull', 'Keep the bar close to the body throughout the pull', 0),
  ('clean-pull', 'Finish with a tall, aggressive shrug at full hip extension', 1),
  ('clean-pull', 'Don''t bend the arms — this is a pull, not a clean', 2),
  ('kettlebell-turkish-get-up', 'Keep your eyes on the kettlebell throughout the entire movement', 0),
  ('kettlebell-turkish-get-up', 'Move through each checkpoint slowly and deliberately, don''t rush', 1),
  ('kettlebell-turkish-get-up', 'Keep the overhead arm locked out and vertical at every stage', 2),
  ('band-pull-apart', 'Keep the arms straight throughout, don''t let the elbows bend', 0),
  ('band-pull-apart', 'Squeeze the shoulder blades together at the end range', 1),
  ('band-pull-apart', 'Control the return, don''t let the band snap the arms back', 2),
  ('medicine-ball-slam', 'Drive the slam with the hips and core, not just the arms', 0),
  ('medicine-ball-slam', 'Fully extend overhead before initiating each slam', 1),
  ('medicine-ball-slam', 'Slam with intent — this is a maximal-effort movement, not a light toss', 2);

-- ============================================================
-- exercise_common_mistakes
-- ============================================================

delete from public.exercise_common_mistakes where exercise_id in (select id from public.exercises where owner_id is null);
insert into public.exercise_common_mistakes (exercise_id, mistake, correction, position) values
  ('bodyweight-squat', 'Knees collapsing inward on the way up', 'Actively push the knees out toward the toes throughout the rep', 0),
  ('bodyweight-squat', 'Heels lifting off the floor', 'Shift more weight back into the heels and slow the descent', 1),
  ('jump-squat', 'Landing with stiff, locked knees', 'Land with the knees bent to absorb force, sinking straight into the next squat', 0),
  ('jump-squat', 'Only using the knees to jump, not the hips', 'Drive the hips forward at takeoff, not just extend the knees', 1),
  ('bulgarian-split-squat', 'Front knee traveling too far past the toes', 'Set up with the front foot further forward so the shin stays closer to vertical', 0),
  ('bulgarian-split-squat', 'Torso tipping too far forward', 'Keep the chest lifted and brace the core to stay more upright', 1),
  ('walking-lunge', 'Steps too short, pushing the front knee past the toes', 'Lengthen the stride so the front knee stops above the ankle', 0),
  ('walking-lunge', 'Back rounding forward under fatigue', 'Reset posture between reps and shorten the range if the torso starts to fold', 1),
  ('goblet-squat', 'Weight drifting away from the chest', 'Pull the dumbbell in tight against the sternum throughout', 0),
  ('goblet-squat', 'Rounding the upper back at the bottom', 'Keep the chest lifted and stop the descent before the back rounds', 1),
  ('dumbbell-lunge', 'Dumbbells swinging forward and pulling the torso with them', 'Slow the tempo and keep the arms relaxed but still at the sides', 0),
  ('dumbbell-lunge', 'Losing balance on the step back', 'Take a shorter, more controlled step until stability improves', 1),
  ('barbell-back-squat', 'Knees caving inward under load', 'Cue ''knees out'' and, if it persists, reduce load until the pattern cleans up', 0),
  ('barbell-back-squat', 'Losing the brace and rounding the lower back at depth', 'Reset the brace before every rep and only squat as deep as the spine can stay neutral', 1),
  ('barbell-front-squat', 'Elbows dropping, letting the bar roll off the shoulders', 'Actively drive the elbows up before and during the descent', 0),
  ('barbell-front-squat', 'Leaning forward to compensate for a lost brace', 'Rebrace between reps and reduce load if the torso keeps tipping forward', 1),
  ('leg-press', 'Hips lifting off the pad at the bottom', 'Reduce the range of motion until mobility and control improve', 0),
  ('leg-press', 'Locking the knees out hard at the top', 'Stop just short of full lockout to keep tension on the muscle and off the joint', 1),
  ('leg-extension', 'Using momentum to kick the weight up', 'Slow the tempo down and reduce the load so the quads do the work', 0),
  ('leg-extension', 'Hips lifting off the seat', 'Lower the weight and focus on isolating the knee joint', 1),
  ('glute-bridge', 'Overarching the lower back at the top', 'Stop the range just before the back starts to hyperextend and focus the squeeze in the glutes', 0),
  ('glute-bridge', 'Pushing through the toes instead of the heels', 'Lift the toes slightly to force weight into the heels', 1),
  ('single-leg-glute-bridge', 'Hips rotating toward the unsupported side', 'Slow down and focus on keeping both hip points level throughout', 0),
  ('single-leg-glute-bridge', 'Overarching the lower back to gain extra height', 'Stop the range where the glute stays the prime mover', 1),
  ('single-leg-rdl-bodyweight', 'Hips opening up/rotating as you tip forward', 'Slow the rep down and imagine both hip points staying level like headlights', 0),
  ('single-leg-rdl-bodyweight', 'Rounding the lower back to reach further', 'Stop the range of motion where the back can stay flat', 1),
  ('dumbbell-rdl', 'Squatting the weight down instead of hinging', 'Focus on pushing the hips backward first before the knees bend', 0),
  ('dumbbell-rdl', 'Rounding the lower back at the bottom', 'Stop the descent at the point where the back would start to round', 1),
  ('dumbbell-hip-thrust', 'Overextending the lower back at the top instead of the hips', 'Focus the squeeze in the glutes and stop before the rib cage flares', 0),
  ('dumbbell-hip-thrust', 'Feet placed too far forward or back', 'Adjust foot position so the shins are vertical at the top of the rep', 1),
  ('dumbbell-swing', 'Squatting the movement instead of hinging', 'Push the hips back further on the backswing before snapping them forward', 0),
  ('dumbbell-swing', 'Using the shoulders to lift the weight', 'Consciously relax the arms and let hip drive alone generate the momentum', 1),
  ('barbell-rdl', 'Bar drifting away from the legs', 'Actively pull the bar back into the thighs/shins throughout the rep', 0),
  ('barbell-rdl', 'Rounding the lower back to chase more range', 'Reduce the range of motion to whatever depth keeps the spine neutral', 1),
  ('barbell-deadlift', 'Rounding the lower back off the floor', 'Reset the brace and hip height before every rep; reduce load if rounding persists', 0),
  ('barbell-deadlift', 'Hips shooting up first, turning it into a stiff-leg pull', 'Drive the legs and hips together so the chest and hips rise at the same rate', 1),
  ('barbell-good-morning', 'Rounding the back to reach more depth', 'Reduce the range of motion and load until the back can stay neutral throughout', 0),
  ('barbell-good-morning', 'Bending the knees more as the set goes on', 'Keep the knee angle fixed and let the hips do the work of the movement', 1),
  ('leg-curl-machine', 'Hips lifting off the pad to generate momentum', 'Reduce the load until the hips can stay flat for every rep', 0),
  ('leg-curl-machine', 'Using a fast, jerky tempo', 'Slow the rep down, especially on the lowering phase', 1),
  ('push-up', 'Hips sagging toward the floor', 'Brace the core and glutes to keep the body rigid throughout', 0),
  ('push-up', 'Flaring the elbows out to 90 degrees', 'Keep the elbows tucked closer to a 45-degree angle from the torso', 1),
  ('incline-push-up', 'Letting the hips sag just because the incline feels easier', 'Hold the same full-body brace as you would on the floor', 0),
  ('incline-push-up', 'Using an elevation so low it''s no easier than a regular push-up', 'Pick a height that lets you complete every rep with clean form', 1),
  ('decline-push-up', 'Hips piking up because of the elevated feet', 'Actively brace the core to keep a straight line despite the altered leverage', 0),
  ('decline-push-up', 'Losing shoulder stability at higher feet elevations', 'Lower the foot height until the shoulders stay stable through the full set', 1),
  ('dumbbell-bench-press', 'Flaring the elbows out to 90 degrees at the bottom', 'Keep the elbows at roughly 45-60 degrees from the torso', 0),
  ('dumbbell-bench-press', 'Losing shoulder blade position mid-set', 'Reset the shoulder blades pinched together before every rep', 1),
  ('dumbbell-floor-press', 'Bouncing the elbows off the floor for momentum', 'Pause briefly on the floor before pressing back up', 0),
  ('dumbbell-floor-press', 'Overextending the lower back off the floor', 'Keep the knees bent and feet flat to keep the lower back settled', 1),
  ('dumbbell-chest-fly', 'Turning the fly into a press by bending the elbows more at the bottom', 'Keep the elbow angle constant throughout the entire range', 0),
  ('dumbbell-chest-fly', 'Using too much weight and losing control at the bottom', 'Reduce the load until the bottom range can be controlled', 1),
  ('barbell-bench-press', 'Bouncing the bar off the chest', 'Pause briefly at the chest and press with control rather than using the bounce', 0),
  ('barbell-bench-press', 'Shoulder blades sliding around during the set', 'Reset the shoulder blade position before every rep', 1),
  ('chest-press-machine', 'Shoulders rounding forward off the pad', 'Reset the seat height so the handles align with mid-chest', 0),
  ('chest-press-machine', 'Letting the weight stack drop on the return', 'Lower the weight under control on every rep', 1),
  ('cable-chest-fly', 'Letting the shoulders round forward at full stretch', 'Stop the range where the shoulder blades stay stable', 0),
  ('cable-chest-fly', 'Using momentum and bouncing at the end range', 'Slow the tempo and control both directions of the rep', 1),
  ('pike-push-up', 'Hips dropping into more of a regular push-up angle', 'Reset the pike position — hips high, hands and feet close together', 0),
  ('pike-push-up', 'Shrugging the shoulders up around the ears', 'Keep the shoulder blades depressed and stable throughout the press', 1),
  ('dumbbell-shoulder-press', 'Arching the lower back to press the weight up', 'Brace the core hard and keep the ribs pulled down before pressing', 0),
  ('dumbbell-shoulder-press', 'Pressing the dumbbells too far forward instead of straight up', 'Keep the path vertical, finishing with the dumbbells over the shoulders', 1),
  ('dumbbell-arnold-press', 'Rushing the rotation and losing control of the path', 'Slow the tempo down, especially through the rotation phase', 0),
  ('dumbbell-arnold-press', 'Letting the elbows flare too wide at the bottom', 'Keep the elbows closer to the body at the start position', 1),
  ('dumbbell-lateral-raise', 'Using momentum/swinging the torso to heave the weight up', 'Reduce the load and keep the torso still throughout', 0),
  ('dumbbell-lateral-raise', 'Raising the arms above shoulder height', 'Stop the range at shoulder height to keep tension on the side delt', 1),
  ('barbell-overhead-press', 'Arching the lower back to get the bar overhead', 'Brace the core and squeeze the glutes before and during the press', 0),
  ('barbell-overhead-press', 'Pressing the bar forward instead of straight up', 'Keep the bar path close to the face, moving the head back to let it pass', 1),
  ('machine-shoulder-press', 'Shrugging the shoulders up toward the ears', 'Keep the shoulder blades depressed and stable through the press', 0),
  ('machine-shoulder-press', 'Arching off the back pad to move more weight', 'Reduce the load until the back can stay flat against the pad', 1),
  ('cable-lateral-raise', 'Leaning the torso away to use body English', 'Keep the torso upright and let the shoulder do the work', 0),
  ('cable-lateral-raise', 'Raising past shoulder height and losing tension', 'Stop at shoulder height where the side delt stays loaded', 1),
  ('inverted-row', 'Hips sagging toward the floor', 'Brace the glutes and core to keep the body rigid', 0),
  ('inverted-row', 'Using momentum/kipping to get the chest up', 'Slow the tempo and pull with the back muscles rather than swinging', 1),
  ('dumbbell-row', 'Rotating the torso to help lift the weight', 'Keep the hips and shoulders square to the bench throughout', 0),
  ('dumbbell-row', 'Shrugging the shoulder instead of driving the elbow back', 'Focus on driving the elbow back and pinning the shoulder blade down', 1),
  ('dumbbell-renegade-row', 'Hips rotating toward the rowing side', 'Widen the foot stance and slow the tempo to control the rotation', 0),
  ('dumbbell-renegade-row', 'Sagging through the hips during the plank', 'Brace the core hard before initiating each row', 1),
  ('barbell-row', 'Standing up taller as the set gets hard, turning it into a shrug', 'Reset the hinge angle before every rep and reduce load if it keeps happening', 0),
  ('barbell-row', 'Using the arms alone instead of driving the elbows back', 'Initiate the pull by driving the elbows back, not just curling with the arms', 1),
  ('seated-cable-row', 'Leaning back excessively to move more weight', 'Keep the torso mostly still and let the arms/back do the pulling', 0),
  ('seated-cable-row', 'Rounding the upper back at the start of the pull', 'Sit tall and initiate the pull with the shoulder blades before the arms', 1),
  ('chest-supported-row-machine', 'Lifting the chest off the pad to add momentum', 'Reduce the load until the chest can stay pinned for every rep', 0),
  ('chest-supported-row-machine', 'Shrugging instead of pulling with the back', 'Keep the shoulders down and focus the pull through the elbows', 1),
  ('rear-delt-fly-machine', 'Using the arms to pull instead of the rear delts/upper back', 'Focus on driving the elbows back and squeezing between the shoulder blades', 0),
  ('rear-delt-fly-machine', 'Using too much weight and shortening the range', 'Reduce the load to complete the full range of motion with control', 1),
  ('pull-up', 'Only using a partial range of motion', 'Start from a full hang and pull until the chin clears the bar', 0),
  ('pull-up', 'Turning the pull into a chin-heavy shrug', 'Focus on pulling the elbows down toward the hips', 1),
  ('chin-up', 'Cutting the range short at the top', 'Pull until the chin clears the bar on every rep', 0),
  ('chin-up', 'Dropping fast on the way down and losing control', 'Lower with a controlled 2-3 second descent', 1),
  ('dumbbell-pullover', 'Bending the elbows more to turn it into a triceps extension', 'Keep the elbow angle fixed for the whole rep', 0),
  ('dumbbell-pullover', 'Overextending the lower back off the bench', 'Keep the hips low and core braced to protect the lower back', 1),
  ('lat-pulldown', 'Leaning back excessively and turning it into a row', 'Keep the lean modest and controlled, focused on a vertical pulling path', 0),
  ('lat-pulldown', 'Pulling behind the neck', 'Pull to the front of the chest to keep the shoulders in a safer position', 1),
  ('assisted-pull-up-machine', 'Using so much assistance the exercise stops being challenging', 'Gradually reduce the assist weight as reps get easier', 0),
  ('assisted-pull-up-machine', 'Cutting the range short at the top', 'Pull until the chin clears the handles each rep', 1),
  ('straight-arm-pulldown', 'Bending the elbows to turn it into a pulldown', 'Keep the arms fixed and straight, letting the shoulders do the work', 0),
  ('straight-arm-pulldown', 'Using the torso to heave the weight down', 'Keep the torso still and isolate the movement to the shoulder joint', 1),
  ('plank', 'Hips sagging toward the floor as fatigue sets in', 'End the set as soon as the straight body line breaks down', 0),
  ('plank', 'Piking the hips up too high', 'Actively lower the hips back into a straight line with the shoulders and heels', 1),
  ('side-plank', 'Hips sagging toward the floor', 'Actively push the hips up and hold that height for the duration', 0),
  ('side-plank', 'Rotating the torso forward instead of staying stacked', 'Keep the shoulders and hips in one straight vertical plane', 1),
  ('dead-bug', 'Lower back arching off the floor', 'Reduce the range of the arm/leg lowering until the back can stay pinned', 0),
  ('dead-bug', 'Rushing the tempo', 'Slow the movement down and focus on the connection between breath and bracing', 1),
  ('bird-dog', 'Hips rotating open as the leg lifts', 'Slow down and focus on keeping both hip points square to the floor', 0),
  ('bird-dog', 'Overarching the lower back to gain more height', 'Only lift the arm and leg to the height where the spine stays neutral', 1),
  ('hanging-knee-raise', 'Using momentum/swinging to throw the knees up', 'Slow the tempo and initiate each rep from a still hang', 0),
  ('hanging-knee-raise', 'Only bending at the hips without curling the pelvis', 'Actively posteriorly tilt the pelvis at the top of each rep', 1),
  ('russian-twist', 'Rounding the upper back throughout the set', 'Keep the chest lifted and the spine long', 0),
  ('russian-twist', 'Using arm-only movement instead of rotating the torso', 'Lead each rep with the ribcage rotating, not just the hands', 1),
  ('weighted-russian-twist', 'Using a weight too heavy to control the rotation', 'Reduce the load until the rotation stays smooth and controlled', 0),
  ('weighted-russian-twist', 'Rounding forward through the set', 'Keep the chest lifted and spine long throughout', 1),
  ('weighted-sit-up', 'Using momentum/yanking the torso up', 'Slow the tempo and lead with a spinal curl rather than a jerk', 0),
  ('weighted-sit-up', 'Pulling on the neck instead of using the abs', 'Keep the weight at the chest and let the abs do the work', 1),
  ('cable-crunch', 'Bending at the hips instead of flexing the spine', 'Focus on curling the ribcage down toward the pelvis', 0),
  ('cable-crunch', 'Using the arms to pull the rope down', 'Keep the arms fixed and let the ab contraction drive the movement', 1),
  ('farmers-carry', 'Shoulders rounding forward and shrugging up', 'Actively pull the shoulders back and down before and during the carry', 0),
  ('farmers-carry', 'Leaning to one side because the load feels uneven', 'Choose evenly matched dumbbells and reset posture if leaning starts', 1),
  ('suitcase-carry', 'Leaning the torso away from the load to compensate', 'Actively brace the obliques on the loaded side to stay upright', 0),
  ('suitcase-carry', 'Letting the loaded shoulder hike up', 'Keep both shoulders relaxed and level throughout the carry', 1),
  ('waiters-carry', 'Letting the arm drift forward or the elbow bend', 'Reset the overhead lockout position between steps if it starts to break down', 0),
  ('waiters-carry', 'Leaning the torso away from the loaded side', 'Brace the obliques and keep the torso stacked vertically', 1),
  ('easy-run', 'Running easy days too fast', 'Deliberately slow down — most easy runs should feel almost too easy', 0),
  ('easy-run', 'Ignoring pace and chasing a set time or distance regardless of effort', 'Run by feel/heart rate rather than forcing a specific pace', 1),
  ('tempo-run', 'Starting too fast and fading', 'Hold back slightly in the first few minutes until the pace feels sustainable', 0),
  ('tempo-run', 'Treating tempo pace as an all-out effort', 'Keep it ''comfortably hard,'' not a race-pace sprint', 1),
  ('interval-400m', 'Going out too hard on rep one and fading badly', 'Aim for even splits across all reps, starting slightly conservative', 0),
  ('interval-400m', 'Cutting recovery time short', 'Take the full prescribed recovery so quality holds up across all reps', 1),
  ('long-run', 'Running long runs at too fast a pace', 'Slow the pace down — long runs build endurance, not speed', 0),
  ('long-run', 'Skipping fueling/hydration on runs over 90 minutes', 'Bring fluids and easily digestible carbs for anything approaching or over 90 minutes', 1),
  ('hill-sprints', 'Sprinting on tired legs with breakdown in form', 'Cut the session short once technique starts to degrade', 0),
  ('hill-sprints', 'Insufficient recovery between reps', 'Take the full walk back down before starting the next sprint', 1),
  ('fartlek-run', 'Turning every surge into an all-out sprint', 'Keep most surges at a strong-but-controlled effort, not maximal', 0),
  ('fartlek-run', 'Not actually recovering between surges', 'Slow all the way back down to an easy pace during recovery segments', 1),
  ('rowing-erg', 'Pulling with the arms before the legs finish driving', 'Focus on a strong leg drive first before the back and arms engage', 0),
  ('rowing-erg', 'Rushing the recovery and shortening the stroke', 'Slow the recovery down to roughly twice the length of the drive', 1),
  ('assault-bike', 'Only using the legs and letting the arms go slack', 'Actively drive the arms to share the workload with the legs', 0),
  ('assault-bike', 'Going out too hard on the first interval', 'Pace efforts evenly across the full set', 1),
  ('stationary-bike', 'Seat set too low, causing excess knee strain', 'Raise the seat until there''s a slight bend in the knee at full extension', 0),
  ('stationary-bike', 'Gripping the handlebars too tightly and tensing the upper body', 'Relax the shoulders and grip throughout the ride', 1),
  ('stairmaster', 'Leaning on the handrails to take weight off the legs', 'Use the rails for light balance only, keeping weight through the legs', 0),
  ('stairmaster', 'Taking short, shuffling steps', 'Use fuller steps that actually load the glutes and quads', 1),
  ('ski-erg', 'Using only the arms without hip hinge', 'Add a hip hinge to each pull to engage the bigger muscles of the posterior chain', 0),
  ('ski-erg', 'Rounding the lower back excessively on the hinge', 'Keep the core braced and hinge from the hips, not the lower back', 1),
  ('jump-rope', 'Jumping too high on every rep, wasting energy', 'Keep hops small and quick, just enough to clear the rope', 0),
  ('jump-rope', 'Turning the rope with the whole arm instead of the wrists', 'Keep the elbows close to the body and rotate mainly from the wrists', 1),
  ('hip-flexor-mobilization', 'Leaning the torso forward instead of shifting the hips', 'Keep the ribcage stacked over the pelvis and shift the hips forward instead', 0),
  ('hip-flexor-mobilization', 'Skipping the glute squeeze, which does most of the work', 'Actively squeeze the back glute to actively extend the hip', 1),
  ('thoracic-spine-rotation', 'Rotating from the hips instead of the upper back', 'Actively keep the hips square and locked in place', 0),
  ('thoracic-spine-rotation', 'Rushing through reps without reaching full range', 'Slow down and pause briefly at the top of the rotation', 1),
  ('ankle-dorsiflexion-mobilization', 'Heel lifting off the floor to fake more range', 'Move the front foot further from the wall until the heel can stay down', 0),
  ('ankle-dorsiflexion-mobilization', 'Letting the knee cave inward instead of tracking straight', 'Keep the knee tracking directly over the second/third toe', 1),
  ('worlds-greatest-stretch', 'Rushing through the sequence without holding each position', 'Pause briefly in each position to actually get the intended stretch', 0),
  ('worlds-greatest-stretch', 'Letting the back knee bend, losing the hip flexor stretch', 'Keep the back leg locked straight throughout the lunge portion', 1),
  ('cat-cow', 'Rushing through reps without full range', 'Slow down and aim for a full arch and a full round on each rep', 0),
  ('cat-cow', 'Moving the hips/shoulders instead of the spine', 'Keep the base stable and focus the movement on the spine itself', 1),
  ('90-90-hip-switch', 'Using momentum to throw the legs over instead of control', 'Slow the transition down and control the switch with the hips and core', 0),
  ('90-90-hip-switch', 'Letting the chest collapse forward to compensate for tight hips', 'Sit as tall as current hip mobility allows rather than forcing the position', 1),
  ('standing-hamstring-stretch', 'Rounding the back to reach further', 'Keep the chest lifted and hinge from the hips instead', 0),
  ('standing-hamstring-stretch', 'Bouncing to try to deepen the stretch', 'Hold a steady, static position instead of bouncing', 1),
  ('couch-stretch', 'Going too deep too fast', 'Start further from full depth and progress gradually over sessions', 0),
  ('couch-stretch', 'Arching the lower back to fake more upright torso position', 'Brace the core to keep the ribs down rather than arching the back', 1),
  ('doorway-chest-stretch', 'Stepping through too aggressively', 'Ease into the stretch gradually rather than lunging in hard', 0),
  ('doorway-chest-stretch', 'Raising the elbow too high, stressing the shoulder joint', 'Keep the elbow at roughly shoulder height for a chest-focused stretch', 1),
  ('seated-figure-four-stretch', 'Rounding the back to force a deeper stretch', 'Keep the chest lifted and stop the hinge where the back stays flat', 0),
  ('seated-figure-four-stretch', 'Forcing the crossed knee down aggressively', 'Let the stretch develop gradually rather than pressing the knee down hard', 1),
  ('childs-pose', 'Forcing the hips down onto the heels when mobility doesn''t allow it', 'Let the hips rest wherever is comfortable rather than forcing full depth', 0),
  ('childs-pose', 'Holding tension in the shoulders instead of relaxing', 'Let the arms and shoulders go soft and heavy on the floor', 1),
  ('standing-quad-stretch', 'Letting the knee drift out to the side', 'Keep the knees pinned together to isolate the quad stretch', 0),
  ('standing-quad-stretch', 'Arching the lower back to get the heel closer to the glute', 'Only pull the heel as far as the lower back can stay neutral', 1),
  ('box-jump', 'Jumping down off the box instead of stepping down', 'Always step back down to avoid unnecessary landing stress', 0),
  ('box-jump', 'Choosing a box too high and landing with stiff, unstable legs', 'Reduce the box height until every landing is soft and controlled', 1),
  ('broad-jump', 'Landing with stiff, straight legs', 'Actively bend the knees on landing to absorb the force', 0),
  ('broad-jump', 'Chaining reps too close together without resetting', 'Take a full reset and brief rest between each jump for quality', 1),
  ('depth-jump', 'Jumping off the box instead of stepping off', 'Step off passively and let gravity do the work of the drop', 0),
  ('depth-jump', 'Pausing/absorbing at the bottom instead of rebounding immediately', 'Focus on a fast, reactive rebound rather than a slow, controlled squat', 1),
  ('lateral-bound', 'Landing knee caving inward', 'Reduce jump distance until the knee can track cleanly over the foot on landing', 0),
  ('lateral-bound', 'Rushing the next bound without sticking the landing first', 'Add a full stick and pause between bounds until stability improves', 1),
  ('tuck-jump', 'Folding the torso forward to meet the knees instead of driving the knees up', 'Keep the chest tall and focus on driving the knees upward', 0),
  ('tuck-jump', 'Landing stiff-legged', 'Actively bend the knees to absorb every landing', 1),
  ('plyo-push-up', 'Losing the straight body line during the explosive phase', 'Brace the core hard before every rep to keep the line solid', 0),
  ('plyo-push-up', 'Landing with locked, stiff elbows', 'Bend the elbows on landing to cushion the impact', 1),
  ('power-clean', 'Pulling early with the arms instead of finishing hip extension first', 'Focus on a full, violent hip extension before the arms bend to pull under', 0),
  ('power-clean', 'Catching the bar too low/deep or out in front of the body', 'Practice pulling yourself under the bar quickly to catch it high and close', 1),
  ('hang-clean', 'Bending the arms too early instead of finishing hip extension', 'Delay arm bend until the hips have fully extended', 0),
  ('hang-clean', 'Bar drifting away from the body during the pull', 'Keep the bar brushing the thighs on the way up', 1),
  ('snatch', 'Pressing the bar out with the arms instead of pulling under it', 'Focus on pulling the body under a bar that''s already moving, not pressing it up', 0),
  ('snatch', 'Catching with soft, bent elbows overhead', 'Actively lock the elbows out the instant the bar is caught', 1),
  ('clean-and-jerk', 'Dipping too deep or leaning forward before the jerk drive', 'Keep the dip shallow and the torso vertical throughout', 0),
  ('clean-and-jerk', 'Pressing the bar out with the arms instead of driving with the legs', 'Focus power output from the leg drive, using the arms only to lock out and receive', 1),
  ('push-press', 'Dipping too deep, turning it into a push jerk unintentionally', 'Keep the dip shallow — just enough to add momentum, not a squat', 0),
  ('push-press', 'Leaning back excessively to get under the bar', 'Keep the torso upright and drive the bar path close to vertical', 1),
  ('clean-pull', 'Bending the arms and trying to catch the bar', 'Keep the arms straight throughout, this movement stops at full extension', 0),
  ('clean-pull', 'Losing bar contact with the legs during the pull', 'Keep the bar brushing the thighs the whole way up', 1),
  ('kettlebell-turkish-get-up', 'Rushing through checkpoints instead of controlling each position', 'Slow down and treat each checkpoint as its own controlled position', 0),
  ('kettlebell-turkish-get-up', 'Losing lockout on the overhead arm during transitions', 'Practice each checkpoint in isolation before chaining the full movement', 1),
  ('band-pull-apart', 'Bending the elbows to make the pull easier', 'Keep the arms locked straight and let the upper back do the work', 0),
  ('band-pull-apart', 'Using a band too light to feel real tension', 'Choose a band thickness that makes the last few reps genuinely challenging', 1),
  ('medicine-ball-slam', 'Only using the arms to throw the ball down', 'Initiate the slam from the hips and core, letting the arms follow through', 0),
  ('medicine-ball-slam', 'Rushing between reps without a full reset', 'Take a moment to reset the overhead position before each rep for full power output', 1);

-- ============================================================
-- exercise_relationships
-- ============================================================

insert into public.exercise_relationships (exercise_id, related_exercise_id, relationship_type, position) values
  ('incline-push-up', 'push-up', 'progression', 0),
  ('push-up', 'decline-push-up', 'progression', 0),
  ('push-up', 'dumbbell-bench-press', 'progression', 1),
  ('dumbbell-bench-press', 'barbell-bench-press', 'progression', 0),
  ('bodyweight-squat', 'goblet-squat', 'progression', 0),
  ('goblet-squat', 'barbell-back-squat', 'progression', 0),
  ('barbell-back-squat', 'barbell-front-squat', 'progression', 0),
  ('dumbbell-rdl', 'barbell-rdl', 'progression', 0),
  ('barbell-rdl', 'barbell-deadlift', 'progression', 0),
  ('inverted-row', 'dumbbell-row', 'progression', 0),
  ('dumbbell-row', 'barbell-row', 'progression', 0),
  ('lat-pulldown', 'assisted-pull-up-machine', 'progression', 0),
  ('assisted-pull-up-machine', 'pull-up', 'progression', 0),
  ('dumbbell-shoulder-press', 'barbell-overhead-press', 'progression', 0),
  ('box-jump', 'depth-jump', 'progression', 0),
  ('hang-clean', 'power-clean', 'progression', 0),
  ('power-clean', 'clean-and-jerk', 'progression', 0),
  ('plank', 'hanging-knee-raise', 'progression', 0),
  ('easy-run', 'tempo-run', 'progression', 0),
  ('tempo-run', 'interval-400m', 'progression', 0),
  ('dumbbell-lunge', 'bulgarian-split-squat', 'progression', 0),
  ('glute-bridge', 'dumbbell-hip-thrust', 'progression', 0),
  ('russian-twist', 'weighted-russian-twist', 'progression', 0),
  ('jump-squat', 'tuck-jump', 'progression', 0),
  ('broad-jump', 'depth-jump', 'progression', 0),
  ('dumbbell-swing', 'hang-clean', 'progression', 0),
  ('push-up', 'incline-push-up', 'regression', 0),
  ('decline-push-up', 'push-up', 'regression', 0),
  ('dumbbell-bench-press', 'push-up', 'regression', 0),
  ('barbell-bench-press', 'dumbbell-bench-press', 'regression', 0),
  ('goblet-squat', 'bodyweight-squat', 'regression', 0),
  ('barbell-back-squat', 'goblet-squat', 'regression', 0),
  ('barbell-front-squat', 'barbell-back-squat', 'regression', 0),
  ('barbell-rdl', 'dumbbell-rdl', 'regression', 0),
  ('barbell-deadlift', 'barbell-rdl', 'regression', 0),
  ('dumbbell-row', 'inverted-row', 'regression', 0),
  ('barbell-row', 'dumbbell-row', 'regression', 0),
  ('assisted-pull-up-machine', 'lat-pulldown', 'regression', 0),
  ('pull-up', 'assisted-pull-up-machine', 'regression', 0),
  ('barbell-overhead-press', 'dumbbell-shoulder-press', 'regression', 0),
  ('depth-jump', 'box-jump', 'regression', 0),
  ('power-clean', 'hang-clean', 'regression', 0),
  ('clean-and-jerk', 'power-clean', 'regression', 0),
  ('hanging-knee-raise', 'plank', 'regression', 0),
  ('tempo-run', 'easy-run', 'regression', 0),
  ('interval-400m', 'tempo-run', 'regression', 0),
  ('bulgarian-split-squat', 'dumbbell-lunge', 'regression', 0),
  ('dumbbell-hip-thrust', 'glute-bridge', 'regression', 0),
  ('weighted-russian-twist', 'russian-twist', 'regression', 0),
  ('tuck-jump', 'jump-squat', 'regression', 0),
  ('depth-jump', 'broad-jump', 'regression', 1),
  ('hang-clean', 'dumbbell-swing', 'regression', 0),
  ('barbell-bench-press', 'dumbbell-bench-press', 'variation', 0),
  ('dumbbell-bench-press', 'dumbbell-floor-press', 'variation', 0),
  ('barbell-back-squat', 'barbell-front-squat', 'variation', 0),
  ('barbell-deadlift', 'barbell-rdl', 'variation', 0),
  ('pull-up', 'chin-up', 'variation', 0),
  ('barbell-overhead-press', 'push-press', 'variation', 0),
  ('dumbbell-row', 'chest-supported-row-machine', 'variation', 0),
  ('farmers-carry', 'suitcase-carry', 'variation', 0),
  ('farmers-carry', 'waiters-carry', 'variation', 1),
  ('plank', 'side-plank', 'variation', 0),
  ('dead-bug', 'bird-dog', 'variation', 0),
  ('snatch', 'power-clean', 'variation', 0),
  ('rowing-erg', 'ski-erg', 'variation', 0),
  ('assault-bike', 'rowing-erg', 'variation', 0),
  ('tempo-run', 'fartlek-run', 'variation', 0),
  ('box-jump', 'broad-jump', 'variation', 0),
  ('tuck-jump', 'box-jump', 'variation', 0),
  ('couch-stretch', 'standing-quad-stretch', 'variation', 0),
  ('hip-flexor-mobilization', 'couch-stretch', 'variation', 0),
  ('seated-cable-row', 'chest-supported-row-machine', 'variation', 0)
on conflict (exercise_id, related_exercise_id, relationship_type) do nothing;
