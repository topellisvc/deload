-- exercise_max_records (migration 0054) was given the same owner-only RLS
-- shape as personal_records: `auth.uid() = athlete_id`, full stop. That's
-- wrong for this table specifically, because two of its writers are coaches
-- acting on an athlete's behalf, not the athlete themselves:
--
--   1. The manual program builder's "Know their max? Enter it" control
--      (KnownMaxControl / saveKnownExerciseMax) — a coach building a
--      program for a client (programs.owner_id = coach, athlete_id =
--      client, see migration 0003) enters a max they already know.
--   2. Reading that same library back (getPersonalRecords /
--      getLatestExerciseMaxesAsRecords) to show "known max" on every
--      appearance of the exercise while the coach is building — and to
--      resolve percent_1rm weights for preview.
--
-- Every one of those calls runs as `program.athlete_id`, correctly scoped
-- to the athlete's own row — but with auth.uid() being the coach, the old
-- policy's `auth.uid() = athlete_id` check is false, so the select silently
-- returns nothing and the insert is silently rejected. Not a
-- cross-contamination bug (the athlete_id was always right), just a
-- same-person-only policy that doesn't fit a table two different people
-- legitimately write to.
--
-- Fix: extend select/insert/delete with the exact same "active
-- coach_clients relationship" exception migration 0003 already added to
-- programs' insert/update policies, rather than inventing a new shape.
drop policy if exists "exercise max records are readable by their owner" on public.exercise_max_records;
create policy "exercise max records are readable by their owner or coach"
  on public.exercise_max_records for select
  using (
    auth.uid() = athlete_id
    or exists (
      select 1 from public.coach_clients cc
      where cc.coach_id = auth.uid() and cc.client_id = athlete_id and cc.status = 'active'
    )
  );

drop policy if exists "exercise max records are insertable by their owner" on public.exercise_max_records;
create policy "exercise max records are insertable by their owner or coach"
  on public.exercise_max_records for insert
  with check (
    auth.uid() = athlete_id
    or exists (
      select 1 from public.coach_clients cc
      where cc.coach_id = auth.uid() and cc.client_id = athlete_id and cc.status = 'active'
    )
  );

drop policy if exists "exercise max records are deletable by their owner" on public.exercise_max_records;
create policy "exercise max records are deletable by their owner or coach"
  on public.exercise_max_records for delete
  using (
    auth.uid() = athlete_id
    or exists (
      select 1 from public.coach_clients cc
      where cc.coach_id = auth.uid() and cc.client_id = athlete_id and cc.status = 'active'
    )
  );
