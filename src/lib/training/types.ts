import type { DayRow, LoggedSet } from "@/lib/programs/types";
import type { ReadinessCheck } from "@/lib/training/autoregulation";

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
  /** Reps in reserve, as reported after the last working set of an
   * autoregulation-eligible exercise (see lib/training/autoregulation.ts and
   * the RIR-check step in training-session.tsx). Null for every other set —
   * this is only ever asked once per exercise, not per set, so it's set on
   * the exercise's final DraftSet after the fact rather than collected at
   * StrengthSetLogger's own two-tap input. */
  performedRir: number | null;
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
 * by comparing draftSets against the program's exercise list (see
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
  /** block_exercise_id -> optional reason (or null if the athlete didn't
   * give one). An exercise present here is treated as done for resume
   * purposes (see findResumeExerciseId) without any logged sets, and is
   * folded into a notes-only "Skipped" logged_sets row at Finish Workout
   * time, same mechanism as exerciseNotes. */
  skippedExercises: Record<string, string | null>;
  workoutNote: string | null;
  /** Rule 3's two-question pre-session readiness check (coach-answers §2
   * Rule 3) — null until the athlete answers it, right after Begin. Never
   * re-asked on resume: a page refresh mid-workout keeps whatever answer
   * (or lack of one) was already recorded, the same "don't lose progress,
   * don't repeat a question" spirit as every other piece of draft state
   * here. See lib/training/autoregulation.ts for the downregulation
   * decision this feeds. */
  readiness: ReadinessCheck | null;
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
  skipped_exercises: Record<string, string | null> | null;
  workout_note: string | null;
  /** jsonb, defaults to '{}' at the database level (migration 0044) — `{}`
   * and a genuinely absent answer look the same on the wire, so the mapper
   * below treats anything without a recognizable `sleep` field as "not
   * answered yet" rather than trusting the row's raw shape. */
  readiness: Partial<ReadinessCheck> | null;
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
    skippedExercises: row.skipped_exercises ?? {},
    workoutNote: row.workout_note,
    readiness: row.readiness && row.readiness.sleep && row.readiness.soreness ? (row.readiness as ReadinessCheck) : null,
  };
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
