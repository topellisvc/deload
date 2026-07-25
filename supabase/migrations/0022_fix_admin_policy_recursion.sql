-- Fixes "infinite recursion detected in policy for relation "profiles""
-- caused by migration 0021.
--
-- 0021's "admins can read every profile" (and the equivalent programs/
-- session_logs policies) each ran a raw
-- `exists (select 1 from public.profiles p where p.id = auth.uid() and
-- p.is_admin = true)` subquery directly against profiles, from within a
-- policy defined ON profiles. Querying a table from inside its own RLS
-- policy re-triggers that table's row security, which re-invokes the
-- same policy again — Postgres refuses this outright rather than
-- looping, erroring "infinite recursion detected in policy for relation
-- \"profiles\"" on EVERY read of profiles for EVERY user, not just
-- admins. That's what broke RoleOnboarding: getMyProfile's select
-- silently errored (it only destructures `data`, never checking
-- `error`), its `data ?? ...` fallback made every account look like
-- role_selected was false, and the popup reappeared and re-failed to
-- save on every attempt for the same underlying reason.
--
-- Fix: a SECURITY DEFINER function runs as its owner rather than the
-- calling role, so its internal query against profiles bypasses RLS
-- entirely instead of re-entering the policy that calls it. This is
-- Supabase's own documented pattern for exactly this shape of check —
-- see https://supabase.com/docs/guides/database/postgres/row-level-security#avoid-recursive-rls-policies
--
-- Run this once in the Supabase SQL Editor. Safe to re-run.

create or replace function public.is_admin(uid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select is_admin from public.profiles where id = uid), false);
$$;

drop policy if exists "admins can read every profile" on public.profiles;
create policy "admins can read every profile"
  on public.profiles for select
  using (public.is_admin(auth.uid()));

drop policy if exists "admins can read all programs" on public.programs;
create policy "admins can read all programs"
  on public.programs for select
  using (public.is_admin(auth.uid()));

drop policy if exists "admins can read all session logs" on public.session_logs;
create policy "admins can read all session logs"
  on public.session_logs for select
  using (public.is_admin(auth.uid()));
