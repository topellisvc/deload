-- Profile dashboard: a handful of additional self-reported fields, plus a
-- new personal_records table.
--
-- training_style intentionally mirrors StyleId from
-- lib/training-style/recommend-style.ts (same 8 values) rather than being
-- populated by that quiz automatically -- there's no save-to-profile
-- wiring on the finder tool itself (out of scope for the profile page),
-- so this is a plain self-reported field using the same taxonomy, editable
-- from the profile's Training Profile section.
--
-- personal_records is deliberately generic: record_type is a free text
-- key rather than one column per lift/distance, so adding a new PR type
-- later (e.g. "front_squat") is just a new value the app knows how to
-- render, not a schema change. unique(user_id, record_type) means saving
-- a PR is a plain upsert -- one current value per type, not a history.
--
-- Run this once in the Supabase SQL Editor. Safe to re-run.

alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists date_of_birth date;
alter table public.profiles add column if not exists sex text check (sex in ('male', 'female', 'other', 'prefer_not_to_say'));
alter table public.profiles add column if not exists experience_level text check (experience_level in ('beginner', 'intermediate', 'advanced'));
alter table public.profiles add column if not exists training_style text check (
  training_style in (
    'powerlifting', 'bodybuilding', 'general_fitness', 'calisthenics',
    'hybrid', 'power_speed', 'powerbuilding', 'crossfit'
  )
);

create table if not exists public.personal_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  record_type text not null,
  value_number numeric not null,
  unit text not null,
  achieved_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, record_type)
);

create index if not exists personal_records_user_idx on public.personal_records (user_id);

alter table public.personal_records enable row level security;

drop policy if exists "personal records are readable by their owner" on public.personal_records;
drop policy if exists "personal records are insertable by their owner" on public.personal_records;
drop policy if exists "personal records are editable by their owner" on public.personal_records;
drop policy if exists "personal records are deletable by their owner" on public.personal_records;

-- Owner-only in every direction, including read -- unlike programs/logs,
-- nothing in the current spec has a coach viewing a client's PRs, so
-- there's no reason to open read access beyond the person who set them.
create policy "personal records are readable by their owner"
  on public.personal_records for select
  using (auth.uid() = user_id);

create policy "personal records are insertable by their owner"
  on public.personal_records for insert
  with check (auth.uid() = user_id);

create policy "personal records are editable by their owner"
  on public.personal_records for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "personal records are deletable by their owner"
  on public.personal_records for delete
  using (auth.uid() = user_id);
