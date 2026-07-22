-- Adds running-specific fields to the program builder.
--
-- Phase 1 shipped with every exercise block shaped for weight training
-- (sets x reps @ load) — fine for the "Weights" discipline, useless for
-- the "Running" one (a run isn't "3 sets of 8 reps"). This migration adds
-- an activity_type to block_exercises so a block can be tagged 'run'
-- instead of 'strength', and adds distance/duration/pace columns to
-- set_prescriptions for run blocks to use instead of sets/reps/load.
--
-- Existing rows are unaffected: activity_type defaults to 'strength' (the
-- only kind that existed before this migration), and the new columns are
-- nullable and simply unused by strength rows.
--
-- Run this once in the Supabase SQL Editor after pulling this change.

alter table public.block_exercises
  add column if not exists activity_type text not null default 'strength'
    check (activity_type in ('strength', 'run'));

alter table public.set_prescriptions
  add column if not exists distance_meters numeric,
  add column if not exists duration_seconds integer,
  add column if not exists pace_seconds_per_km numeric;
