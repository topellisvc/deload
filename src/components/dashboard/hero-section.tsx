import Link from "next/link";
import { CalendarClock, ChevronLeft, ChevronRight, Dumbbell, ListOrdered, Moon, PlusCircle, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SkipWorkoutButton } from "@/components/dashboard/skip-workout-button";
import { StarterProgramPicker } from "@/components/programs/starter-program-picker";
import { formatLogTime } from "@/lib/dates";
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
  /** Browse to an adjacent scheduled day — resolved entirely client-side
   * from data already on the page (see day-view.ts), not a server
   * round-trip, so this needs to come from the caller rather than a plain
   * `?day=<id>` Link the way it used to. */
  onNavigateDay: (dayId: string) => void;
  onGoToToday: () => void;
}

export function HeroSection({ displayName, email, athleteId, activeContext, onNavigateDay, onGoToToday }: HeroSectionProps) {
  const name = displayName || email.split("@")[0] || "there";

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-surface to-surface p-6 sm:p-8">
      <p className="text-sm font-medium text-muted-foreground">
        {greeting()}, {name}
      </p>

      {!activeContext ? (
        <EmptyHero athleteId={athleteId} />
      ) : !activeContext.today ? (
        <NoDaysHero programName={activeContext.program.name} />
      ) : activeContext.completionPercent === 100 && activeContext.today.isRealToday ? (
        // Only takes over the default (auto-resolved "today") view — if the
        // athlete has explicitly browsed to a specific day via the
        // prev/next arrows, that day's own Workout/Rest hero still shows so
        // they can keep browsing what they already trained.
        <ProgramCompleteHero program={activeContext.program} />
      ) : activeContext.today.day.is_rest_day ? (
        <RestDayHero context={activeContext} onNavigateDay={onNavigateDay} onGoToToday={onGoToToday} />
      ) : (
        <WorkoutHero context={activeContext} athleteId={athleteId} onNavigateDay={onNavigateDay} onGoToToday={onGoToToday} />
      )}
    </div>
  );
}

function WorkoutHero({
  context,
  athleteId,
  onNavigateDay,
  onGoToToday,
}: {
  context: ActiveProgramContext;
  athleteId: string;
  onNavigateDay: (dayId: string) => void;
  onGoToToday: () => void;
}) {
  const { program, today } = context;
  if (!today) return null;
  const exerciseCount = today.day.blocks.reduce((n, b) => n + b.exercises.length, 0);

  return (
    <div className="mt-4 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium uppercase tracking-wide text-primary">
            {program.name} · {today.weekLabel}
            {!today.isRealToday && <span className="ml-1 normal-case text-muted-foreground">(browsing)</span>}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {today.day.label || `Day ${today.day.position}`}
          </h1>
        </div>
        <DayNavArrows
          prevDayId={today.prevDayId}
          nextDayId={today.nextDayId}
          isRealToday={today.isRealToday}
          onNavigateDay={onNavigateDay}
          onGoToToday={onGoToToday}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Dumbbell className="size-4" />
          {exerciseCount} {exerciseCount === 1 ? "exercise" : "exercises"}
        </span>
        {today.sessionPosition && today.sessionsInWeek && (
          <span className="flex items-center gap-1.5">
            <ListOrdered className="size-4" />
            Session {today.sessionPosition} of {today.sessionsInWeek}
          </span>
        )}
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
            Completed{today.completedAt ? ` ${formatLogTime(today.completedAt)}` : ""}
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Link href={`/train/${today.day.id}`} className="w-fit">
            <Button>{today.hasDraft ? "Continue training" : "Start workout"}</Button>
          </Link>
          <SkipWorkoutButton trainingDayId={today.day.id} athleteId={athleteId} />
        </div>
      )}
    </div>
  );
}

/** Browse adjacent scheduled days from the dashboard without leaving it.
 * Used to push `?day=<id>` and rely on a full server round trip
 * (getActiveProgramContext) to resolve the new day — that reran the whole
 * dashboard's data-fetching pipeline (program tree, every stat on the page)
 * just to swap one day for an adjacent one, which was the actual cause of
 * "changing to the next day is slow." onNavigateDay/onGoToToday
 * (DashboardContent, dashboard/page.tsx) now resolve the new day entirely
 * client-side from data already on the page (day-view.ts's
 * resolveDisplayedDay) — no navigation, no fetch, instant. */
function DayNavArrows({
  prevDayId,
  nextDayId,
  isRealToday,
  onNavigateDay,
  onGoToToday,
}: {
  prevDayId: string | null;
  nextDayId: string | null;
  isRealToday: boolean;
  onNavigateDay: (dayId: string) => void;
  onGoToToday: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!prevDayId}
        aria-label="Previous day"
        className="w-8 px-0"
        onClick={() => prevDayId && onNavigateDay(prevDayId)}
      >
        <ChevronLeft className="size-4" />
      </Button>
      {!isRealToday && (
        <Button type="button" variant="outline" size="sm" onClick={onGoToToday}>
          Today
        </Button>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!nextDayId}
        aria-label="Next day"
        className="w-8 px-0"
        onClick={() => nextDayId && onNavigateDay(nextDayId)}
      >
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
}

function RestDayHero({
  context,
  onNavigateDay,
  onGoToToday,
}: {
  context: ActiveProgramContext;
  onNavigateDay: (dayId: string) => void;
  onGoToToday: () => void;
}) {
  const { program, today } = context;
  if (!today) return null;
  return (
    <div className="mt-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-primary">
          {program.name} · {today.weekLabel}
          {!today.isRealToday && <span className="ml-1 normal-case text-muted-foreground">(browsing)</span>}
        </p>
        <DayNavArrows
          prevDayId={today.prevDayId}
          nextDayId={today.nextDayId}
          isRealToday={today.isRealToday}
          onNavigateDay={onNavigateDay}
          onGoToToday={onGoToToday}
        />
      </div>
      <div className="flex items-center gap-2">
        <Moon className="size-5 text-primary" />
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Rest day</h1>
      </div>
      <p className="text-sm text-muted-foreground">No training scheduled today — recovery is part of the plan.</p>
    </div>
  );
}

/** Shown once every non-rest day in the active program has been trained
 * (completionPercent === 100 — see getActiveProgramContext) instead of the
 * WorkoutHero perpetually re-showing the last day as "Completed" forever.
 * Deliberately doesn't auto-clear the active program or pick a new one —
 * that's the athlete's call, made from /programs, same as EmptyHero's
 * "Create a program"/"Choose an existing one" pattern for the equivalent
 * "nothing driving the dashboard right now" moment. */
function ProgramCompleteHero({ program }: { program: { id: string; name: string } }) {
  return (
    <div className="mt-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Trophy className="size-5 text-primary" />
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Program complete!</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        You&apos;ve finished every workout in <span className="font-medium text-foreground">{program.name}</span>. Ready to move onto something else?
      </p>
      <div className="flex flex-wrap gap-3">
        <Link href="/programs">
          <Button>
            <PlusCircle className="size-4" />
            Browse programs
          </Button>
        </Link>
        <Link href={`/programs/${program.id}`}>
          <Button variant="outline">Review this one</Button>
        </Link>
      </div>
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

function EmptyHero({ athleteId }: { athleteId: string }) {
  return (
    <div className="mt-4 flex flex-col gap-4">
      <div className="flex flex-col gap-3">
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
      <div className="flex flex-col gap-2 border-t border-border pt-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Or start with a ready-made program</p>
        <StarterProgramPicker mode="create" userId={athleteId} />
      </div>
    </div>
  );
}
