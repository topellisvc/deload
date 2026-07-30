-- Adds the runtime feedback layer the "Build my program" generator needs in
-- order not to be a purely calendar-based program writer. Four rules, from a
-- structured interview with a professional S&C coach (see
-- deload-program-generator-coach-answers.md §2 and §10, and
-- deload-autoregulation-design.md for the full design):
--
--   1. An RIR gate after each session's primary lift ("how many more reps
--      could you have done?" -> 0/1/2/3+), driving load progression.
--   2. A user-visible "repeat this week" / "skip ahead" control. Needs no
--      schema change at all — repeat is a week clone through addWeek's
--      existing based_on_week_id provenance path, and skip-ahead is the
--      session_logs.skipped mechanism from migration 0015.
--   3. A two-question pre-session readiness check (sleep, soreness).
--   4. A per-joint "how was it after last session — better/same/worse?"
--      check for any flagged joint, which walks that joint's substitution
--      ladder up or down.
--
-- Rules 3 and 4 are asked *before* a session, and a session_logs row doesn't
-- exist until Finish Workout — so both live on the draft session
-- (training_mode_sessions) and are folded into the session log at finish, the
-- same mechanism exercise_notes (0014) and skipped_exercises (0029) already
-- use.
--
-- Nothing here alters or drops an existing column, and nothing rewrites an
-- existing row. Every column added is nullable or defaulted, so any query
-- that has never heard of this feature is unaffected.
--
-- Run this once in the Supabase SQL Editor, after 0043. Safe to re-run.
--
-- ROLLBACK — see DELOAD-SUPABASE-ROLLBACK.md. Before any athlete has logged
-- against these, the undo is:
--
--   alter table public.training_mode_sessions drop column if exists readiness;
--   alter table public.training_mode_sessions drop column if exists joint_check;
--   alter table public.logged_sets drop column if exists performed_rir;
--   drop table if exists public.autoregulation_events;
--
-- AFTER go-live those hold real training history, and dropping them deletes
-- athlete data. The correct rollback then is to stop writing, not to drop:
--
--   revoke insert, update on public.autoregulation_events from authenticated;


-- ============================================================
-- Rule 3 — two-question readiness check
-- ============================================================
-- { sleep: 'good' | 'ok' | 'bad', soreness: 'fresh' | 'normal' | 'beat_up' }
--
-- Both answers in the bad bucket downregulates *this session only*: drop the
-- last set of each exercise, cap the top set at RPE 7, and explicitly do not
-- count it as a failed progression. That last clause is the whole point — a
-- bad night's sleep must never trigger the 10% load reset that two genuinely
-- missed sessions would.
--
-- Also distinguishes the two deload kinds in §3, which need opposite
-- treatment (creaky joints -> cut intensity, load is the irritant; systemic
-- fatigue -> cut volume and frequency), and gates §6's hard rule that sprints
-- and plyometrics are never programmed onto sore legs.
--
-- jsonb rather than two enum columns to match this table's existing
-- convention: every other piece of draft state here (draft_sets,
-- exercise_notes, skipped_exercises) is jsonb scratch space shaped by
-- lib/training/types.ts, not by the schema.
alter table public.training_mode_sessions
  add column if not exists readiness jsonb not null default '{}'::jsonb;


-- ============================================================
-- Rule 4 — per-joint check (coach answers §10 step 2)
-- ============================================================
-- Record<joint, 'better' | 'same' | 'worse'> where joint is one of the six
-- the coach's decision trees cover: shoulder, lower_back, knee, wrist, hip,
-- elbow.
--
-- Worse twice in a row regresses one step down that joint's substitution
-- ladder; better twice in a row progresses one step back up. The coach's
-- framing matters here and is worth restating in the schema: the correct
-- default for a painful joint is substitution plus a load-and-range window,
-- never exclusion. "No overhead pressing" removes the exact stimulus the
-- shoulder needs to build capacity and produces someone weaker and more
-- fragile six months later. This column exists so the ladder can be walked
-- in both directions, which is what makes that possible.
alter table public.training_mode_sessions
  add column if not exists joint_check jsonb not null default '{}'::jsonb;


-- ============================================================
-- Rule 1 — reps in reserve, as asked
-- ============================================================
-- Nullable. Deliberately its own column rather than being converted into
-- performed_rpe on the way in, even though RPE = 10 - RIR is arithmetically
-- exact.
--
-- The reason is §4 point 4: the 6-10 RPE scale requires experience of what a
-- true limit feels like, and novices systematically mis-rate in both
-- directions — they'll call an RPE 6 an "8" because it's the hardest thing
-- they've ever done, or the reverse. So the app asks the ternary version
-- ("could you have done 3 more good reps?"), which maps cleanly onto RIR and
-- is far more reliable. Storing both answers in one column would discard
-- *which question was answered*, and the novice-smoothing rule (average the
-- e1RM estimate over three sessions rather than reacting to a single data
-- point) depends on knowing the difference.
alter table public.logged_sets
  add column if not exists performed_rir integer;

