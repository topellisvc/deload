-- A completed workout needs its own real completion timestamp, distinct
-- from created_at. Before this, "when was this completed" was read off
-- created_at, which was fine right up until skip-then-complete (migration
-- 0015 + the finishWorkout fix that ships alongside this migration): when a
-- skipped row gets turned into a real completed one later, created_at still
-- correctly reflects when the row was first created (i.e. when it was
-- skipped), not when the workout was actually finished. completed_at is set
-- explicitly whenever a session_logs row becomes (or starts as) a real
-- completed session, and left null for skips.
--
-- Backfill: every existing row predates this column and (skipped didn't
-- exist before migration 0015 either, so) is a genuine completed session —
-- created_at is the closest available approximation for those, which is
-- exactly what the app already showed as "completed at" before today.
--
-- Run this once in the Supabase SQL Editor. Safe to re-run.

alter table public.session_logs add column if not exists completed_at timestamptz;

update public.session_logs set completed_at = created_at where completed_at is null and skipped = false;
