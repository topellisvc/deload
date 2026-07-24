-- Softens the athlete-side "delete" added in 0017 into a soft delete.
--
-- 0017 let the assigned athlete run a real `delete from programs`. That's
-- safe for the coach's original (every assignment is its own independent
-- row — see cloneProgram's comment) but has a side effect worth avoiding:
-- since the coach's "Client programs" list and the athlete's own list are
-- both just reads of that same row (getProgramSummaries), a hard delete
-- makes the assignment vanish from the coach's view too, with no trace
-- that the client ever had it or walked away from it.
--
-- This migration replaces that DELETE grant with a soft-delete column plus
-- a SECURITY DEFINER function (same pattern as set_active_program): the
-- athlete marks their copy removed rather than destroying the row, so it
-- disappears from *their* list (see getProgramSummaries) while the coach
-- still sees it, now with a "removed by client" note instead of it
-- silently going missing. The coach can still hard-delete it themselves
-- via the existing owner DELETE policy, to actually clean it up.

alter table public.programs
  add column if not exists removed_by_athlete_at timestamptz;

drop policy if exists "programs are deletable by their assigned athlete" on public.programs;

create or replace function public.remove_assigned_program(p_program_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_athlete_id uuid;
begin
  select athlete_id into v_athlete_id
  from public.programs
  where id = p_program_id;

  if v_athlete_id is null then
    raise exception 'Program not found';
  end if;

  if v_athlete_id <> auth.uid() then
    raise exception 'Not allowed to remove this program';
  end if;

  -- Also deactivates it — a program the athlete just removed shouldn't
  -- keep driving their dashboard as their "active" program.
  update public.programs
    set removed_by_athlete_at = now(),
        is_active = false,
        updated_at = now()
    where id = p_program_id;
end;
$$;

grant execute on function public.remove_assigned_program(uuid) to authenticated;
