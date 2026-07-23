import type {
  BlockExercise,
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
