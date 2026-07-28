-- The Exercise Library: a shared, database-backed catalog that becomes the
-- single source of truth for every exercise in the platform (Program
-- Builder, Training Mode, athlete workout view, coach workflow, future
-- analytics). Replaces the hardcoded 62-entry array in
-- lib/workout-generator/exercises.ts as the *canonical* source, though that
-- file is left in place unchanged — it's still read by the workout
-- generator to build new programs, and its ids are reused verbatim as this
-- table's primary keys below so every existing block_exercises.exercise_id
-- value keeps resolving with zero data migration.
--
-- Scope note: category / movement_pattern / primary_muscle_group /
-- equipment / difficulty are modelled as `text` + `check` constraints
-- (fixed, small vocabularies straight out of the product spec) rather than
-- separate lookup tables (exercise_categories, equipment, muscle_groups,
-- movement_patterns as their own tables). Simpler to seed, query and filter
-- with no meaningful loss of scalability since these vocabularies are
-- genuinely closed sets. Tags stay a free `text[]` since those are
-- explicitly unlimited/open-ended.
--
-- Also a deliberate scope cut, made with the app owner up front: this
-- migration builds the core relational model plus ONE documented extension
-- point (`exercises.metadata jsonb`) rather than dedicated tables/columns
-- for every "future ready" item in the spec (3D models, video coaching,
-- ratings, community comments, muscle activation diagrams, AI
-- recommendations, injury contraindications, translations, offline
-- support, etc). Add those as metadata keys first; promote to a real
-- column/table only once a feature actually needs to query on it.
--
-- Run this once in the Supabase SQL Editor, after 0034. Safe to re-run.

-- ============================================================
-- exercises
-- ============================================================
-- id is a text slug (e.g. 'barbell-back-squat'), not a uuid — this is what
-- lets every existing program keep working: block_exercises.exercise_id
-- already stores exactly these strings (see resolveExerciseId in
-- lib/programs/exercise-catalog.ts), just validated against an in-code
-- array instead of a real table until now.
--
-- owner_id null = a global/system exercise (seeded, or admin-created).
-- owner_id set = a coach's custom exercise. Matches the spec's permission
-- model directly: coaches can create/edit their own (owner_id = them),
-- everyone can read every exercise, only admins can touch global ones.

create table if not exists public.exercises (
  id text primary key,
  name text not null,
  category text not null check (category in (
    'strength', 'running', 'cardio', 'mobility', 'stretching', 'plyometrics', 'olympic_lifting'
  )),
  movement_pattern text check (movement_pattern in (
    'push', 'pull', 'squat', 'hinge', 'lunge', 'carry', 'rotation', 'anti_rotation', 'jump', 'throw'
  )),
  primary_muscle_group text not null check (primary_muscle_group in (
    'chest', 'back', 'shoulders', 'quadriceps', 'hamstrings', 'glutes', 'calves',
    'core', 'biceps', 'triceps', 'forearms', 'full_body'
  )),
  secondary_muscle_groups text[] not null default '{}',
  equipment text not null check (equipment in (
    'barbell', 'dumbbell', 'machine', 'cable', 'resistance_band', 'bodyweight',
    'kettlebell', 'medicine_ball', 'cardio_machine'
  )),
  difficulty text not null check (difficulty in ('beginner', 'intermediate', 'advanced')),
  description text,
  -- Structured instructions (spec: "Setup, Execution, Breathing, Finishing
  -- Position"). Columns rather than a child table — this is fixed 1:1
  -- structured data per exercise, not a genuine one-to-many list.
  instructions_setup text,
  instructions_execution text,
  instructions_breathing text,
  instructions_finishing text,
  tags text[] not null default '{}',
  thumbnail_url text,
  -- Documented extension point for every "future ready" field the spec
  -- lists that doesn't yet have a concrete feature reading it: video urls,
  -- 3D model refs, difficulty/fatigue scores, muscle activation diagrams,
  -- language translations, etc. Keep app-layer types for whatever keys are
  -- actually in use; promote a key to a real column once something queries
  -- or filters on it.
  metadata jsonb not null default '{}'::jsonb,
  owner_id uuid references auth.users (id) on delete set null,
  is_archived boolean not null default false,
  -- Full text search across name/category/muscle group/equipment/tags —
  -- "search should feel fast" (spec). Regenerated automatically by
  -- Postgres on every write, no app-side upkeep.
  search_vector tsvector generated always as (
    setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(array_to_string(tags, ' '), '')), 'B') ||
    setweight(to_tsvector('english', coalesce(replace(category, '_', ' '), '')), 'C') ||
    setweight(to_tsvector('english', coalesce(replace(primary_muscle_group, '_', ' '), '')), 'C') ||
    setweight(to_tsvector('english', coalesce(replace(equipment, '_', ' '), '')), 'C') ||
    setweight(to_tsvector('english', coalesce(replace(movement_pattern, '_', ' '), '')), 'C')
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists exercises_category_idx on public.exercises (category) where not is_archived;
create index if not exists exercises_primary_muscle_group_idx on public.exercises (primary_muscle_group) where not is_archived;
create index if not exists exercises_equipment_idx on public.exercises (equipment) where not is_archived;
create index if not exists exercises_movement_pattern_idx on public.exercises (movement_pattern) where not is_archived;
create index if not exists exercises_owner_idx on public.exercises (owner_id);
create index if not exists exercises_tags_idx on public.exercises using gin (tags);
create index if not exists exercises_search_vector_idx on public.exercises using gin (search_vector);

alter table public.exercises enable row level security;

drop policy if exists "exercises are readable by any authenticated user" on public.exercises;
drop policy if exists "exercises are insertable by coaches and admins" on public.exercises;
drop policy if exists "exercises are editable by their owner or admins" on public.exercises;
drop policy if exists "exercises are deletable by admins when unused" on public.exercises;

create policy "exercises are readable by any authenticated user"
  on public.exercises for select
  using (auth.uid() is not null);

create policy "exercises are insertable by coaches and admins"
  on public.exercises for insert
  with check (
    public.is_admin(auth.uid())
    or (
      owner_id = auth.uid()
      and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'coach')
    )
  );

