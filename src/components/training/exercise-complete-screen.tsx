import { CheckCircle2 } from "lucide-react";

/**
 * Brief transitional confirmation between exercises — "no manual navigation
 * required" (spec). Purely presentational; the parent state machine owns
 * the timer that advances past this automatically.
 */
export function ExerciseCompleteScreen({ exerciseName }: { exerciseName: string }) {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <CheckCircle2 className="size-16 text-success" />
      <h2 className="text-2xl font-bold text-foreground">Exercise Complete</h2>
      <p className="text-sm text-muted-foreground">{exerciseName}</p>
    </div>
  );
}
