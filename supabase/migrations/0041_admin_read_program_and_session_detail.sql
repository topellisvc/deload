-- migrations 0021/0022 gave admins read access to `programs` and
-- `session_logs` themselves, for the /admin roster's counts. But every
-- table underneath those two only ever checks "does the caller own or
-- train on the program this row belongs to" — none of them know about
-- is_admin at all, so an admin can see that a program/session exists but
-- not what's actually in it (its weeks/days/exercises, or a session's
-- logged sets). That's the gap behind "as admin I'd like to see anyone's
-- programs/sessions": these are the tables an actual program/session
-- detail page reads.
--
-- Additive SELECT-only policies, same shape as 0021/0022 — admins get to
-- look, not to edit someone else's program through this. Each existing
-- owner/athlete policy is untouched.
--
-- Run this once in the Supabase SQL Editor. Safe to re-run.

drop policy if exists "admins can read all program weeks" on public.program_weeks;
create policy "admins can read all program weeks"
  on public.program_weeks for select
  using (public.is_admin(auth.uid()));

drop policy if exists "admins can read all training days" on public.training_days;
create policy "admins can read all training days"
  on public.training_days for select
  using (public.is_admin(auth.uid()));

drop policy if exists "admins can read all exercise blocks" on public.exercise_blocks;
create policy "admins can read all exercise blocks"
  on public.exercise_blocks for select
  using (public.is_admin(auth.uid()));

drop policy if exists "admins can read all block exercises" on public.block_exercises;
create policy "admins can read all block exercises"
  on public.block_exercises for select
  using (public.is_admin(auth.uid()));

drop policy if exists "admins can read all set prescriptions" on public.set_prescriptions;
create policy "admins can read all set prescriptions"
  on public.set_prescriptions for select
  using (public.is_admin(auth.uid()));

drop policy if exists "admins can read all logged sets" on public.logged_sets;
create policy "admins can read all logged sets"
  on public.logged_sets for select
  using (public.is_admin(auth.uid()));