create policy "exercises are editable by their owner or admins"
  on public.exercises for update
  using (public.is_admin(auth.uid()) or owner_id = auth.uid())
  with check (public.is_admin(auth.uid()) or owner_id = auth.uid());

-- "Delete Exercises (only when safe)" — enforced declaratively rather than
-- in application code: an admin can only delete a row that nothing in a
-- live program actually references.
create policy "exercises are deletable by admins when unused"
  on public.exercises for delete
  using (
    public.is_admin(auth.uid())
    and not exists (select 1 from public.block_exercises be where be.exercise_id = exercises.id)
  );

create or replace function public.set_exercises_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists exercises_set_updated_at on public.exercises;
create trigger exercises_set_updated_at
  before update on public.exercises
  for each row execute function public.set_exercises_updated_at();

-- ============================================================
-- exercise_coaching_cues
-- ============================================================

create table if not exists public.exercise_coaching_cues (
  id uuid primary key default gen_random_uuid(),
  exercise_id text not null references public.exercises (id) on delete cascade,
  cue text not null,
  position integer not null default 0
);

create index if not exists exercise_coaching_cues_exercise_idx on public.exercise_coaching_cues (exercise_id, position);

alter table public.exercise_coaching_cues enable row level security;

drop policy if exists "coaching cues are readable by any authenticated user" on public.exercise_coaching_cues;
drop policy if exists "coaching cues are writable by the exercise's owner or admins" on public.exercise_coaching_cues;

create policy "coaching cues are readable by any authenticated user"
  on public.exercise_coaching_cues for select
  using (auth.uid() is not null);

