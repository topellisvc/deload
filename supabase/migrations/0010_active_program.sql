-- Active Program: the single program (per athlete) that drives the new
-- /dashboard — today's workout, current week/day, completion %, upcoming
-- sessions, and dashboard recommendations all read from whichever
-- program has is_active = true for that athlete_id, instead of any of
-- them inventing their own "which program am I looking at" logic.
--
-- Scoped by athlete_id, not owner_id: it's about which program someone
-- is *following* right now, and a coach's own programs and a client's
-- coach-assigned program are independent from that coach's perspective.
-- "Owned program" in the product spec means the same thing here as it
-- does in RLS everywhere else in this schema (owner_id) -- see
-- set_active_program below.
--
-- The partial unique index is what actually enforces "zero or one active
-- program per athlete" at the database level, not application code.
--
-- Run this once in the Supabase SQL Editor. Safe to re-run.

alter table public.programs add column if not exists is_active boolean not null default false;

drop index if exists programs_one_active_per_athlete;
create unique index programs_one_active_per_athlete
  on public.programs (athlete_id)
  where (is_active);

-- Atomically deactivates whatever was active for this program's athlete
-- and activates this one instead, so there's never a moment (or a
-- partial-failure state) with zero or two active programs. `security
-- invoker` (the default) means the UPDATEs inside still run under RLS
-- with the caller's own permissions -- the existing "programs are
-- editable by their owner" policy already restricts both UPDATEs to
-- programs the caller owns, so this grants no new access, just makes an
-- otherwise two-step client operation atomic. Raises if the caller
-- doesn't own the program, rather than silently no-op succeeding.
create or replace function public.set_active_program(p_program_id uuid)
returns void
language plpgsql
security invoker
as $$
declare
  v_athlete_id uuid;
begin
  select athlete_id into v_athlete_id from public.programs where id = p_program_id;
  if v_athlete_id is null then
    raise exception 'Program not found';
  end if;

  update public.programs
    set is_active = false
    where athlete_id = v_athlete_id and is_active = true and id <> p_program_id;

  update public.programs
    set is_active = true, updated_at = now()
    where id = p_program_id;

  if not found then
    raise exception 'Not allowed to activate this program';
  end if;
end;
$$;

grant execute on function public.set_active_program(uuid) to authenticated;
