import Link from "next/link";
import { Target } from "lucide-react";

/**
 * Goal is free text (profile.goal), so there's no structured target to
 * measure progress against yet — displaying it plainly rather than
 * fabricating a progress bar. Once goals become structured (a target
 * number + unit), this is the one place that needs to change to add a
 * progress indicator.
 */
export function GoalsSection({ goal }: { goal: string | null }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-6">
      <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-muted-foreground">Goals</h2>
      {goal ? (
        <div className="flex items-start gap-2.5">
          <Target className="mt-0.5 size-4 shrink-0 text-primary" />
          <p className="text-sm text-foreground">{goal}</p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No goal set yet. Add one from your{" "}
          <Link href="/profile" className="text-primary hover:underline">
            profile
          </Link>{" "}
          to see it here.
        </p>
      )}
    </div>
  );
}
