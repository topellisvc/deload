-- In-app + email notifications: engagement-loop feature.
--
-- Scope, deliberately narrow: only two events actually create a
-- notification today —
--   1. A coach assigns/sends a program to an athlete (createProgram,
--      cloneProgram in lib/programs/mutations.ts, when athlete_id differs
--      from the acting owner).
--   2. A pending coaching invite is accepted (acceptInvite in
--      lib/coaching/mutations.ts).
-- "Invite sent" deliberately has no in-app row here: the invitee often has
-- no auth.users row yet at that point (coach_clients.client_id is null
-- until they first sign in — see 0003_coach_clients.sql), so there's no
-- recipient_id to write. They already get Supabase's own magic-link email
-- from signInWithOtp at invite time; that's the notification for that leg.
--
-- Same shape/precedent as messages (0011_coaching_hub.sql): a plain
-- recipient-owned inbox, RLS-gated read-only-after-insert, realtime so a
-- bell badge updates live instead of only on next page load.
--
-- Run this once in the Supabase SQL Editor. Safe to re-run.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users (id) on delete cascade,
  -- Who/what caused this — nullable so a recipient's own history survives
  -- the actor's account being deleted later, rather than cascading away.
  actor_id uuid references auth.users (id) on delete set null,
  type text not null check (type in ('program_assigned', 'invite_accepted')),
  title text not null,
  body text,
  -- App-relative path the bell should navigate to when clicked, e.g.
  -- '/programs/<id>' or '/coaching'. Nullable in case a future type has
  -- nothing sensible to link to.
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_recipient_idx on public.notifications (recipient_id, created_at desc);
-- Partial index: only unread rows are ever queried by this shape (bell
-- badge count), same reasoning as messages_unread_by_recipient_idx.
create index if not exists notifications_unread_by_recipient_idx on public.notifications (recipient_id) where (read_at is null);

alter table public.notifications enable row level security;

drop policy if exists "notifications are readable by their recipient" on public.notifications;
drop policy if exists "notifications are insertable by the actor for a real relationship" on public.notifications;
drop policy if exists "recipients can mark their notifications read" on public.notifications;

create policy "notifications are readable by their recipient"
  on public.notifications for select
  using (recipient_id = auth.uid());

-- The actor must be the authenticated caller (can't forge a notification
-- as someone else), and the pair must be a genuine, currently-active
-- coaching relationship in either direction — the same guard the programs
-- table itself already applies whenever owner_id/athlete_id differ (see
-- 0003_coach_clients.sql), so this can never fire for two strangers.
create policy "notifications are insertable by the actor for a real relationship"
  on public.notifications for insert
  with check (
    actor_id = auth.uid()
    and recipient_id <> auth.uid()
    and exists (
      select 1 from public.coach_clients cc
      where cc.status = 'active'
        and (
          (cc.coach_id = actor_id and cc.client_id = recipient_id)
          or (cc.client_id = actor_id and cc.coach_id = recipient_id)
        )
    )
  );

create policy "recipients can mark their notifications read"
  on public.notifications for update
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

-- RLS's using/with_check see whole rows, not a column diff — this trigger
-- is that diff check, so the read-status update above can't be repurposed
-- into editing a notification's actual content. Mirrors
-- enforce_message_read_only_update (0011_coaching_hub.sql).
create or replace function public.enforce_notification_read_only_update()
returns trigger
language plpgsql
as $$
begin
  if new.recipient_id <> old.recipient_id
     or coalesce(new.actor_id::text, '') <> coalesce(old.actor_id::text, '')
     or new.type <> old.type
     or new.title <> old.title
     or coalesce(new.body, '') <> coalesce(old.body, '')
     or coalesce(new.link, '') <> coalesce(old.link, '')
     or new.created_at <> old.created_at then
    raise exception 'Only read_at can be changed on an existing notification';
  end if;
  return new;
end;
$$;

drop trigger if exists notifications_read_only_update on public.notifications;
create trigger notifications_read_only_update
  before update on public.notifications
  for each row execute function public.enforce_notification_read_only_update();

-- ============================================================
-- Realtime
-- ============================================================

-- NotificationBell subscribes to postgres_changes INSERT events on this
-- table so the badge/list update live, not just on next page load.
-- `alter publication ... add table` errors if the table's already a
-- member, so this is guarded the same way 0011 guards the same statement
-- for messages.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