alter table public.logged_sets
  drop constraint if exists logged_sets_performed_rir_range;
alter table public.logged_sets
  add constraint logged_sets_performed_rir_range
  check (performed_rir is null or (performed_rir >= 0 and performed_rir <= 10));


-- ============================================================
-- autoregulation_events
-- ============================================================
-- Append-only record of every adjustment the four rules make.
--
-- A table rather than mutating set_prescriptions, for three reasons:
--
--  1. A generated program lands in ProgramBuilder's review/edit mode and a
--     coach may edit it, so set_prescriptions rows are *authored intent* —
--     sometimes the generator's, sometimes a human's on top. A coach must be
--     able to see "the plan says 100 kg, autoregulation suggests 97.5 kg
--     because you missed reps twice," not discover a number they didn't write
--     and can't explain.
--  2. §2's novice -> intermediate reclassification counts events: "two
--     10%-resets on the same lift within ~8 weeks," and the coach insists it
--     be automatic from logged resets rather than self-assessment, because
--     self-assessment of training age is unreliable in both directions. A
--     reset that mutates a prescription in place leaves nothing to count.
--  3. It matches this codebase's existing convention that derived state isn't
--     stored — see lib/training/types.ts on why there's no stored "current
--     position", and prescription-types.ts on suggestedWeightFromPercent1RM
--     ("a derived value has no business being stored").
--
-- block_exercise_id rather than set_prescription_id: prescriptions can be
-- edited or removed by a coach without invalidating the history of what was
-- adjusted, the same reasoning migration 0012 gives for logged_sets'
-- set_prescription_id being nullable, best-effort provenance.
create table if not exists public.autoregulation_events (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references auth.users (id) on delete cascade,
  block_exercise_id uuid not null references public.block_exercises (id) on delete cascade,
  occurred_on date not null default (now() at time zone 'utc')::date,
  kind text not null check (kind in (
    -- Rule 1
    'advance', 'hold', 'reset_10pct',
    -- Rule 3 — recorded so it can be *excluded* from Rule 1's consecutive
    -- miss counter, which is the interaction the coach specifies explicitly.
    'readiness_downregulated',
    -- Rule 4
    'joint_regress', 'joint_progress'
  )),
  -- Rule-specific payload: the load before/after for a reset, which joint and
  -- which ladder step for a regression, the readiness answers that triggered
  -- a downregulation. Kept open for the same reason 0030 gave
  -- set_prescriptions.advanced_config an open jsonb rather than a column per
  -- method.
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists autoregulation_events_athlete_idx
  on public.autoregulation_events (athlete_id, occurred_on desc);

-- The lookup Rule 1 actually runs: this athlete's recent events for one lift.
create index if not exists autoregulation_events_lift_idx
  on public.autoregulation_events (athlete_id, block_exercise_id, occurred_on desc);

alter table public.autoregulation_events enable row level security;

drop policy if exists "autoregulation events readable by program owner or athlete" on public.autoregulation_events;
drop policy if exists "athletes can record their own autoregulation events" on public.autoregulation_events;
drop policy if exists "athletes can delete their own autoregulation events" on public.autoregulation_events;
drop policy if exists "admins can read all autoregulation events" on public.autoregulation_events;

-- Same owner-or-athlete read pattern as every other table in this schema,
-- reached via block_exercises -> exercise_blocks -> training_days ->
-- program_weeks -> programs.
--
-- A coach reading this is the point, not an incidental consequence: the whole
-- reason adjustments are events rather than in-place edits to
-- set_prescriptions is so a coach can see *why* a load moved ("reset 10%
-- after two missed sessions") instead of finding a number they didn't write.
-- Restricting reads to athlete_id would have defeated that.
create policy "autoregulation events readable by program owner or athlete"
  on public.autoregulation_events for select
  using (
    exists (
      select 1 from public.block_exercises be
      join public.exercise_blocks b on b.id = be.block_id
      join public.training_days d on d.id = b.day_id
      join public.program_weeks w on w.id = d.week_id
      join public.programs p on p.id = w.program_id
      where be.id = autoregulation_events.block_exercise_id
        and (p.owner_id = auth.uid() or p.athlete_id = auth.uid())
    )
  );

-- Write access is athlete-only, same as logged_sets and session_logs — these
-- events are derived from what the athlete actually reported, not something a
-- coach fills in on someone else's behalf.
create policy "athletes can record their own autoregulation events"
  on public.autoregulation_events for insert
  with check (athlete_id = auth.uid());

create policy "athletes can delete their own autoregulation events"
  on public.autoregulation_events for delete
  using (athlete_id = auth.uid());

-- Matches migration 0041, which gave admins read access to programs and
-- session detail for the /admin roster.
create policy "admins can read all autoregulation events"
  on public.autoregulation_events for select
  using (public.is_admin(auth.uid()));
