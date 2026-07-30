-- Bug: deleting a user who's ever been a notification's actor_id fails
-- with "ERROR: Only read_at can be changed on an existing notification"
-- (confirmed live via auth logs on an actual failed /admin delete-user
-- attempt). Root cause: notifications.actor_id is `on delete set null`
-- (migration 0019, deliberately — "a recipient's own history survives the
-- actor's account being deleted later"), but 0019's own read-only-update
-- trigger blocked *any* change to actor_id, including the one Postgres
-- itself performs to enact that exact cascade. The two were never
-- exercised together until a real actor (e.g. a coach who'd sent an
-- invite, now with an invite_received/invite_accepted row naming them)
-- was actually deleted.
--
-- Fix: only block actor_id changes that *aren't* a transition to null.
-- Tampering (reassigning a notification to a different actor, or setting
-- one where there was none) is still rejected exactly as before; only the
-- legitimate "actor's account is gone" cascade is now allowed through.
--
-- Run this once in the Supabase SQL Editor. Safe to re-run.

create or replace function public.enforce_notification_read_only_update()
returns trigger
language plpgsql
as $$
begin
  if new.recipient_id <> old.recipient_id
     or (new.actor_id is distinct from old.actor_id and new.actor_id is not null)
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
