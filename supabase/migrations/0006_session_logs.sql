-- Workout logging: closes the loop between "a coach assigned this" and
-- "it actually happened". Deliberately minimal for v1 — no per-set actual
-- weights/reps (that's a real feature on its own, doubling the data model
-- with a parallel actuals table; can follow later if wanted). A day is
-- either logged or it isn't: the existence of a row IS the "done" state,
-- with a calendar date and an optional free-text note ("felt strong",
-- "skipped bench, shoulder tweak"). No separate boolean needed.
--
-- performed_on is its own date, independent of the program's week/day
-- structure, because a program can be trained more than once (repeat a
-- 4-week block for a second cycle) — the same training_day can rack up
-- multiple logs over time, one per real calendar date it was actually
-- trained.
--
-- Write access is athlete-only: only the person assigned to a program
-- (athlete_id) can create/edit/delete their own log rows. A coach can see
-- everything (same owner-or-athlete read pattern as every other table in
-- this schema) but never writes on someone else's behalf — logging what
-- you did is inherently self-reported.
--
-- Run this once in the Supabase SQL Editor. Safe to re-run.

create table if not exists public.session_logs (
  id uuid primary key default gen_random_uuid(),
  training_day_id uuid not null references public.training_days (id) on delete cascade,
  athlete_id uuid not null references auth.users (id) on delete cascade,
  performed_on date not null default current_date,
  note text,
  created_at timestamptz not null default now(),
  unique (training_day_id, athlete_id, performed_on)
);

create index if not exists session_logs_training_day_idx on public.session_logs (training_day_id);
create index if not exists session_logs_athlete_idx on public.session_logs (athlete_id);

alter table public.session_logs enable row level security;

drop policy if exists "session logs are readable by the program's owner or athlete" on public.session_logs;
drop policy if exists "athletes can log their own training" on public.session_logs;
drop policy if exists "athletes can edit their own logs" on public.session_logs;
drop policy if exists "athletes can delete their own logs" on public.session_logs;

create policy "session logs are readable by the program's owner or athlete"
  on public.session_logs for select
  using (
    exists (
      select 1 from public.training_days d
      join public.program_weeks w on w.id = d.week_id
      join public.programs p on p.id = w.program_id
      where d.id = session_logs.training_day_id
        and (p.owner_id = auth.uid() or p.athlete_id = auth.uid())
    )
  );

create policy "athletes can log their own training"
  on public.session_logs for insert
  with check (
    auth.uid() = athlete_id
    and exists (
      select 1 from public.training_days d
      join public.program_weeks w on w.id = d.week_id
      join public.programs p on p.id = w.program_id
      where d.id = session_logs.training_day_id
        and p.athlete_id = auth.uid()
    )
  );

create policy "athletes can edit their own logs"
  on public.session_logs for update
  using (auth.uid() = athlete_id)
  with check (auth.uid() = athlete_id);

create policy "athletes can delete their own logs"
  on public.session_logs for delete
  using (auth.uid() = athlete_id);
