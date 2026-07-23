"use client";

import { Repeat } from "lucide-react";
import type { BlockRow, LoggedSet } from "@/lib/programs/types";
import type { PersonalRecord } from "@/lib/supabase/types";
import { ExercisePerformanceCard } from "@/components/programs/exercise-performance-card";

interface SessionPerformanceEditorProps {
  sessionLogId: string;
  blocks: BlockRow[];
  /** Keyed by `${session_log_id}:${block_exercise_id}` — see
   * groupLoggedSetsByExercise in lib/logging/queries.ts. Passing the whole
   * map (not pre-filtered to this session) is fine since the lookup below
   * only ever reads the keys for this sessionLogId. */
  loggedSetsByExercise: Record<string, LoggedSet[]>;
  /** For prefilling a suggested weight when logging a percent_1rm set. */
  personalRecords: PersonalRecord[];
  readOnly?: boolean;
}

/**
 * Every exercise for one logged day, each showing Prescription (planned)
 * directly above Performance (what actually happened) — this is the
 * concrete implementation of the spec's workout-logging requirement.
 * Scoped to a single session_log_id so the athlete can log each dated
 * occurrence of a repeating training day independently (see
 * DayLogControl, which renders one of these per log entry).
 */
export function SessionPerformanceEditor({ sessionLogId, blocks, loggedSetsByExercise, personalRecords, readOnly }: SessionPerformanceEditorProps) {
  return (
    <div className="flex flex-col gap-2.5">
      {blocks.map((block) => {
        const isGrouped = block.exercises.length > 1;
        return (
          <div key={block.id} className="flex flex-col gap-2.5">
            {isGrouped && (
              <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
                <Repeat className="size-3.5" />
                Superset · {block.rounds} rounds
              </div>
            )}
            {block.exercises.map((exercise) => (
              <ExercisePerformanceCard
                key={exercise.id}
                sessionLogId={sessionLogId}
                exercise={exercise}
                loggedSets={loggedSetsByExercise[`${sessionLogId}:${exercise.id}`] ?? []}
                personalRecords={personalRecords}
                readOnly={readOnly}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}
