-- Adds "Skip Exercise" support to Training Mode: an athlete who isn't doing
-- an exercise today (injury, no equipment, ran out of time) can move past it
-- instead of being stuck logging sets for something they're not doing.
--
-- Record<block_exercise_id, string | null> — mirrors exercise_notes' shape
-- (migration 0014) exactly, just tracking "skipped, with an optional reason"
-- instead of "a note on a completed exercise". Stored durably on the draft
-- session (not just component state) so a page refresh doesn't lose the skip
-- and re-nag the athlete to log sets for something they already dismissed.
--
-- At Finish Workout time, each skip is folded into logged_sets as a
-- notes-only row, same mechanism exercise_notes already uses — see
-- finishWorkout in lib/training/mutations.ts.
--
-- Run this once in the Supabase SQL Editor, after 0028. Safe to re-run.

alter table public.training_mode_sessions
  add column if not exists skipped_exercises jsonb not null default '{}'::jsonb;
