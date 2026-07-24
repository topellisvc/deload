-- Lets an athlete explicitly skip today's scheduled workout and move on to
-- the next one, instead of being stuck on the same "today" day forever
-- until they log something.
--
-- Reuses session_logs rather than a new table: a skip is still "something
-- happened on this training_day on this date," it's just not training —
-- the existing (training_day_id, athlete_id, performed_on) unique
-- constraint and RLS policies (migration 0006) already apply correctly
-- as-is. Every read that treats "a session_logs row exists" as "this was
-- trained" (dashboard completion %, consistency %, streak) is updated
-- alongside this migration to exclude skipped=true rows from those
-- specific calculations, while still using them to advance which day
-- counts as "today" — see getActiveProgramContext's comment.
--
-- Run this once in the Supabase SQL Editor. Safe to re-run.

alter table public.session_logs add column if not exists skipped boolean not null default false;
