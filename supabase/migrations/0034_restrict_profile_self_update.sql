-- Closes a privilege-escalation gap in the "profiles are editable by their
-- owner" UPDATE policy (see 0001/initial schema). That policy only has a
-- USING clause (auth.uid() = id) and no WITH CHECK clause. In Postgres RLS,
-- omitting WITH CHECK on an UPDATE policy makes it reuse USING for both
-- sides, which governs *which row* can be touched, not *which columns*
-- within that row. In practice this means any authenticated user could
-- already call PostgREST directly (bypassing the app's own ProfileUpdate
-- type, which never exposes these fields — see lib/profile/mutations.ts)
-- and set is_admin = true on their own row, granting themselves admin
-- access, or overwrite their synced-from-auth `email` column.
--
-- Fixed the same way this codebase already fixes this exact class of
-- problem for messages/notifications (0011_coaching_hub.sql,
-- enforce_message_read_only_update): a BEFORE UPDATE trigger that diffs
-- OLD vs NEW and rejects changes to the protected columns.
--
-- The `auth.uid() is not null` guard scopes this to requests actually
-- authenticated through Supabase's API (PostgREST sets auth.uid() from the
-- request's JWT). Direct SQL run as postgres/service_role — e.g. the
-- Supabase SQL Editor, or how is_admin was originally granted in
-- 0021_admin_roster.sql — has no JWT context, so auth.uid() is null there
-- and those paths are left untouched. Admin grants continue to work
-- exactly as before; only the RLS-governed, end-user-facing path is
-- restricted.
create or replace function public.enforce_profile_self_update_restrictions()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null then
    if new.is_admin is distinct from old.is_admin
       or new.email is distinct from old.email
       or new.id <> old.id
       or new.created_at <> old.created_at then
      raise exception 'is_admin, email, id, and created_at cannot be changed via a normal profile update';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_restrict_self_update on public.profiles;
create trigger profiles_restrict_self_update
  before update on public.profiles
  for each row execute function public.enforce_profile_self_update_restrictions();
