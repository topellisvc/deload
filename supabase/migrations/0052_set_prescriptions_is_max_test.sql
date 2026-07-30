-- Marks a set_prescriptions row as a testing-week "find your max" set,
-- distinct from an ordinary percent_1rm/rir row. Both a testing-week row
-- and a later percent_1rm row that reads its result carry the same
-- pr_record_type (e.g. 'squat'), but only the testing-week row should
-- trigger writing a new personal_records value when it's actually logged —
-- is_max_test is the flag the logging mutation checks to tell the two
-- apart, since ProgramPhase ("testing" vs "standard") is a generation-time
-- concept only and isn't persisted anywhere on program_weeks.
alter table public.set_prescriptions
  add column is_max_test boolean not null default false;

comment on column public.set_prescriptions.is_max_test is
  'True for a testing-week single graded top set whose logged result should automatically update personal_records for pr_record_type. False for every other row, including a later percent_1rm row that merely reads that same record type for display.';
