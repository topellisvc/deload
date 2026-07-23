-- Coach/client accounts.
--
-- The programs table has always had owner_id/athlete_id as separate
-- columns (see schema.sql), anticipating this. What's been missing is any
-- way for a coach to know *who* their clients are before they've been
-- assigned a program — this migration adds that roster.
--
-- Design constraint: this app has no Supabase service-role key configured
-- (only the public anon key), so there's no admin API available to
-- pre-create accounts or send custom invite emails. Instead, inviting a
-- client reuses the existing passwordless sign-in mechanism: the coach
-- triggers `supabase.auth.signInWithOtp({ email })` for the client's
-- address (this is a normal anon-key call, not an admin one — it just
-- sends that person a real magic-link email, creating their account if
-- they don't have one yet), and records a pending row here keyed by
-- email. When that person actually signs in, the app resolves any
-- pending row matching their email to their now-known user id.
--
-- Coaching is also the paid tier: self-programming (building your own
-- programs) is free for everyone, but only an account with
-- profiles.role = 'coach' can invite clients or be assigned as a
-- program's owner for someone else. There's no billing wired up yet —
-- upgrading just flips the role directly (see upgradeToCoach) — but the
-- INSERT policy below enforces the gate at the database level regardless
-- of what the UI does, the same way every other table in this schema
-- enforces access via RLS rather than trusting application code. Swapping
-- in real billing later only means changing what triggers that same
-- role flip, not touching this policy.
--
-- Run this once in the Supabase SQL Editor after pulling this change.
-- Safe to re-run: every statement is idempotent.

create table if not exists public.coach_clients (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references auth.users (id) on delete cascade,
  -- Null until the invited person actually signs in for the first time
  -- and we can resolve their email to a real user id.
  client_id uuid references auth.users (id) on delete cascade,
  client_email text not null,
  -- Captured from the coach's own session at invite time (their own data,
  -- not a privacy concern) so the client side of the relationship has a
  -- way to show "assigned by <coach>" without needing to read auth.users
  -- (which client code can't query) or depend on profiles.display_name
  -- (which nothing in this app currently sets).
  coach_email text not null,
  status text not null default 'pending' check (status in ('pending', 'active')),
  created_at timestamptz not null default now(),
  unique (coach_id, client_email)
);

-- Belt and suspenders in case this file is ever re-run after a partial
-- apply (e.g. the table got created by an earlier version of this
-- migration before coach_email existed) — `create table if not exists`
-- alone wouldn't add a column to an already-existing table.
alter table public.coach_clients add column if not exists coach_email text not null default '';
alter table public.coach_clients alter column coach_email drop default;

create index if not exists coach_clients_coach_idx on public.coach_clients (coach_id);
create index if not exists coach_clients_client_idx on public.coach_clients (client_id);

alter table public.coach_clients enable row level security;

-- Re-runnable: policies don't support `create or replace`, so drop first.
drop policy if exists "coaches manage their own client roster" on public.coach_clients;
drop policy if exists "coaches can view their own roster" on public.coach_clients;
drop policy if exists "only coaches can create client invites" on public.coach_clients;
drop policy if exists "coaches can update their own roster rows" on public.coach_clients;
drop policy if exists "coaches can delete their own roster rows" on public.coach_clients;
drop policy if exists "clients can see relationships naming them" on public.coach_clients;
drop policy if exists "clients can accept their own pending invite" on public.coach_clients;
drop policy if exists "linked coach or client can read each other's profile" on public.profiles;

-- A coach can always see, update, or delete rows in their own roster —
-- split from insert (below) so downgrading a coach back to 'athlete'
-- later can't accidentally still let them silently manage stale rows in
-- a way that bypasses the paid-tier gate; insert is where that gate
-- actually needs to bite.
create policy "coaches can view their own roster"
  on public.coach_clients for select
  using (auth.uid() = coach_id);

-- The actual paywall: creating a new invite requires profiles.role =
-- 'coach' on top of the ordinary "it's your own roster" check. A coach
-- who's since been downgraded keeps read/update/delete on what they
-- already built (nothing already-assigned breaks), they just can't
-- create new invites until upgraded again.
create policy "only coaches can create client invites"
  on public.coach_clients for insert
  with check (
    auth.uid() = coach_id
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'coach')
  );

create policy "coaches can update their own roster rows"
  on public.coach_clients for update
  using (auth.uid() = coach_id)
  with check (auth.uid() = coach_id);

create policy "coaches can delete their own roster rows"
  on public.coach_clients for delete
  using (auth.uid() = coach_id);

-- The invited person can see any row naming them, before or after their
-- account exists to match client_id (matched by email in the meantime).
-- Case-insensitive: client_email is always stored lowercase by the app
-- (see inviteClient), but a pre-existing account's auth.users.email may
-- not be — someone who originally signed up as "Jane@Example.com" would
-- otherwise never match an invite stored as "jane@example.com".
create policy "clients can see relationships naming them"
  on public.coach_clients for select
  using (client_id = auth.uid() or lower(client_email) = lower(auth.jwt() ->> 'email'));

-- The invited person can resolve their own pending invite (fill in
-- client_id, flip to active) the first time they sign in — but only for a
-- row that's still pending and addressed to their own verified email; they
-- can't otherwise touch a coach's roster.
create policy "clients can accept their own pending invite"
  on public.coach_clients for update
  using (lower(client_email) = lower(auth.jwt() ->> 'email') and client_id is null)
  with check (client_id = auth.uid() and lower(client_email) = lower(auth.jwt() ->> 'email'));

-- Profiles are otherwise private (owner-only, see schema.sql). Coaching
-- needs a narrow exception: once a coach_clients relationship exists
-- (either direction, either status), each side can read the other's
-- profile — today that's just display_name, used for "assigned by
-- <name>" / client-list labels instead of raw email addresses.
create policy "linked coach or client can read each other's profile"
  on public.profiles for select
  using (
    exists (
      select 1 from public.coach_clients cc
      where (cc.coach_id = auth.uid() and cc.client_id = profiles.id)
         or (cc.client_id = auth.uid() and cc.coach_id = profiles.id)
    )
  );

-- schema.sql's original programs insert/update policies only ever checked
-- "you're signed in as the owner" — fine when owner_id and athlete_id were
-- always equal (Phase 1), but now that a coach can genuinely set
-- athlete_id to someone else, that alone would let anyone attach a
-- program to an arbitrary stranger's account just by knowing their user
-- id. Tightened here to also require an active coach_clients relationship
-- with that athlete whenever athlete_id differs from the owner.
drop policy if exists "programs are insertable by their owner" on public.programs;
create policy "programs are insertable by their owner"
  on public.programs for insert
  with check (
    auth.uid() = owner_id
    and (
      athlete_id = owner_id
      or exists (
        select 1 from public.coach_clients cc
        where cc.coach_id = owner_id and cc.client_id = athlete_id and cc.status = 'active'
      )
    )
  );

drop policy if exists "programs are editable by their owner" on public.programs;
create policy "programs are editable by their owner"
  on public.programs for update
  using (auth.uid() = owner_id)
  with check (
    auth.uid() = owner_id
    and (
      athlete_id = owner_id
      or exists (
        select 1 from public.coach_clients cc
        where cc.coach_id = owner_id and cc.client_id = athlete_id and cc.status = 'active'
      )
    )
  );