create policy "coaching cues are writable by the exercise's owner or admins"
  on public.exercise_coaching_cues for all
  using (
    exists (
      select 1 from public.exercises e
      where e.id = exercise_coaching_cues.exercise_id
        and (public.is_admin(auth.uid()) or e.owner_id = auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.exercises e
      where e.id = exercise_coaching_cues.exercise_id
        and (public.is_admin(auth.uid()) or e.owner_id = auth.uid())
    )
  );

-- ============================================================
-- exercise_common_mistakes
-- ============================================================

create table if not exists public.exercise_common_mistakes (
  id uuid primary key default gen_random_uuid(),
  exercise_id text not null references public.exercises (id) on delete cascade,
  mistake text not null,
  correction text,
  position integer not null default 0
);

create index if not exists exercise_common_mistakes_exercise_idx on public.exercise_common_mistakes (exercise_id, position);

alter table public.exercise_common_mistakes enable row level security;

drop policy if exists "common mistakes are readable by any authenticated user" on public.exercise_common_mistakes;
drop policy if exists "common mistakes are writable by the exercise's owner or admins" on public.exercise_common_mistakes;

create policy "common mistakes are readable by any authenticated user"
  on public.exercise_common_mistakes for select
  using (auth.uid() is not null);

create policy "common mistakes are writable by the exercise's owner or admins"
  on public.exercise_common_mistakes for all
  using (
    exists (
      select 1 from public.exercises e
      where e.id = exercise_common_mistakes.exercise_id
        and (public.is_admin(auth.uid()) or e.owner_id = auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.exercises e
      where e.id = exercise_common_mistakes.exercise_id
        and (public.is_admin(auth.uid()) or e.owner_id = auth.uid())
    )
  );

-- ============================================================
-- exercise_relationships
-- ============================================================
-- One row per directed link. Progressions/regressions are naturally
-- directional (Push Up -> Weighted Push Up is a progression; the reverse
-- edge, if wanted, is its own row). Variations are stored as a single row
-- per pair and treated as symmetric by the app (shown on both exercises'
-- detail pages regardless of which side is `exercise_id`).

create table if not exists public.exercise_relationships (
  id uuid primary key default gen_random_uuid(),
  exercise_id text not null references public.exercises (id) on delete cascade,
  related_exercise_id text not null references public.exercises (id) on delete cascade,
  relationship_type text not null check (relationship_type in ('progression', 'regression', 'variation')),
  position integer not null default 0,
  unique (exercise_id, related_exercise_id, relationship_type),
  constraint exercise_relationships_not_self check (exercise_id <> related_exercise_id)
);

create index if not exists exercise_relationships_exercise_idx on public.exercise_relationships (exercise_id, relationship_type, position);
create index if not exists exercise_relationships_related_idx on public.exercise_relationships (related_exercise_id);

alter table public.exercise_relationships enable row level security;

drop policy if exists "exercise relationships are readable by any authenticated user" on public.exercise_relationships;
drop policy if exists "exercise relationships are writable by the exercise's owner or admins" on public.exercise_relationships;

create policy "exercise relationships are readable by any authenticated user"
  on public.exercise_relationships for select
  using (auth.uid() is not null);

create policy "exercise relationships are writable by the exercise's owner or admins"
  on public.exercise_relationships for all
  using (
    exists (
      select 1 from public.exercises e
      where e.id = exercise_relationships.exercise_id
        and (public.is_admin(auth.uid()) or e.owner_id = auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.exercises e
      where e.id = exercise_relationships.exercise_id
        and (public.is_admin(auth.uid()) or e.owner_id = auth.uid())
    )
  );

-- ============================================================
-- block_exercises: wire exercise_id up to the new table
-- ============================================================
-- Added NOT VALID: every exercise_id currently in the table was already
-- assigned from the same fixed set of ids this migration seeds into
-- `exercises` (see resolveExerciseId), so this should hold for all existing
-- rows — but NOT VALID means a stray/legacy value can't block this
-- migration from applying. Run `validate constraint` by hand later once
-- confirmed clean.

alter table public.block_exercises drop constraint if exists block_exercises_exercise_id_fkey;
alter table public.block_exercises
  add constraint block_exercises_exercise_id_fkey
  foreign key (exercise_id) references public.exercises (id) on delete set null
  not valid;

-- ============================================================
-- merge_exercises: admin-only "Merge Duplicate Exercises"
-- ============================================================
-- Repoints every real reference (program exercises, relationship edges)
-- from `source_id` onto `target_id`, then archives `source_id` rather than
-- hard-deleting it — keeps a historical record and stays reversible, unlike
-- the separate delete-when-unused path above. security definer so a single
-- admin action can touch rows across several tables in one transaction
-- without needing broader RLS grants.

create or replace function public.merge_exercises(source_id text, target_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'only admins can merge exercises';
  end if;

  if source_id = target_id then
    raise exception 'cannot merge an exercise into itself';
  end if;

  if not exists (select 1 from public.exercises where id = target_id) then
    raise exception 'target exercise % does not exist', target_id;
  end if;

  update public.block_exercises set exercise_id = target_id where exercise_id = source_id;

  -- Repoint relationship edges as insert-else-skip (rather than a plain
  -- update) so an edge that would collapse into a self-reference, or
  -- duplicate one that already exists on the target, is silently dropped
  -- instead of throwing a unique-constraint error mid-merge.
  insert into public.exercise_relationships (exercise_id, related_exercise_id, relationship_type, position)
  select target_id, related_exercise_id, relationship_type, position
  from public.exercise_relationships
  where exercise_id = source_id and related_exercise_id <> target_id
  on conflict (exercise_id, related_exercise_id, relationship_type) do nothing;

  insert into public.exercise_relationships (exercise_id, related_exercise_id, relationship_type, position)
  select exercise_id, target_id, relationship_type, position
  from public.exercise_relationships
  where related_exercise_id = source_id and exercise_id <> target_id
  on conflict (exercise_id, related_exercise_id, relationship_type) do nothing;

  delete from public.exercise_relationships where exercise_id = source_id or related_exercise_id = source_id;

  update public.exercises
  set is_archived = true,
      name = name || ' (merged into ' || target_id || ')'
  where id = source_id;
end;
$$;
