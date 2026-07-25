import type { LucideIcon } from "lucide-react";
import { ClipboardList, Flame, ListChecks, Target, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DashboardStats } from "@/lib/dashboard/types";

type Tone = "neutral" | "success" | "warning" | "danger";

/** Literal Tailwind class strings (not built via interpolation) so
 * Tailwind's static scanner generates them — see the same note on
 * src/lib/programs/discipline-meta.ts. */
const TONE_CLASSES: Record<Tone, string> = {
  neutral: "text-primary",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
};

/**
 * completion%/consistency% share the same good/okay/needs-work bands —
 * both are "how much of what was scheduled actually happened," just
 * measured over different windows (see getActiveProgramContext /
 * getRecentSessionActivity), so one threshold function covers both
 * rather than defining two near-identical scales. Mirrors the
 * min/max-bucket shape ACWR_ZONES already uses for the same kind of
 * "value -> discrete status" mapping (src/lib/calculators/acwr.ts),
 * the one existing convention in this codebase for this sort of thing.
 */
function percentTone(percent: number): Tone {
  if (percent >= 80) return "success";
  if (percent >= 50) return "warning";
  return "danger";
}

/** A streak has no "bad" state to warn about — 0 just means "haven't
 * started yet," not "at risk" — so this only ever distinguishes active
 * (green, something to protect) from neutral, unlike percentTone's three
 * bands. */
function streakTone(days: number): Tone {
  return days > 0 ? "success" : "neutral";
}

interface StatCard {
  label: string;
  value: string;
  icon: LucideIcon;
  tone: Tone;
}

/**
 * Compact glance-and-move-on cards. Completion % and consistency % only
 * appear once there's an active program to measure them against — the
 * three account-wide stats (streak/sessions/programs) always show, since
 * those exist independent of any one program.
 *
 * Sessions logged / Programs created are plain counts with no "good or
 * bad" reading, so they stay neutral (the original uniform blue) — only
 * the streak, completion %, and consistency % cards get a status color,
 * since those are the three numbers that actually mean something is
 * going well or needs attention.
 */
export function DashboardSnapshot({ stats }: { stats: DashboardStats }) {
  const cards: StatCard[] = [
    {
      label: "Current streak",
      value: `${stats.currentStreak} ${stats.currentStreak === 1 ? "day" : "days"}`,
      icon: Flame,
      tone: streakTone(stats.currentStreak),
    },
    { label: "Sessions logged", value: String(stats.sessionCount), icon: ListChecks, tone: "neutral" },
    { label: "Programs created", value: String(stats.programsCreated), icon: ClipboardList, tone: "neutral" },
  ];
  if (stats.completionPercent != null) {
    cards.push({
      label: "Program completion",
      value: `${stats.completionPercent}%`,
      icon: Target,
      tone: percentTone(stats.completionPercent),
    });
  }
  if (stats.consistencyPercent != null) {
    cards.push({
      label: "Consistency",
      value: `${stats.consistencyPercent}%`,
      icon: TrendingUp,
      tone: percentTone(stats.consistencyPercent),
    });
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((card) => (
        <div key={card.label} className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-4">
          <card.icon className={cn("size-4", TONE_CLASSES[card.tone])} />
          <span className={cn("text-xl font-semibold tabular-nums", card.tone === "neutral" ? "text-foreground" : TONE_CLASSES[card.tone])}>
            {card.value}
          </span>
          <span className="text-xs text-muted-foreground">{card.label}</span>
        </div>
      ))}
    </div>
  );
}
