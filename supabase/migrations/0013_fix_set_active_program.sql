-- Fix set_active_program silently failing to deactivate the previous
-- active program for coach-assigned athletes.
--
-- The original version (migration 0010) is `security invoker`, so both of
-- its UPDATEs run under the caller's own RLS. The "programs are editable
-- by their owner" policy (schema.sql / 0003_coach_clients.sql) is scoped
-- by `owner_id`, but the function's deactivation UPDATE targets rows by
-- `athlete_id`. Those match for a self-programmed athlete (owner_id =
-- athlete_id), but not for a coach-assigned program: if a coach activates
-- program B for a client who currently has their own self-owned program A
-- active, the deactivation UPDATE on A is scoped to a row the coach
-- doesn't own, RLS silently filters it out (a 0-row UPDATE isn't an
-- error), and the function returns success having only activated B —
-- leaving both A and B marked active for that athlete.
--
-- Fix: make the function `security definer` so it can enforce the
-- "one active program per athlete" invariant regardless of who owns the
-- specific row being deactivated, and do the ownership check explicitly
-- inside the function (on the *target* program only) instead of relying
-- on RLS to provide it implicitly. `set search_path = public` is required
-- on security definer functions to avoid search-path hijacking.
--
-- Run this once in the Supabase SQL Editor. Safe to re-run.

create or replace function public.set_active_program(p_program_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_athlete_id uuid;
  v_owner_id uuid;
begin
  select athlete_id, owner_id into v_athlete_id, v_owner_id
  from public.programs
  where id = p_program_id;

  if v_athlete_id is null then
    raise exception 'Program not found';
  end if;

  if v_owner_id <> auth.uid() then
    raise exception 'Not allowed to activate this program';
  end if;

  update public.programs
    set is_active = false
    where athlete_id = v_athlete_id and is_active = true and id <> p_program_id;

  update public.programs
    set is_active = true, updated_at = now()
    where id = p_program_id;
end;
$$;

grant execute on function public.set_active_program(uuid) to authenticated;
