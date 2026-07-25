-- Adds a role-based admin flag (rather than a hardcoded email check in
-- app code) so more accounts can be granted admin access later just by
-- flipping this column — no code change needed. Powers a new /admin
-- roster page that lists every signed-up user (email, signup date, role,
-- last active, program/session counts), view-only for now.
--
-- profiles has never stored email (it only mirrors auth.users' id, plus
-- app-specific fields) — client code can't query auth.users directly
-- (this app has no service-role key, see 0003_coach_clients.sql), so
-- email needs denormalizing onto profiles itself for the roster to be
-- able to show it under RLS like any other column.
--
-- Run this once in the Supabase SQL Editor. Safe to re-run.

alter table public.profiles add column if not exists is_admin boolean not null default false;
alter table public.profiles add column if not exists email text;

-- Keep new signups' email in sync going forward.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  return new;
end;
$$;

-- Backfill email for every account that already exists.
update public.profiles pr
set email = au.email
from auth.users au
where pr.id = au.id
  and pr.email is distinct from au.email;

-- Grant admin access to the app's owner. Widen this later by just
-- updating is_admin = true for another account — no migration needed.
update public.profiles
set is_admin = true
where id = (select id from auth.users where email = 'ellisbennett2308@gmail.com');

-- profiles already has "readable by their owner" (schema.sql) and
-- "linked coach or client can read each other's profile" (0003) as
-- separate permissive SELECT policies, which combine via OR — this adds
-- a third rather than touching either existing one.
drop policy if exists "admins can read every profile" on public.profiles;
create policy "admins can read every profile"
  on public.profiles for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

-- Same additive approach on programs/session_logs — needed so the
-- roster can compute program/session counts and last-active dates
-- across every user, without loosening either table's existing
-- owner/athlete/coach-scoped policies.
drop policy if exists "admins can read all programs" on public.programs;
create policy "admins can read all programs"
  on public.programs for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

drop policy if exists "admins can read all session logs" on public.session_logs;
create policy "admins can read all session logs"
  on public.session_logs for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));
