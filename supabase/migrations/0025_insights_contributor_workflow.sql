-- Insights Phase 2, part 1: lets a signed-in user apply to become a
-- contributor (reviewed by an admin -- "Editors" reuse is_admin rather
-- than a new permission tier, per how this app has stayed at just
-- role + is_admin instead of building out roles nobody needs yet), and
-- tightens article-writing access to only kick in once that application
-- is actually approved.
--
-- Run this once in the Supabase SQL Editor, after 0023 and 0024. Safe to
-- re-run.

-- ============================================================
-- insights_contributors: application/review columns
-- ============================================================
alter table public.insights_contributors
  add column if not exists status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  add column if not exists applied_at timestamptz not null default now(),
  add column if not exists reviewed_at timestamptz,
  add column if not exists review_note text;

-- Every contributor row seeded so far (0024) has no linked login
-- (profile_id is null) -- that's house/editorial content, not a real
-- person's application, so it's pre-approved rather than sitting in the
-- review queue. Any future row a real signed-in user creates for
-- themselves (profile_id = auth.uid()) starts 'pending' via the new
-- column's default and the insert policy below.
update public.insights_contributors set status = 'approved', reviewed_at = now() where profile_id is null and status = 'pending';

-- One contributor row per real account -- a second application from the
-- same profile_id should edit/resubmit the existing row, not create a
-- second one.
create unique index if not exists insights_contributors_profile_id_unique_idx
  on public.insights_contributors (profile_id) where profile_id is not null;

-- A non-admin can update their own contributor row (to edit their bio, or
-- to resubmit after a rejection), but must never be able to set their own
-- status to 'approved' -- that's the one thing only an admin's review
-- action should be able to do. Enforced here at the database level
-- (rather than only in the mutation function) since RLS's `with check`
-- can't easily compare a proposed new value against the row's old value
-- for a single column. The one exception: 'rejected' -> 'pending' is
-- allowed for anyone, since resubmitting your own rejected application
-- shouldn't require an admin's involvement.
create or replace function public.insights_contributors_guard_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status and not public.is_admin(auth.uid()) then
    if old.status = 'rejected' and new.status = 'pending' then
      -- allowed: self-resubmission after rejection
    else
      new.status := old.status;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists insights_contributors_guard_status_trigger on public.insights_contributors;
create trigger insights_contributors_guard_status_trigger
  before update on public.insights_contributors
  for each row execute function public.insights_contributors_guard_status();

-- ============================================================
-- insights_contributors: RLS -- replaces 0023's single "anyone can read
-- contributors using (true)" now that a pending/rejected application
-- shouldn't be publicly visible.
-- ============================================================
drop policy if exists "anyone can read contributors" on public.insights_contributors;

drop policy if exists "anyone can read approved contributors" on public.insights_contributors;
create policy "anyone can read approved contributors"
  on public.insights_contributors for select
  using (status = 'approved');

drop policy if exists "contributors can read their own application" on public.insights_contributors;
create policy "contributors can read their own application"
  on public.insights_contributors for select
  using (profile_id = auth.uid());

drop policy if exists "admins can read all contributors" on public.insights_contributors;
create policy "admins can read all contributors"
  on public.insights_contributors for select
  using (public.is_admin(auth.uid()));

drop policy if exists "users can apply to become a contributor" on public.insights_contributors;
create policy "users can apply to become a contributor"
  on public.insights_contributors for insert
  with check (profile_id = auth.uid() and status = 'pending');

drop policy if exists "admins can insert any contributor" on public.insights_contributors;
create policy "admins can insert any contributor"
  on public.insights_contributors for insert
  with check (public.is_admin(auth.uid()));

drop policy if exists "contributors can update their own profile" on public.insights_contributors;
create policy "contributors can update their own profile"
  on public.insights_contributors for update
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

drop policy if exists "admins can update any contributor" on public.insights_contributors;
create policy "admins can update any contributor"
  on public.insights_contributors for update
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

drop policy if exists "admins can delete any contributor" on public.insights_contributors;
create policy "admins can delete any contributor"
  on public.insights_contributors for delete
  using (public.is_admin(auth.uid()));

-- ============================================================
-- insights_articles: editor feedback + tightened write access
-- ============================================================
alter table public.insights_articles add column if not exists editor_note text;

-- Re-scoped from 0023: writing articles now requires an *approved*
-- contributor row, not just any contributor row linked to the caller --
-- otherwise someone mid-application (status still 'pending') could
-- already draft and submit articles before ever being reviewed.
drop policy if exists "contributors can insert their own articles" on public.insights_articles;
create policy "contributors can insert their own articles"
  on public.insights_articles for insert
  with check (contributor_id in (select id from public.insights_contributors where profile_id = auth.uid() and status = 'approved'));

drop policy if exists "contributors can update their own articles" on public.insights_articles;
create policy "contributors can update their own articles"
  on public.insights_articles for update
  using (contributor_id in (select id from public.insights_contributors where profile_id = auth.uid() and status = 'approved'))
  with check (contributor_id in (select id from public.insights_contributors where profile_id = auth.uid() and status = 'approved'));

drop policy if exists "contributors can delete their own draft articles" on public.insights_articles;
create policy "contributors can delete their own draft articles"
  on public.insights_articles for delete
  using (
    status = 'draft'
    and contributor_id in (select id from public.insights_contributors where profile_id = auth.uid() and status = 'approved')
  );
