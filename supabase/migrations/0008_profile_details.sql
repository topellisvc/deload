-- Personal stats for the new /profile page: height, weight, and a
-- free-text training goal. All nullable — a profile is complete without
-- them, this is optional self-reported info, not a required onboarding
-- step. Units are stored alongside each value (not normalized to one
-- canonical unit) so the profile form can always show back exactly what
-- someone entered, matching the same "store what was entered, convert
-- only when computing" approach already used by the calculators.
--
-- Run this once in the Supabase SQL Editor. Safe to re-run.

alter table public.profiles add column if not exists height_value numeric;
alter table public.profiles add column if not exists height_unit text check (height_unit in ('cm', 'in'));
alter table public.profiles add column if not exists weight_value numeric;
alter table public.profiles add column if not exists weight_unit text check (weight_unit in ('kg', 'lb'));
alter table public.profiles add column if not exists goal text;
