-- Rule 4 wiring (task #25/#31) needs two pieces of durable state that
-- didn't exist anywhere in the schema:
--
-- 1. athlete_injury_profiles — a standing, queryable version of the
--    questionnaire's InjuryProfile (lib/programs/generate/types.ts). Before
--    this, InjuryProfile only ever existed as local state inside
--    generate-program-form.tsx for the duration of one generation request —
--    nothing persisted which joints an athlete has flagged, so Training
--    Mode had no way to know which joints to even ask about at runtime.
--    One row per athlete; whichever program-generation request last
--    submitted an InjuryProfile for this athlete overwrites it, since this
--    describes the athlete's *current* standing flags, not a history of
--    past ones.
--
-- 2. joint_check_answers — append-only history of every "better/same/worse"
--    answer per athlete per joint. training_mode_sessions.joint_check
--    (0044) holds only the *current* draft session's answers, and that row
--    is deleted at Finish Workout (see 0014's own comment on why), so it
--    can't supply "what did they answer last time" the way
--    autoregulation_events does for Rule 1. This table is the durable
--    record Rule 4's two-in-a-row comparison actually reads — see
--    lib/training/autoregulation.ts's decideJointCheck, which takes the
--    previous raw answer directly rather than an event-kind history for
--    exactly this reason.
--
-- Run this once in the Supabase SQL Editor, after 0046. Safe to re-run.
--
-- ROLLBACK — before any athlete data exists here:
--   drop table if exists public.joint_check_answers;
--   drop table if exists public.athlete_injury_profiles;
-- AFTER go-live those hold real athlete data — stop writing rather than
-- drop, same rationale as 0044:
--   revoke insert, update on public.athlete_injury_profiles from authenticated;
--   revoke insert on public.joint_check_answers from authenticated;

-- ============================================================
-- athlete_injury_profiles
-- ============================================================
create table if not exists public.athlete_injury_profiles (
  athlete_id uuid primary key references auth.users (id) on delete cascade,
  -- Mirrors InjuryProfile exactly: { shoulder: boolean, wrist: boolean,
  -- elbow: boolean, lowerBack: {pattern}|null, knee: {presentation}|null,
  -- hip: {presentation}|null }. jsonb rather than a column per joint, to
  -- match this schema's existing convention for shapes owned by
  -- lib/programs/generate/types.ts, not by the database.
  injuries jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.athlete_injury_profiles enable row level security;

drop policy if exists "injury profile readable by owner or athlete" on public.athlete_injury_profiles;
drop policy if exists "athletes insert their own injury profile" on public.athlete_injury_profiles;
drop policy if exists "athletes update their own injury profile" on public.athlete_injury_profiles;
drop policy if exists "athletes delete their own injury profile" on public.athlete_injury_profiles;
drop policy if exists "admins can read all injury profiles" on public.athlete_injury_profiles;

-- Same owner-or-athlete read as autoregulation_events (0044): a coach
-- programming for this athlete should be able to see what's flagged, not
-- just the athlete themselves.
create policy "injury profile readable by owner or athlete"
  on public.athlete_injury_profiles for select
  using (
    athlete_id = auth.uid()
    or exists (
      select 1 from public.programs p
      where p.athlete_id = athlete_injury_profiles.athlete_id
        and p.owner_id = auth.uid()
    )
  );

-- Self-report only, same as logged_sets/autoregulation_events — a coach
-- doesn't fill this in on someone else's behalf.
create policy "athletes insert their own injury profile"
  on public.athlete_injury_profiles for insert
  with check (athlete_id = auth.uid());

create policy "athletes update their own injury profile"
  on public.athlete_injury_profiles for update
  using (athlete_id = auth.uid())
  with check (athlete_id = auth.uid());

create policy "athletes delete their own injury profile"
  on public.athlete_injury_profiles for delete
  using (athlete_id = auth.uid());

create policy "admins can read all injury profiles"
  on public.athlete_injury_profiles for select
  using (public.is_admin(auth.uid()));


-- ============================================================
-- joint_check_answers
-- ============================================================
create table if not exists public.joint_check_answers (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references auth.users (id) on delete cascade,
  joint text not null check (joint in ('shoulder', 'lower_back', 'knee', 'wrist', 'hip', 'elbow')),
  answer text not null check (answer in ('better', 'same', 'worse')),
  occurred_on date not null default (now() at time zone 'utc')::date,
  created_at timestamptz not null default now()
);

-- The lookup Rule 4 actually runs: this athlete's most recent answer for
-- one specific joint.
create index if not exists joint_check_answers_athlete_joint_idx
  on public.joint_check_answers (athlete_id, joint, occurred_on desc);

alter table public.joint_check_answers enable row level security;

drop policy if exists "joint check answers readable by owner or athlete" on public.joint_check_answers;
drop policy if exists "athletes record their own joint check answers" on public.joint_check_answers;
drop policy if exists "admins can read all joint check answers" on public.joint_check_answers;

create policy "joint check answers readable by owner or athlete"
  on public.joint_check_answers for select
  using (
    athlete_id = auth.uid()
    or exists (
      select 1 from public.programs p
      where p.athlete_id = joint_check_answers.athlete_id
        and p.owner_id = auth.uid()
    )
  );

-- Write access is athlete-only, same pattern as autoregulation_events —
-- these are derived from what the athlete actually reported.
create policy "athletes record their own joint check answers"
  on public.joint_check_answers for insert
  with check (athlete_id = auth.uid());

create policy "admins can read all joint check answers"
  on public.joint_check_answers for select
  using (public.is_admin(auth.uid()));
