-- Pre-made healthy meal/plan library (Ellis: "some pre made healthy meal
-- options in there would be [good]"). Two levels, same nesting shape as the
-- real tree (0058) one layer shallower each:
--
--   meal_templates -> meal_template_items          ("Grilled Chicken & Quinoa Bowl")
--   plan_templates -> plan_template_days -> plan_template_meals -> (references a meal_template)
--
-- Deliberately NOT modeled as owner-scoped rows the way foods/exercises
-- allow coach-custom entries (migration 0058, 0035) — this is a curated
-- reference library, not something every coach builds their own copy of.
-- Globally readable by any authenticated user, writable only by admins
-- (public.is_admin, 0022). No "my own copy" concept here; a coach who wants
-- to build on a template just inserts it into a real plan they own (via
-- applyMealTemplate / instantiatePlanTemplate, lib/nutrition/mutations.ts)
-- and edits the copy from there — the template row itself never changes
-- underneath them.
--
-- plan_template_meals references a meal_template rather than duplicating
-- its items, so a full starter plan is just a curated sequence of the same
-- meal templates the Templates tab already offers — no separate content to
-- keep in sync.
--
-- Run this once in the Supabase SQL Editor. Safe to re-run.

-- ============================================================
-- meal_templates
-- ============================================================

create table if not exists public.meal_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  category text not null check (category in ('breakfast', 'lunch', 'dinner', 'snack')),
  tags text[] not null default '{}',
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists meal_templates_category_idx on public.meal_templates (category, position);

alter table public.meal_templates enable row level security;

drop policy if exists "meal templates are readable by any authenticated user" on public.meal_templates;
drop policy if exists "meal templates are writable by admins" on public.meal_templates;

create policy "meal templates are readable by any authenticated user"
  on public.meal_templates for select
  using (auth.uid() is not null);

create policy "meal templates are writable by admins"
  on public.meal_templates for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

create or replace function public.set_meal_templates_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists meal_templates_set_updated_at on public.meal_templates;
create trigger meal_templates_set_updated_at
  before update on public.meal_templates
  for each row execute function public.set_meal_templates_updated_at();

-- ============================================================
-- meal_template_items
-- ============================================================

create table if not exists public.meal_template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.meal_templates (id) on delete cascade,
  position integer not null,
  food_id text not null references public.foods (id) on delete restrict,
  quantity_g numeric not null default 100,
  display_label text
);

create index if not exists meal_template_items_template_idx on public.meal_template_items (template_id, position);
create index if not exists meal_template_items_food_idx on public.meal_template_items (food_id);

alter table public.meal_template_items enable row level security;

drop policy if exists "meal template items are readable by any authenticated user" on public.meal_template_items;
drop policy if exists "meal template items are writable by admins" on public.meal_template_items;

create policy "meal template items are readable by any authenticated user"
  on public.meal_template_items for select
  using (auth.uid() is not null);

create policy "meal template items are writable by admins"
  on public.meal_template_items for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- ============================================================
-- plan_templates
-- ============================================================

create table if not exists public.plan_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  goal text,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.plan_templates enable row level security;

drop policy if exists "plan templates are readable by any authenticated user" on public.plan_templates;
drop policy if exists "plan templates are writable by admins" on public.plan_templates;

create policy "plan templates are readable by any authenticated user"
  on public.plan_templates for select
  using (auth.uid() is not null);

create policy "plan templates are writable by admins"
  on public.plan_templates for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

create or replace function public.set_plan_templates_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists plan_templates_set_updated_at on public.plan_templates;
create trigger plan_templates_set_updated_at
  before update on public.plan_templates
  for each row execute function public.set_plan_templates_updated_at();

-- ============================================================
-- plan_template_days
-- ============================================================

create table if not exists public.plan_template_days (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.plan_templates (id) on delete cascade,
  position integer not null,
  label text
);

create index if not exists plan_template_days_template_idx on public.plan_template_days (template_id, position);

alter table public.plan_template_days enable row level security;

drop policy if exists "plan template days are readable by any authenticated user" on public.plan_template_days;
drop policy if exists "plan template days are writable by admins" on public.plan_template_days;

create policy "plan template days are readable by any authenticated user"
  on public.plan_template_days for select
  using (auth.uid() is not null);

create policy "plan template days are writable by admins"
  on public.plan_template_days for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- ============================================================
-- plan_template_meals
-- ============================================================

create table if not exists public.plan_template_meals (
  id uuid primary key default gen_random_uuid(),
  day_id uuid not null references public.plan_template_days (id) on delete cascade,
  position integer not null,
  name text not null,
  meal_template_id uuid not null references public.meal_templates (id) on delete restrict
);

create index if not exists plan_template_meals_day_idx on public.plan_template_meals (day_id, position);
create index if not exists plan_template_meals_meal_template_idx on public.plan_template_meals (meal_template_id);

alter table public.plan_template_meals enable row level security;

drop policy if exists "plan template meals are readable by any authenticated user" on public.plan_template_meals;
drop policy if exists "plan template meals are writable by admins" on public.plan_template_meals;

create policy "plan template meals are readable by any authenticated user"
  on public.plan_template_meals for select
  using (auth.uid() is not null);

create policy "plan template meals are writable by admins"
  on public.plan_template_meals for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));
