import Link from "next/link";
import { CalendarDays, CheckCircle2, Dumbbell, PersonStanding, Send, UsersRound, Waves } from "lucide-react";
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
  /** Same owner-only gating as canSetActive — sending a copy edits/creates
   * a program, so only the owner can do it. */
  canSend: boolean;
  sendingCopy: boolean;
  onSend: (programId: string) => void;
}

export function ProgramCard({
  program,
  canSetActive,
  settingActive,
  onSetActive,
  canSend,
  sendingCopy,
  onSend,
}: ProgramCardProps) {
  const { label, Icon } = DISCIPLINE_META[program.discipline];

  // assignmentLabel starting with "For " means the viewer is the coach and
  // this program's athlete is someone else — that's the case a coach's
  // combined /programs list can show several of at once (one active
  // program per client is normal, not a bug), so it gets its own color and
  // wording to make clear "active" here means active *for that client*,
  // not for the person looking at the list. A "From " program (the viewer
  // IS the athlete, just on a coach-assigned plan) is the viewer's own
  // active program and keeps the plain badge.
  const activeForClient = program.is_active && program.assignmentLabel?.startsWith("For ") ? program.assignmentLabel.slice(4) : null;

  return (
    <Link href={`/programs/${program.id}`} className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
      <Card
        className={cn(
          "transition-colors hover:bg-surface-hover",
          program.is_active && (activeForClient ? "border-success/50" : "border-primary/50")
        )}
      >
        <CardContent className="flex flex-col gap-3 p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
              <Icon className="size-3.5" />
              {label}
            </span>
            {program.is_active && (
              <span
                className={cn(
                  "flex min-w-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
                  activeForClient ? "bg-success/15 text-success" : "bg-primary/10 text-primary"
                )}
              >
                <CheckCircle2 className="size-3.5 shrink-0" />
                {activeForClient ? <span className="truncate">Active for {activeForClient}</span> : "Active"}
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
          {(canSetActive || canSend) && (
            <div className="mt-1 flex flex-wrap gap-2">
              {canSetActive && !program.is_active && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={settingActive}
                  onClick={(e) => {
                    // Card is wrapped in a Link (navigate to the program) —
                    // these buttons need to act without triggering that
                    // navigation.
                    e.preventDefault();
                    e.stopPropagation();
                    onSetActive(program.id);
                  }}
                >
                  {settingActive ? "Setting active…" : "Set as active"}
                </Button>
              )}
              {canSend && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={sendingCopy}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onSend(program.id);
                  }}
                >
                  <Send className="size-3.5" />
                  {sendingCopy ? "Loading…" : "Send a copy"}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
