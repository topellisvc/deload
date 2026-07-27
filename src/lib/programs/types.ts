import type {
  BlockExercise,
  BlockRole,
  BlockType,
  CardioPrescriptionType,
  ExerciseBlock,
  ExerciseCategory,
  LoggedSet,
  PrescriptionType,
  Program,
  ProgramDiscipline,
  ProgramWeek,
  RunningPrescriptionType,
  SetPrescription,
  StrengthPrescriptionType,
  TrainingDay,
} from "@/lib/supabase/types";

export type {
  BlockRole,
  BlockType,
  CardioPrescriptionType,
  ExerciseCategory,
  LoggedSet,
  PrescriptionType,
  Program,
  ProgramDiscipline,
  ProgramWeek,
  RunningPrescriptionType,
  StrengthPrescriptionType,
  TrainingDay,
  ExerciseBlock,
  BlockExercise,
  SetPrescription,
};

/**
 * The full nested shape the program builder works with. Fetched once
 * server-side (queries.ts stitches it together from flat table reads) and
 * then mutated locally as the source of truth for the UI, with each edit
 * fired off to Supabase in the background (mutations.ts) — see
 * ProgramBuilder for the optimistic-update pattern.
 */
export type SetRow = SetPrescription;

export interface BlockExerciseRow extends BlockExercise {
  sets: SetRow[];
}

export interface BlockRow extends ExerciseBlock {
  exercises: BlockExerciseRow[];
}

export interface DayRow extends TrainingDay {
  blocks: BlockRow[];
}

export interface WeekRow extends ProgramWeek {
  days: DayRow[];
}

export interface ProgramTree extends Program {
  weeks: WeekRow[];
}

/** Lightweight shape for the programs list page — no nested tree needed. */
export interface ProgramSummary extends Program {
  weekCount: number;
  dayCount: number;
  /** e.g. "For jane@example.com" or "From coach@example.com" — null when
   * owner_id === athlete_id (self-programmed, the common case). */
  assignmentLabel: string | null;
}

/**
 * A personal, reusable program template (migration 0020) — distinct from
 * the hardcoded starter templates (starter-templates.ts, which aren't
 * database rows at all). `template_data.weeks` is a `WeekRow[]` snapshot
 * of whatever program it was saved from, materialized the same way
 * cloneProgram clones a sibling program: one addWeek call per stored week.
 */
export interface ProgramTemplateRow {
  id: string;
  owner_id: string;
  name: string;
  discipline: ProgramDiscipline;
  template_data: { weeks: WeekRow[] };
  created_at: string;
}

/**
 * A saved, reusable exercise prescription (migration 0033) — "Bench Press,
 * 5x5 @ 80%, Rest 2min, note," insertable with one click into any day's
 * Warm-up/Main/Conditioning section. `template_data` is a full
 * `BlockExerciseRow` snapshot, ids and all — exactly like
 * ProgramTemplateRow.template_data stores a full `WeekRow[]` snapshot with
 * its original (by-then-stale) ids. Materializing
 * (addExerciseBlockFromTemplate, mutations.ts) never reads those ids as
 * real foreign keys; it generates entirely fresh ones, the same
 * clone-with-fresh-ids shape duplicateExercise already uses for a *live*
 * exercise — this is that same operation, just sourced from a stored
 * snapshot instead.
 */
export interface ExerciseTemplateRow {
  id: string;
  owner_id: string;
  name: string;
  exercise_category: ExerciseCategory;
  template_data: BlockExerciseRow;
  created_at: string;
}

/**
 * A saved, reusable training day (migration 0033) — "Upper Strength,"
 * "Lower Hypertrophy," reusable across programs, not just within the one
 * it was saved from. `template_data.blocks` is a full `BlockRow[]`
 * snapshot, same stale-ids-as-structure-only convention as
 * ExerciseTemplateRow above. Materializing (insertDayTemplate,
 * mutations.ts) clones every block/exercise/set with fresh ids, the same
 * shape copyDayContents already uses to clone a day's contents into
 * another day.
 */
export interface DayTemplateRow {
  id: string;
  owner_id: string;
  name: string;
  template_data: { blocks: BlockRow[] };
  created_at: string;
}
