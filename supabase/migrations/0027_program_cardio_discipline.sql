-- Adds 'cardio' as a fourth top-level program discipline, alongside the
-- existing resistance/running/hybrid. This is distinct from (but sits
-- alongside) the per-exercise 'cardio' ExerciseCategory that's existed
-- since migration 0012 (rowing machines, assault bikes, etc. inside any
-- program) — that was always about labeling one exercise block; this is
-- about labeling the whole program, e.g. a dedicated conditioning plan
-- that's cardio start to finish, the same way 'running' already works.
--
-- public.programs itself predates this project's tracked migrations (no
-- CREATE TABLE for it exists on file — see the "missing migration 0001"
-- gap), so its discipline check constraint's real name isn't known here.
-- Rather than guessing, this looks it up via pg_constraint and drops
-- whatever it's actually called before adding a clearly-named replacement.
-- program_templates (migration 0020) DOES have a known, unnamed-at-creation
-- constraint (Postgres defaults to `<table>_<column>_check`), so that one
-- is dropped directly by name.
--
-- Run this once in the Supabase SQL Editor, after 0026. Safe to re-run.

do $$
declare
  con record;
begin
  for con in
    select conname
    from pg_constraint
    where conrelid = 'public.programs'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%discipline%'
  loop
    execute format('alter table public.programs drop constraint %I', con.conname);
  end loop;
end $$;

alter table public.programs
  add constraint programs_discipline_check
  check (discipline in ('resistance', 'running', 'hybrid', 'cardio'));

alter table public.program_templates drop constraint if exists program_templates_discipline_check;
alter table public.program_templates
  add constraint program_templates_discipline_check
  check (discipline in ('resistance', 'running', 'hybrid', 'cardio'));
