-- Closes a real gap found in a review pass: removing a client
-- (removeClient/declineInvite both hard-delete the coach_clients row)
-- didn't actually revoke anything. The programs SELECT policy only ever
-- checked owner_id/athlete_id, never whether the underlying relationship
-- was still active, so a removed client kept permanent read access to
-- any program they'd already been assigned — and child tables
-- (program_weeks, training_days, etc.) only check programs.owner_id/
-- athlete_id too, so the gap ran all the way down the tree.
--
-- Rather than patch the SELECT policy on every one of those five tables
-- to also check relationship status (a much bigger, easier-to-get-wrong
-- diff), this fixes it at the source: when a coach_clients row is
-- deleted, reassign any programs that pairing had created back to
-- athlete_id = owner_id. The coach keeps them as an ordinary
-- self-programmed program; the former client's athlete_id no longer
-- matches them, so the existing "owner or athlete" read policy already
-- and correctly denies them — no policy changes needed anywhere else.
--
-- Run this once in the Supabase SQL Editor. Safe to re-run.

create or replace function public.unassign_client_programs()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if old.client_id is not null then
    update public.programs
    set athlete_id = owner_id
    where owner_id = old.coach_id and athlete_id = old.client_id;
  end if;
  return old;
end;
$$;

drop trigger if exists on_coach_client_removed on public.coach_clients;
create trigger on_coach_client_removed
  after delete on public.coach_clients
  for each row execute function public.unassign_client_programs();
