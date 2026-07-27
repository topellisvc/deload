-- Adds an open-ended "advanced_config" column to set_prescriptions — the
-- extensibility point the Program Builder's Advanced Mode reads and writes
-- so future specialised programming methods (tempo, drop sets, cluster
-- sets, wave loading, EMOM, AMRAP, time caps, contrast training,
-- accommodating resistance, chains/bands, and any coach-defined custom
-- field) don't each need their own schema migration and column plumbed
-- through every layer. Advanced Mode ships with a generic key/value
-- "Custom Fields" editor bound to this column today (see
-- lib/programs/advanced-fields.ts); a later method that wants a named,
-- structured shape can read/write known keys inside the same jsonb rather
-- than adding a new column, and the rare method that genuinely needs a real
-- typed/indexed column can still get one — this doesn't rule that out, it
-- just means the common case ("attach a bit of extra structured detail to
-- a prescription row") doesn't force a migration every time.
--
-- Nullable, defaults to null (not '{}'::jsonb) — a set row nobody has ever
-- opened in Advanced Mode has a null here, not an empty object, so Simple
-- Mode (and every existing query) never has to think about this column at
-- all.
--
-- Run this once in the Supabase SQL Editor, after 0029. Safe to re-run.

alter table public.set_prescriptions
  add column if not exists advanced_config jsonb;
