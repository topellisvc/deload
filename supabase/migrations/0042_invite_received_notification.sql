-- Migration 0019 deliberately skipped an in-app notification for "invite
-- sent", reasoning that the invitee usually has no auth.users row yet at
-- that point. True for a genuinely new signup, but not for someone who
-- already has a Deload account under the invited email — that person is
-- reachable right now, and currently gets nothing but a plain sign-in
-- email indistinguishable from any other login, then has to stumble onto
-- /coaching themselves to discover the invite (see the "notification
-- doesn't work" report — there's no bug in the bell itself, this event
-- was just never wired up).
--
-- Run this once in the Supabase SQL Editor. Safe to re-run.

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('program_assigned', 'invite_accepted', 'invite_received'));

-- Additive alongside the existing "active relationship" insert policy
-- (0019) rather than loosening it — that one still requires status =
-- 'active' with both ids resolved, which a pending invite never has.
-- This one is scoped narrowly enough to not need that: only for
-- 'invite_received', and only when the actor has a genuine *pending*
-- invite whose client_email matches the recipient's own profile email.
-- A coach can't use this to notify an arbitrary stranger — the matching
-- pending row has to already exist, meaning they already knew and
-- entered this exact email through the ordinary invite flow.
create policy "notifications are insertable by the actor for a pending invite"
  on public.notifications for insert
  with check (
    actor_id = auth.uid()
    and recipient_id <> auth.uid()
    and type = 'invite_received'
    and exists (
      select 1
      from public.coach_clients cc
      join public.profiles p on p.id = recipient_id
      where cc.coach_id = actor_id
        and cc.status = 'pending'
        and lower(cc.client_email) = lower(p.email)
    )
  );
