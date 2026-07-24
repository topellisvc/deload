import type { BlockExerciseRow, BlockType, DayRow, LoggedSet } from "@/lib/programs/types";

/**
 * One completed set/segment, kept client-side (and persisted as scratch
 * state, see training_mode_sessions) until Finish Workout turns each of
 * these into a real logged_sets row via createLoggedSet — same field names
 * as that function's params so handing a DraftSet to it needs no mapping.
 */
export interface DraftSet {
  blockExerciseId: string;
  setPrescriptionId: string | null;
  position: number;
  performedWeight: number | null;
  performedReps: number | null;
  performedRpe: number | null;
  performedDistanceMeters: number | null;
  performedDurationSeconds: number | null;
  performedPaceSecondsPerKm: number | null;
  performedHeartRate: number | null;
  performedCalories: number | null;
  notes: string | null;
}

/**
 * In-progress workout state — the whole of what's needed to resume exactly
 * where the athlete left off. No stored "current position": that's derived
 * by comparing draftSets against the program's exercise sequence (see
 * lib/training/sequence.ts) every time it's needed, so it can never drift
 * out of sync with the sets actually logged.
 */
export interface TrainingModeSession {
  id: string;
  trainingDayId: string;
  athleteId: string;
  startedAt: string;
  updatedAt: string;
  draftSets: DraftSet[];
  /** block_exercise_id -> free-text note, folded into a notes-only
   * logged_sets row per exercise at Finish Workout time. */
  exerciseNotes: Record<string, string>;
  workoutNote: string | null;
}

/** Raw shape of a training_mode_sessions row as Supabase returns it. */
export interface TrainingModeSessionRow {
  id: string;
  training_day_id: string;
  athlete_id: string;
  started_at: string;
  updated_at: string;
  draft_sets: DraftSet[] | null;
  exercise_notes: Record<string, string> | null;
  workout_note: string | null;
}

export function mapTrainingModeSessionRow(row: TrainingModeSessionRow): TrainingModeSession {
  return {
    id: row.id,
    trainingDayId: row.training_day_id,
    athleteId: row.athlete_id,
    startedAt: row.started_at,
    updatedAt: row.updated_at,
    draftSets: row.draft_sets ?? [],
    exerciseNotes: row.exercise_notes ?? {},
    workoutNote: row.workout_note,
  };
}

/**
 * One turn at one exercise in the guided flow. A straight block's single
 * exercise contributes one step per prescribed set; a superset/circuit
 * block's exercises interleave round-robin (A1, B1, A2, B2...) rather than
 * each running to completion before the next starts — see
 * buildExerciseSequence in sequence.ts. `roundNumber` (0-based) is which
 * round of its block this particular turn belongs to, e.g. to label "Round
 * 2 of 3" in a grouped block's UI.
 */
export interface ExerciseStep {
  blockExercise: BlockExerciseRow;
  blockId: string;
  blockType: BlockType;
  blockRounds: number;
  stepIndex: number;
  roundNumber: number;
}

/** The single day Training Mode runs — enough program/week context for the
 * Overview screen, without paying for the whole program tree the way
 * getProgramTree does (this is one day, not every week). */
export interface TrainingDayDetail {
  day: DayRow;
  week: { id: string; label: string | null; position: number };
  totalWeeks: number;
  program: { id: string; name: string; ownerId: string; athleteId: string };
}

/** The athlete's most recent *performed* occurrence of a given exercise —
 * compared against in the Exercise screen, deliberately never the
 * programmed target (see spec: "Do not compare against the programmed
 * workout"). */
export interface PreviousPerformance {
  performedOn: string;
  sets: LoggedSet[];
}
