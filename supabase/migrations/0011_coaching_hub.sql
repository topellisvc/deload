-- Coaching hub: powers the new /coaching page. Two additive changes —
-- neither touches the existing coach_clients/profiles/programs permission
-- model from 0003_coach_clients.sql, per the product spec's explicit "do
-- not redesign permissions" constraint.
--
-- 1. Two new nullable columns on the existing coach_clients table (not a
--    new table): an optional message a coach can attach to an invite, and
--    the actual acceptance timestamp (created_at is when the invite was
--    *sent*, which isn't the same thing as "coaching since" once someone
--    accepts days later).
-- 2. A new messages table for coach<->athlete messaging — the one genuinely
--    new table the spec calls for. Conversations aren't a separate concept:
--    each coach_clients row already *is* a 1:1 relationship, so it doubles
--    as the conversation id rather than inventing a parallel conversations
--    table.
--
-- Run this once in the Supabase SQL Editor. Safe to re-run.

-- ============================================================
-- coach_clients additions
-- ============================================================

alter table public.coach_clients add column if not exists invite_message text;
alter table public.coach_clients add column if not exists accepted_at timestamptz;

-- ============================================================
-- messages
-- ============================================================

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  coach_client_id uuid not null references public.coach_clients (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,
  recipient_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(btrim(body)) > 0),
  -- Nullable and unused today — reserved so attachments are a later
  -- addition to this same row, not a schema migration.
  attachment_url text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists messages_conversation_idx on public.messages (coach_client_id, created_at);
-- Partial index: only unread rows are ever queried by this shape (unread
-- counts/badges), so there's no reason to index the (much larger) read set.
create index if not exists messages_unread_by_recipient_idx on public.messages (recipient_id) where (read_at is null);

alter table public.messages enable row level security;

drop policy if exists "messages are readable by either party" on public.messages;
drop policy if exists "messages are sendable by either party in an active relationship" on public.messages;
drop policy if exists "recipients can mark their messages read" on public.messages;

create policy "messages are readable by either party"
  on public.messages for select
  using (sender_id = auth.uid() or recipient_id = auth.uid());

-- Requires status = 'active': a pending invite has no messaging yet, since
-- the two people aren't in a coaching relationship until it's accepted.
-- Also requires the (sender, recipient) pair to actually be the two people
-- named on that coach_clients row, in either direction — stops someone
-- from writing a message on a relationship row that isn't theirs even if
-- they somehow knew its id.
create policy "messages are sendable by either party in an active relationship"
  on public.messages for insert
  with check (
    sender_id = auth.uid()
    and recipient_id <> auth.uid()
    and exists (
      select 1 from public.coach_clients cc
      where cc.id = coach_client_id
        and cc.status = 'active'
        and (
          (cc.coach_id = sender_id and cc.client_id = recipient_id)
          or (cc.client_id = sender_id and cc.coach_id = recipient_id)
        )
    )
  );

create policy "recipients can mark their messages read"
  on public.messages for update
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

-- RLS alone can't express "only read_at may change on this update" — using
-- and with_check see whole rows, not a column diff. This trigger is that
-- diff check, so the read-status update above can't be repurposed into a
-- silent edit of someone else's message body.
create or replace function public.enforce_message_read_only_update()
returns trigger
language plpgsql
as $$
begin
  if new.sender_id <> old.sender_id
     or new.recipient_id <> old.recipient_id
     or new.coach_client_id <> old.coach_client_id
     or new.body <> old.body
     or new.created_at <> old.created_at
     or coalesce(new.attachment_url, '') <> coalesce(old.attachment_url, '') then
    raise exception 'Only read_at can be changed on an existing message';
  end if;
  return new;
end;
$$;

drop trigger if exists messages_read_only_update on public.messages;
create trigger messages_read_only_update
  before update on public.messages
  for each row execute function public.enforce_message_read_only_update();

-- ============================================================
-- Realtime
-- ============================================================

-- MessageThread subscribes to postgres_changes INSERT events on this table
-- so the other party sees new messages arrive live, not just on next page
-- load. `alter publication ... add table` errors if the table's already a
-- member, so this is guarded the same way the rest of this migration is
-- guarded for safe re-runs.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;
