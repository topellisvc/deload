import { EXERCISE_REVIEW_STATUS_LABELS } from "@/lib/exercises/constants";
import type { ExerciseReviewStatus } from "@/lib/exercises/types";
import { cn } from "@/lib/utils";

const REVIEW_STATUS_CLASSES: Record<ExerciseReviewStatus, string> = {
  pending: "bg-warning/10 text-warning",
  approved: "bg-success/10 text-success",
  rejected: "bg-danger/10 text-danger",
};

/** Only ever rendered for a coach-owned exercise — a global/admin one is
 * always "approved" (migration 0038) and callers skip this badge for those
 * rather than show a redundant "Approved" tag everywhere. */
export function ReviewStatusBadge({ status, className }: { status: ExerciseReviewStatus; className?: string }) {
  return (
    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold", REVIEW_STATUS_CLASSES[status], className)}>
      {EXERCISE_REVIEW_STATUS_LABELS[status]}
    </span>
  );
}
