-- Adds `block_role` to exercise_blocks -- the Program Builder's new
-- Warm-up and Conditioning/Finisher sections (spec: each training day may
-- optionally begin with a Warm-up section and end with a
-- Conditioning/Finisher section, both visually separate from the main
-- workout). A block's role decides which of the three sections it renders
-- in; 'main' is the default so every existing block keeps behaving exactly
-- as before.
--
-- Widens the day's position uniqueness from (day_id, position) to
-- (day_id, block_role, position) so each section manages its own
-- independent 1..N position sequence -- the same "position is scoped to
-- its parent" pattern every other level of the tree already uses
-- (set_prescriptions scoped to block_exercise_id, block_exercises to
-- block_id, etc.). Without this, reordering within one section could
-- collide with an unrelated block in a different section of the same day.
--
-- exercise_blocks predates this project's tracked migrations (see 0027's
-- note on the same "missing migration 0001" gap for `programs`), so its
-- unique constraint's real name isn't known here -- looked up via
-- pg_constraint rather than guessed, same approach 0027 used.
--
-- Run this once in the Supabase SQL Editor, after 0031. Safe to re-run.

alter table public.exercise_blocks
  add column if not exists block_role text not null default 'main'
    check (block_role in ('warmup', 'main', 'conditioning'));

do $$
declare
  con record;
begin
  for con in
    select conname
    from pg_constraint
    where conrelid = 'public.exercise_blocks'::regclass
      and contype = 'u'
      and pg_get_constraintdef(oid) ilike '%day_id%'
      and pg_get_constraintdef(oid) ilike '%position%'
  loop
    execute format('alter table public.exercise_blocks drop constraint %I', con.conname);
  end loop;
end $$;

alter table public.exercise_blocks
  add constraint exercise_blocks_day_id_block_role_position_key
  unique (day_id, block_role, position);
