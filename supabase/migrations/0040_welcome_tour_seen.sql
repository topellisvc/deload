-- A one-time "here's where everything is" welcome modal (WelcomeTour
-- component) shown right after role selection resolves — same "show once,
-- never again" pattern as role_selected/RoleOnboarding (migration 0007).
--
-- Backfilled true for existing accounts: they've already found their way
-- around, so there's no reason to interrupt them with a tour of a product
-- they already use.
--
-- Run this once in the Supabase SQL Editor. Safe to re-run.

alter table public.profiles add column if not exists tour_seen boolean not null default false;

update public.profiles set tour_seen = true;
