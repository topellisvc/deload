import Link from "next/link";
import { CalendarDays, CheckCircle2, Dumbbell, PersonStanding, UsersRound, Waves } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ProgramSummary } from "@/lib/programs/types";

const DISCIPLINE_META = {
  resistance: { label: "Weights", Icon: Dumbbell },
  running: { label: "Running", Icon: PersonStanding },
  hybrid: { label: "Hybrid", Icon: Waves },
} as const;

interface ProgramCardProps {
  program: ProgramSummary;
  /** Only the owner can flip is_active (see migration 0010 — "owned" means
   * owner_id, matching every other edit action in this app), so the
   * control only renders for programs the current user owns. Everyone
   * else still sees the "Active" badge if it happens to be active. */
  canSetActive: boolean;
  settingActive: boolean;
  onSetActive: (programId: string) => void;
}

export function ProgramCard({ program, canSetActive, settingActive, onSetActive }: ProgramCardProps) {
  const { label, Icon } = DISCIPLINE_META[program.discipline];

  return (
    <Link href={`/programs/${program.id}`} className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
      <Card className={cn("transition-colors hover:bg-surface-hover", program.is_active && "border-primary/50")}>
        <CardContent className="flex flex-col gap-3 p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
              <Icon className="size-3.5" />
              {label}
            </span>
            {program.is_active && (
              <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                <CheckCircle2 className="size-3.5" />
                Active
              </span>
            )}
          </div>
          <h3 className="text-lg font-semibold tracking-tight text-foreground">{program.name}</h3>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <CalendarDays className="size-4" />
            {program.weekCount} {program.weekCount === 1 ? "week" : "weeks"} · {program.dayCount}{" "}
            {program.dayCount === 1 ? "day" : "days"}/week
          </div>
          {program.assignmentLabel && (
            <div className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-primary">
              <UsersRound className="size-3.5 shrink-0" />
              {/* flex items don't shrink below their content width by default
                  (min-width: auto), so `truncate` alone does nothing here
                  without min-w-0 on the span too — a long client email would
                  otherwise overflow the card instead of ellipsizing. */}
              <span className="min-w-0 flex-1 truncate">{program.assignmentLabel}</span>
            </div>
          )}
          {canSetActive && !program.is_active && (
            <Button
              variant="outline"
              size="sm"
              disabled={settingActive}
              onClick={(e) => {
                // Card is wrapped in a Link (navigate to the program) — this
                // button needs to act without triggering that navigation.
                e.preventDefault();
                e.stopPropagation();
                onSetActive(program.id);
              }}
              className="mt-1 self-start"
            >
              {settingActive ? "Setting active…" : "Set as active"}
            </Button>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
