import Link from "next/link";
import { CalendarClock, Dumbbell, Moon, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SkipWorkoutButton } from "@/components/dashboard/skip-workout-button";
import type { ActiveProgramContext } from "@/lib/dashboard/types";

/** Server-rendered, so this reflects the server's clock rather than the
 * viewer's — same simplification the rest of the app's "today" logic
 * already makes (see queries.ts's todayDateString), not worth a client
 * round-trip just for a greeting. */
function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

interface HeroSectionProps {
  displayName: string | null;
  email: string;
  athleteId: string;
  activeContext: ActiveProgramContext | null;
}

export function HeroSection({ displayName, email, athleteId, activeContext }: HeroSectionProps) {
  const name = displayName || email.split("@")[0] || "there";

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-surface to-surface p-6 sm:p-8">
      <p className="text-sm font-medium text-muted-foreground">
        {greeting()}, {name}
      </p>

      {!activeContext ? (
        <EmptyHero />
      ) : !activeContext.today ? (
        <NoDaysHero programName={activeContext.program.name} />
      ) : activeContext.today.day.is_rest_day ? (
        <RestDayHero context={activeContext} />
      ) : (
        <WorkoutHero context={activeContext} athleteId={athleteId} />
      )}
    </div>
  );
}

function WorkoutHero({ context, athleteId }: { context: ActiveProgramContext; athleteId: string }) {
  const { program, today } = context;
  if (!today) return null;
  const exerciseCount = today.day.blocks.reduce((n, b) => n + b.exercises.length, 0);

  return (
    <div className="mt-4 flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <p className="text-xs font-medium uppercase tracking-wide text-primary">
          {program.name} · {today.weekLabel}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {today.day.label || `Day ${today.day.position}`}
        </h1>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Dumbbell className="size-4" />
          {exerciseCount} {exerciseCount === 1 ? "exercise" : "exercises"}
        </span>
        <span className="flex items-center gap-1.5">
          <CalendarClock className="size-4" />
          Week {today.weekPosition} of {today.totalWeeks}
        </span>
      </div>

      {today.completedToday ? (
        <div className="flex flex-wrap items-center gap-3">
          <Link href={`/programs/${program.id}`}>
            <Button variant="outline">View workout</Button>
          </Link>
          <span className="text-xs text-muted-foreground">
            Completed{" "}
            {today.completedAt
              ? new Date(today.completedAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
              : "today"}
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Link href={`/train/${today.day.id}`} className="w-fit">
            <Button>Start workout</Button>
          </Link>
          <SkipWorkoutButton trainingDayId={today.day.id} athleteId={athleteId} />
        </div>
      )}
    </div>
  );
}

function RestDayHero({ context }: { context: ActiveProgramContext }) {
  const { program, today } = context;
  if (!today) return null;
  return (
    <div className="mt-4 flex flex-col gap-3">
      <p className="text-xs font-medium uppercase tracking-wide text-primary">
        {program.name} · {today.weekLabel}
      </p>
      <div className="flex items-center gap-2">
        <Moon className="size-5 text-primary" />
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Rest day</h1>
      </div>
      <p className="text-sm text-muted-foreground">No training scheduled today — recovery is part of the plan.</p>
    </div>
  );
}

function NoDaysHero({ programName }: { programName: string }) {
  return (
    <div className="mt-4 flex flex-col gap-2">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{programName}</h1>
      <p className="text-sm text-muted-foreground">This program doesn&apos;t have any days set up yet.</p>
    </div>
  );
}

function EmptyHero() {
  return (
    <div className="mt-4 flex flex-col gap-3">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">No active program yet</h1>
      <p className="text-sm text-muted-foreground">
        Pick a program to follow and it&apos;ll drive your whole dashboard — today&apos;s workout, progress, all of it.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link href="/programs">
          <Button>
            <PlusCircle className="size-4" />
            Create a program
          </Button>
        </Link>
        <Link href="/programs">
          <Button variant="outline">Choose an existing one</Button>
        </Link>
      </div>
    </div>
  );
}
