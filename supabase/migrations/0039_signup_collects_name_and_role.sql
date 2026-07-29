-- SignInForm now collects a name + role ("Training myself" / "Training
-- others") before the very first sign-in email is ever sent, so a
-- brand-new account doesn't need the separate post-login "how will you
-- use Deload?" prompt (RoleOnboarding) at all. This trigger just needs to
-- read what was collected out of auth.users.raw_user_meta_data
-- (signInWithOtp's `data` option, see SignInForm) instead of leaving
-- profiles.display_name/role unset like before.
--
-- Anyone who reaches signup without that metadata (an invited client
-- accepting an invite, or any other future entry point) still lands on
-- role_selected = false exactly like before, so RoleOnboarding keeps
-- working as the fallback for them.
--
-- Run this once in the Supabase SQL Editor. Safe to re-run.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  meta_name text := nullif(trim(new.raw_user_meta_data ->> 'display_name'), '');
  meta_role text := new.raw_user_meta_data ->> 'role';
  chose_role boolean := meta_role in ('coach', 'athlete');
begin
  insert into public.profiles (id, email, display_name, role, role_selected)
  values (
    new.id,
    new.email,
    meta_name,
    case when chose_role then meta_role else 'athlete' end,
    chose_role
  );
  return new;
end;
$$;
