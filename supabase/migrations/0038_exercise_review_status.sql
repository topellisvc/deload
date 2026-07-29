-- Coach-submitted exercises need review before anyone but their creator can
-- use them: "coaches should be able to see their own added exercises, but
-- they are added to review for everyone else to use." Global/admin-created
-- exercises (owner_id null) are exempt entirely — they're already trusted,
-- curated content — so this only ever gates coach-owned rows.
--
-- Run this once in the Supabase SQL Editor, after 0037. Safe to re-run.

alter table public.exercises
  add column if not exists review_status text not null default 'pending'
  check (review_status in ('pending', 'approved', 'rejected'));

-- Backfill: every row that exists today is seeded or admin-created
-- (owner_id is null for all of them), so mark them approved outright — the
-- 'pending' default above only matters for new coach-owned inserts going
-- forward. Without this, the admin panel's badge would wrongly flag every
-- one of the seeded 100 as "pending review."
update public.exercises set review_status = 'approved' where owner_id is null;

create index if not exists exercises_review_status_idx on public.exercises (review_status) where owner_id is not null;

-- Visibility: a global/admin exercise (owner_id null) is always visible. A
-- coach-owned exercise is visible to its owner and admins regardless of
-- status, and to everyone else only once approved.
drop policy if exists "exercises are readable by any authenticated user" on public.exercises;
create policy "exercises are readable by owner, admins, or once approved"
  on public.exercises for select
  using (
    auth.uid() is not null
    and (owner_id is null or review_status = 'approved' or owner_id = auth.uid() or public.is_admin(auth.uid()))
  );

-- Coaches can only ever insert their own exercise as 'pending' — prevents a
-- crafted insert from self-approving on the way in. Admins can insert (and
-- pass) any status, since CreateExerciseDialog's admin flow always uses
-- owner_id null anyway (see that column's own review-exempt rule above).
drop policy if exists "exercises are insertable by coaches and admins" on public.exercises;
create policy "exercises are insertable by coaches and admins"
  on public.exercises for insert
  with check (
    public.is_admin(auth.uid())
    or (
      owner_id = auth.uid()
      and review_status = 'pending'
      and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'coach')
    )
  );

-- Belt-and-suspenders against the existing "editable by their owner or
-- admins" UPDATE policy: a coach editing their own exercise (name,
-- description, etc — which that policy already allows) still can't flip
-- review_status themselves this way. RLS's WITH CHECK alone can't compare
-- the new value to the old one, so this needs a trigger, which can see
-- both.
create or replace function public.protect_exercise_review_status()
returns trigger
language plpgsql
as $$
begin
  if new.review_status is distinct from old.review_status and not public.is_admin(auth.uid()) then
    new.review_status := old.review_status;
  end if;
  return new;
end;
$$;

drop trigger if exists exercises_protect_review_status on public.exercises;
create trigger exercises_protect_review_status
  before update on public.exercises
  for each row execute function public.protect_exercise_review_status();
