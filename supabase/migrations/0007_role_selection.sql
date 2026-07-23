-- Tracks whether someone has actually been asked "coach or athlete?" yet,
-- separate from the role value itself — profiles.role already defaults to
-- 'athlete', which is indistinguishable from "explicitly chose athlete"
-- without this flag. The onboarding prompt (see RoleOnboarding component)
-- shows once per account, right after first sign-in, and never again once
-- this is true.
--
-- Backfilled true for existing coaches — anyone already at role='coach'
-- got there through a deliberate action (the old UpgradePrompt button, or
-- the brief silent-auto-grant-on-visit behavior this replaces), so there's
-- no need to interrupt them with the prompt again.
--
-- Run this once in the Supabase SQL Editor. Safe to re-run.

alter table public.profiles add column if not exists role_selected boolean not null default false;

update public.profiles set role_selected = true where role = 'coach';
