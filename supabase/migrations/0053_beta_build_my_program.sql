-- Gates the questionnaire-driven "Build my program" generator behind a
-- per-user beta flag, admin-controlled from the /admin roster — same
-- "one more boolean column on profiles, flip it per user" shape as
-- is_admin (migration 0021) and tour_seen (migration 0040), not a
-- separate feature-flag table, matching this app's established
-- convention for a single per-user on/off switch.
--
-- Defaults to false for every account, including existing admins — access
-- is meant to be granted deliberately, one account at a time, from the
-- new admin toggle, not inherited from any other flag.
alter table public.profiles
  add column if not exists beta_build_for_me boolean not null default false;

comment on column public.profiles.beta_build_for_me is
  'Grants access to the questionnaire-driven "Build my program" generator (/programs/generate) while it''s in beta. Admin-only toggle, see /admin.';
