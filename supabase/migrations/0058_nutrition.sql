-- Nutrition: meal plans built and sent to athletes the same way programs
-- are — a coach-owned tree (plan -> days -> meals -> options -> items) with
-- the same owner/athlete RLS shape as programs' own tree (0001/0003), plus
-- a `foods` catalog mirroring exercises' owner_id-null-is-global /
-- owner_id-set-is-a-coach's-own-custom-entry split (0035) — minus the
-- review_status moderation workflow. Custom foods stay owner-scoped only
-- (visible to their creator, invisible to everyone else) rather than
-- replicating exercises' admin-approval queue: an unreviewed custom food
-- only ever affects the coach's own plans, nowhere near the shared-catalog
-- risk an unreviewed exercise carries.
--
-- Structure, deliberately flatter than programs (no weeks layer): a plan is
-- just a coach-ordered list of days (`nutrition_days`) — periodized
-- multi-week progression isn't a stated need here the way it is for
-- training. A coach who wants a 7-day rotating structure adds 7 days
-- labelled Monday..Sunday; one who wants a single repeatable day adds one.
-- Per-day macro target overrides fall back to the plan's own defaults when
-- null, giving the "build it however you'd like" flexibility Ellis asked
-- for without forcing every day to redeclare targets.
--
-- Swappable meal options (the other explicit ask: "different options can be
-- switched in and out by the athlete... if the coach allows"): every meal
-- has one or more `meal_options` (the app always creates at least a first
-- one alongside the meal itself), and `meals.allow_athlete_swap` gates
-- whether the athlete may change `meals.selected_option_id` themselves. RLS
-- policies see whole rows, not per-column diffs, so meals reuses the same
-- two-part pattern as notifications' read-only update (0019): a broad
-- UPDATE policy lets both owner and athlete into the row, and a BEFORE
-- UPDATE trigger (enforce_meal_update_permissions) does the actual
-- column-level and permission-flag enforcement.
--
-- Run this once in the Supabase SQL Editor. Safe to re-run.

-- ============================================================
-- foods
-- ============================================================
-- Per-100g basis (macros are "per 100g of this food"), the same convention
-- USDA FoodData Central itself uses — meal_items then just stores a gram
-- quantity and multiplies, rather than every food needing an arbitrarily
-- defined "serving". default_serving_g/default_serving_label are purely a
-- UI convenience (e.g. "1 medium egg (50g)") for pre-filling a sensible
-- quantity — macros are never computed from them.
--
-- id is a text slug, same shape as exercises.id: 'usda:<fdc_id>' for
-- imported USDA rows (fdc_id kept alongside as its own column too, so a
-- re-import can detect existing rows), a generated uuid string for
-- coach-custom foods.

create table if not exists public.foods (
  id text primary key,
  name text not null,
  brand text,
  source text not null default 'custom' check (source in ('usda', 'custom')),
  fdc_id integer,
  calories numeric not null,
  protein_g numeric not null default 0,
  carbs_g numeric not null default 0,
  fat_g numeric not null default 0,
  fiber_g numeric,
  sugar_g numeric,
  sodium_mg numeric,
  default_serving_g numeric,
  default_serving_label text,
  owner_id uuid references auth.users (id) on delete set null,
  is_archived boolean not null default false,
  search_vector tsvector,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists foods_fdc_id_idx on public.foods (fdc_id) where fdc_id is not null;
create index if not exists foods_owner_idx on public.foods (owner_id);
create index if not exists foods_search_vector_idx on public.foods using gin (search_vector);

alter table public.foods enable row level security;

drop policy if exists "foods are readable by owner, admins, or global" on public.foods;
drop policy if exists "foods are insertable by coaches and admins" on public.foods;
drop policy if exists "foods are editable by their owner or admins" on public.foods;
drop policy if exists "foods are deletable by owner or admins when unused" on public.foods;

create policy "foods are readable by owner, admins, or global"
  on public.foods for select
  using (
    auth.uid() is not null
    and (owner_id is null or owner_id = auth.uid() or public.is_admin(auth.uid()))
  );

create policy "foods are insertable by coaches and admins"
  on public.foods for insert
  with check (
    public.is_admin(auth.uid())
    or (
      owner_id = auth.uid()
      and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'coach')
    )
  );

create policy "foods are editable by their owner or admins"
  on public.foods for update
  using (public.is_admin(auth.uid()) or owner_id = auth.uid())
  with check (public.is_admin(auth.uid()) or owner_id = auth.uid());

-- The DELETE policy for foods (owner/admin, only when unused) is created at
-- the very end of this file — it references meal_items, which doesn't
-- exist yet at this point in the script.

create or replace function public.set_foods_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists foods_set_updated_at on public.foods;
create trigger foods_set_updated_at
  before update on public.foods
  for each row execute function public.set_foods_updated_at();

create or replace function public.set_foods_search_vector()
returns trigger
language plpgsql
as $$
begin
  new.search_vector :=
    setweight(to_tsvector('english', coalesce(new.name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(new.brand, '')), 'B');
  return new;
end;
$$;

drop trigger if exists foods_set_search_vector on public.foods;
create trigger foods_set_search_vector
  before insert or update on public.foods
  for each row execute function public.set_foods_search_vector();

-- ============================================================
-- nutrition_plans
-- ============================================================
-- Exactly the same owner/athlete shape as public.programs: owner_id is
-- always the coach (or the self-programming athlete, when athlete_id =
-- owner_id), athlete_id is who the plan is for. "Send to an athlete" will
-- be cloneMealPlan deep-copying the whole tree into a fresh row per
-- recipient (mirrors cloneProgram) rather than a shared row multiple
-- athletes read.

create table if not exists public.nutrition_plans (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  athlete_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  notes text,
  -- Plan-wide default macro targets. Nullable — a coach can skip targets
  -- entirely and just build a plan of meals with no numeric goal attached.
  -- Any nutrition_days row can override one or more of these; a null on
  -- the day falls back to the plan's own value.
  daily_calories_target numeric,
  daily_protein_target_g numeric,
  daily_carbs_target_g numeric,
  daily_fat_target_g numeric,
  is_active boolean not null default false,
  removed_by_athlete_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists nutrition_plans_owner_idx on public.nutrition_plans (owner_id);
create index if not exists nutrition_plans_athlete_idx on public.nutrition_plans (athlete_id);

alter table public.nutrition_plans enable row level security;

drop policy if exists "nutrition plans are readable by owner or athlete" on public.nutrition_plans;
drop policy if exists "admins can read all nutrition plans" on public.nutrition_plans;
drop policy if exists "nutrition plans are insertable by their owner" on public.nutrition_plans;
drop policy if exists "nutrition plans are editable by their owner" on public.nutrition_plans;
drop policy if exists "nutrition plans are deletable by their owner" on public.nutrition_plans;

create policy "nutrition plans are readable by owner or athlete"
  on public.nutrition_plans for select
  using (auth.uid() = owner_id or auth.uid() = athlete_id);

create policy "admins can read all nutrition plans"
  on public.nutrition_plans for select
  using (public.is_admin(auth.uid()));

create policy "nutrition plans are insertable by their owner"
  on public.nutrition_plans for insert
  with check (
    auth.uid() = owner_id
    and (
      athlete_id = owner_id
      or exists (
        select 1 from public.coach_clients cc
        where cc.coach_id = nutrition_plans.owner_id
          and cc.client_id = nutrition_plans.athlete_id
          and cc.status = 'active'
      )
    )
  );

create policy "nutrition plans are editable by their owner"
  on public.nutrition_plans for update
  using (auth.uid() = owner_id)
  with check (
    auth.uid() = owner_id
    and (
      athlete_id = owner_id
      or exists (
        select 1 from public.coach_clients cc
        where cc.coach_id = nutrition_plans.owner_id
          and cc.client_id = nutrition_plans.athlete_id
          and cc.status = 'active'
      )
    )
  );

create policy "nutrition plans are deletable by their owner"
  on public.nutrition_plans for delete
  using (auth.uid() = owner_id);

create or replace function public.set_nutrition_plans_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists nutrition_plans_set_updated_at on public.nutrition_plans;
create trigger nutrition_plans_set_updated_at
  before update on public.nutrition_plans
  for each row execute function public.set_nutrition_plans_updated_at();

-- ============================================================
-- nutrition_days
-- ============================================================
-- One flat, coach-ordered list per plan (no weeks layer — see file header).

create table if not exists public.nutrition_days (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.nutrition_plans (id) on delete cascade,
  position integer not null,
  label text,
  notes text,
  calories_target numeric,
  protein_target_g numeric,
  carbs_target_g numeric,
  fat_target_g numeric,
  created_at timestamptz not null default now()
);

create index if not exists nutrition_days_plan_idx on public.nutrition_days (plan_id, position);

alter table public.nutrition_days enable row level security;

drop policy if exists "nutrition days follow their plan's access" on public.nutrition_days;
drop policy if exists "admins can read all nutrition days" on public.nutrition_days;

create policy "admins can read all nutrition days"
  on public.nutrition_days for select
  using (public.is_admin(auth.uid()));

create policy "nutrition days follow their plan's access"
  on public.nutrition_days for all
  using (
    exists (
      select 1 from public.nutrition_plans p
      where p.id = nutrition_days.plan_id
        and (p.owner_id = auth.uid() or p.athlete_id = auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.nutrition_plans p
      where p.id = nutrition_days.plan_id
        and p.owner_id = auth.uid()
    )
  );

-- ============================================================
-- meals
-- ============================================================
-- selected_option_id is added via a separate `alter table` further down,
-- once meal_options exists — the two tables reference each other
-- (meal_options.meal_id -> meals.id, meals.selected_option_id ->
-- meal_options.id), so one of the two FKs has to come second. Likewise the
-- UPDATE policy and enforce_meal_update_permissions trigger (which need
-- meal_options to exist) are created further down, right after that column.

create table if not exists public.meals (
  id uuid primary key default gen_random_uuid(),
  day_id uuid not null references public.nutrition_days (id) on delete cascade,
  position integer not null,
  name text not null,
  notes text,
  -- When false (the default), only the first option (position 1) is ever
  -- shown to or usable by the athlete — any meal_options beyond that point
  -- are purely a coach-side planning convenience. When true, the athlete
  -- may change selected_option_id themselves (enforced by the trigger
  -- below, since RLS can't express "only this one column").
  allow_athlete_swap boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists meals_day_idx on public.meals (day_id, position);

alter table public.meals enable row level security;

drop policy if exists "meals are readable by their plan's owner or athlete" on public.meals;
drop policy if exists "admins can read all meals" on public.meals;
drop policy if exists "meals are insertable by their plan's owner" on public.meals;
drop policy if exists "meals are deletable by their plan's owner" on public.meals;

create policy "admins can read all meals"
  on public.meals for select
  using (public.is_admin(auth.uid()));

create policy "meals are readable by their plan's owner or athlete"
  on public.meals for select
  using (
    exists (
      select 1 from public.nutrition_days d
      join public.nutrition_plans p on p.id = d.plan_id
      where d.id = meals.day_id
        and (p.owner_id = auth.uid() or p.athlete_id = auth.uid())
    )
  );

create policy "meals are insertable by their plan's owner"
  on public.meals for insert
  with check (
    exists (
      select 1 from public.nutrition_days d
      join public.nutrition_plans p on p.id = d.plan_id
      where d.id = meals.day_id
        and p.owner_id = auth.uid()
    )
  );

create policy "meals are deletable by their plan's owner"
  on public.meals for delete
  using (
    exists (
      select 1 from public.nutrition_days d
      join public.nutrition_plans p on p.id = d.plan_id
      where d.id = meals.day_id
        and p.owner_id = auth.uid()
    )
  );

-- ============================================================
-- meal_options
-- ============================================================

create table if not exists public.meal_options (
  id uuid primary key default gen_random_uuid(),
  meal_id uuid not null references public.meals (id) on delete cascade,
  position integer not null,
  label text not null default 'Option A',
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists meal_options_meal_idx on public.meal_options (meal_id, position);

alter table public.meal_options enable row level security;

drop policy if exists "meal options follow their plan's access" on public.meal_options;
drop policy if exists "admins can read all meal options" on public.meal_options;

create policy "admins can read all meal options"
  on public.meal_options for select
  using (public.is_admin(auth.uid()));

create policy "meal options follow their plan's access"
  on public.meal_options for all
  using (
    exists (
      select 1 from public.meals m
      join public.nutrition_days d on d.id = m.day_id
      join public.nutrition_plans p on p.id = d.plan_id
      where m.id = meal_options.meal_id
        and (p.owner_id = auth.uid() or p.athlete_id = auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.meals m
      join public.nutrition_days d on d.id = m.day_id
      join public.nutrition_plans p on p.id = d.plan_id
      where m.id = meal_options.meal_id
        and p.owner_id = auth.uid()
    )
  );

-- Now that meal_options exists, add meals' half of the mutual reference,
-- plus the UPDATE policy and permission trigger that depend on it.

alter table public.meals
  add column if not exists selected_option_id uuid references public.meal_options (id) on delete set null;

drop policy if exists "meals are updatable by their plan's owner or athlete" on public.meals;

-- Broad on purpose: both owner and athlete may reach an UPDATE at the RLS
-- layer, unlike the insertable/deletable policies above which stay
-- owner-only for creating/removing meals outright. What either of them may
-- actually change once inside is narrowed by
-- enforce_meal_update_permissions below — RLS policies see whole rows, not
-- a column-level diff (same reasoning as notifications' read-only-update
-- trigger, 0019).
create policy "meals are updatable by their plan's owner or athlete"
  on public.meals for update
  using (
    exists (
      select 1 from public.nutrition_days d
      join public.nutrition_plans p on p.id = d.plan_id
      where d.id = meals.day_id
        and (p.owner_id = auth.uid() or p.athlete_id = auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.nutrition_days d
      join public.nutrition_plans p on p.id = d.plan_id
      where d.id = meals.day_id
        and (p.owner_id = auth.uid() or p.athlete_id = auth.uid())
    )
  );

create or replace function public.enforce_meal_update_permissions()
returns trigger
language plpgsql
as $$
declare
  plan_owner uuid;
  plan_athlete uuid;
begin
  select p.owner_id, p.athlete_id into plan_owner, plan_athlete
  from public.nutrition_days d
  join public.nutrition_plans p on p.id = d.plan_id
  where d.id = new.day_id;

  if auth.uid() = plan_owner then
    -- The coach can change anything about their own meal.
    return new;
  end if;

  if auth.uid() = plan_athlete then
    if not old.allow_athlete_swap then
      raise exception 'This meal does not allow the athlete to choose between options';
    end if;
    if new.day_id <> old.day_id
       or new.position <> old.position
       or new.name <> old.name
       or coalesce(new.notes, '') <> coalesce(old.notes, '')
       or new.allow_athlete_swap <> old.allow_athlete_swap then
      raise exception 'Athletes may only change which option is selected';
    end if;
    if new.selected_option_id is not null and not exists (
      select 1 from public.meal_options mo
      where mo.id = new.selected_option_id and mo.meal_id = new.id
    ) then
      raise exception 'selected_option_id must belong to this meal';
    end if;
    return new;
  end if;

  raise exception 'Not authorized to update this meal';
end;
$$;

drop trigger if exists meals_enforce_update_permissions on public.meals;
create trigger meals_enforce_update_permissions
  before update on public.meals
  for each row execute function public.enforce_meal_update_permissions();

-- ============================================================
-- meal_items
-- ============================================================
-- Gram-quantity line items within one meal_option. display_label is a
-- purely cosmetic override (e.g. "2 eggs", "1 scoop") so a coach can build
-- naturally without the athlete needing to think in grams — macros are
-- still always computed from quantity_g against the food's per-100g
-- values, never from display_label.

create table if not exists public.meal_items (
  id uuid primary key default gen_random_uuid(),
  meal_option_id uuid not null references public.meal_options (id) on delete cascade,
  position integer not null,
  food_id text not null references public.foods (id) on delete restrict,
  quantity_g numeric not null default 100,
  display_label text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists meal_items_meal_option_idx on public.meal_items (meal_option_id, position);
create index if not exists meal_items_food_idx on public.meal_items (food_id);

alter table public.meal_items enable row level security;

drop policy if exists "meal items follow their plan's access" on public.meal_items;
drop policy if exists "admins can read all meal items" on public.meal_items;

create policy "admins can read all meal items"
  on public.meal_items for select
  using (public.is_admin(auth.uid()));

create policy "meal items follow their plan's access"
  on public.meal_items for all
  using (
    exists (
      select 1 from public.meal_options mo
      join public.meals m on m.id = mo.meal_id
      join public.nutrition_days d on d.id = m.day_id
      join public.nutrition_plans p on p.id = d.plan_id
      where mo.id = meal_items.meal_option_id
        and (p.owner_id = auth.uid() or p.athlete_id = auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.meal_options mo
      join public.meals m on m.id = mo.meal_id
      join public.nutrition_days d on d.id = m.day_id
      join public.nutrition_plans p on p.id = d.plan_id
      where mo.id = meal_items.meal_option_id
        and p.owner_id = auth.uid()
    )
  );

-- ============================================================
-- foods: deferred DELETE policy (needs meal_items to exist)
-- ============================================================

create policy "foods are deletable by owner or admins when unused"
  on public.foods for delete
  using (
    (public.is_admin(auth.uid()) or owner_id = auth.uid())
    and not exists (select 1 from public.meal_items mi where mi.food_id = foods.id)
  );
