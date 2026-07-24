-- Lets an athlete manage their own copy of a coach-assigned program:
-- activate it as their active program, and delete it, without needing the
-- coach to do it for them.
--
-- Every coach-assigned program is already its own fully independent
-- `programs` row (see clone_program's deep copy in the app code / "Send a
-- copy" — this is not a shared/linked row), so widening these two
-- permissions to the assigned athlete (not just owner_id) can't affect the
-- coach's original program or any other client's copy: the athlete can
-- only ever touch the one row that's theirs.
--
-- Run this once in the Supabase SQL Editor. Safe to re-run.

-- --- Set active: widen set_active_program's explicit ownership check -------
--
-- set_active_program is `security definer` (migration 0013) and enforces
-- its own permission check in-function rather than relying on RLS, so this
-- is a straightforward widen-the-check change, not an RLS policy edit.
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

  if v_owner_id <> auth.uid() and v_athlete_id <> auth.uid() then
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

-- --- Delete: additive RLS policy for the assigned athlete -------------------
--
-- Postgres OR's multiple permissive policies for the same command together,
-- so this adds to (doesn't replace) "programs are deletable by their
-- owner" — a coach can still delete anything they own, and now an athlete
-- can also delete their own assigned copy. A plain row DELETE (unlike
-- set_active_program) has no "which other rows get touched" concern, so a
-- simple additive policy is enough here.
create policy "programs are deletable by their assigned athlete"
  on public.programs for delete
  using (auth.uid() = athlete_id);
