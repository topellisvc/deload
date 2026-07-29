-- Free-text user feedback: "what could be better" opinions submitted from
-- the account menu (see SendFeedbackDialog), reviewable by admins on the
-- /admin dashboard (see FeedbackQueue). Deliberately minimal — one message
-- per row, an optional page_url for context on where the feedback came
-- from, and a two-state status (new/reviewed) so admins can triage without
-- anything getting lost. No categories/ratings/attachments; add those only
-- if real usage shows they're needed.
--
-- Run this once in the Supabase SQL Editor, after 0036. Safe to re-run.

-- ============================================================
-- feedback
-- ============================================================

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  message text not null check (char_length(message) between 1 and 4000),
  -- Wherever the person was in the app when they opened the dialog
  -- (window.location.pathname) — just triage context for admins, not
  -- used for anything functional.
  page_url text,
  status text not null default 'new' check (status in ('new', 'reviewed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists feedback_user_id_idx on public.feedback (user_id);
create index if not exists feedback_status_idx on public.feedback (status);
create index if not exists feedback_created_at_idx on public.feedback (created_at desc);

alter table public.feedback enable row level security;

-- Anyone signed in can submit feedback under their own user_id.
drop policy if exists "feedback is insertable by its author" on public.feedback;
create policy "feedback is insertable by its author"
  on public.feedback for insert
  with check (auth.uid() = user_id);

-- A user can see their own submissions; admins can see everyone's (the
-- /admin queue's whole data source). Uses public.is_admin() (migration
-- 0022) rather than an inline profiles subquery to avoid RLS recursion.
drop policy if exists "feedback is readable by its author or admins" on public.feedback;
create policy "feedback is readable by its author or admins"
  on public.feedback for select
  using (auth.uid() = user_id or public.is_admin(auth.uid()));

-- Only admins can change anything post-submission (marking reviewed) —
-- authors can't edit/withdraw once sent, same as the rest of the app has
-- no "edit your own coaching message" pattern either.
drop policy if exists "feedback is updatable by admins" on public.feedback;
create policy "feedback is updatable by admins"
  on public.feedback for update
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

create or replace function public.set_feedback_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists feedback_set_updated_at on public.feedback;
create trigger feedback_set_updated_at
  before update on public.feedback
  for each row execute function public.set_feedback_updated_at();
