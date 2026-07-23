import Link from "next/link";
import { CalendarDays, Dumbbell, PersonStanding, UsersRound, Waves } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { ProgramSummary } from "@/lib/programs/types";

const DISCIPLINE_META = {
  resistance: { label: "Weights", Icon: Dumbbell },
  running: { label: "Running", Icon: PersonStanding },
  hybrid: { label: "Hybrid", Icon: Waves },
} as const;

export function ProgramCard({ program }: { program: ProgramSummary }) {
  const { label, Icon } = DISCIPLINE_META[program.discipline];

  return (
    <Link href={`/programs/${program.id}`} className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
      <Card className="transition-colors hover:bg-surface-hover">
        <CardContent className="flex flex-col gap-3 p-5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
              <Icon className="size-3.5" />
              {label}
            </span>
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
        </CardContent>
      </Card>
    </Link>
  );
}
