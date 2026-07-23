-- Lets a client explicitly decline a pending invite, or leave an active
-- coaching relationship later, by deleting the coach_clients row that
-- names them. Previously only the coach could delete these rows.
--
-- This pairs with an app-level change: accepting an invite used to
-- happen automatically the moment someone with a matching email signed
-- in for *any* reason — which meant a coach could type in someone else's
-- email and, if that person ever naturally signed in to use the app for
-- unrelated reasons, get silently linked as their client with no
-- awareness or consent. Acceptance is now an explicit button click
-- (acceptInvite), and this policy is what makes "no thanks" possible too.
--
-- Run this once in the Supabase SQL Editor. Safe to re-run.

drop policy if exists "clients can remove relationships naming them" on public.coach_clients;

create policy "clients can remove relationships naming them"
  on public.coach_clients for delete
  using (client_id = auth.uid() or lower(client_email) = lower(auth.jwt() ->> 'email'));
