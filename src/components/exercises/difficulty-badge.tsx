import { EXERCISE_DIFFICULTY_LABELS } from "@/lib/exercises/constants";
import type { ExerciseDifficulty } from "@/lib/exercises/types";
import { cn } from "@/lib/utils";

const DIFFICULTY_CLASSES: Record<ExerciseDifficulty, string> = {
  beginner: "bg-success/10 text-success",
  intermediate: "bg-warning/10 text-warning",
  advanced: "bg-danger/10 text-danger",
};

export function DifficultyBadge({ difficulty, className }: { difficulty: ExerciseDifficulty; className?: string }) {
  return (
    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold", DIFFICULTY_CLASSES[difficulty], className)}>
      {EXERCISE_DIFFICULTY_LABELS[difficulty]}
    </span>
  );
}
