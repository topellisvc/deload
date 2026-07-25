import { Dumbbell, PersonStanding, Waves } from "lucide-react";
import type { ProgramDiscipline } from "@/lib/programs/types";

/**
 * Single source of truth for how each training discipline is labeled,
 * iconified, and colored — used by ProgramCard's badge and the discipline
 * SegmentedControl in both ProgramBuilder and NewProgramDialog, which
 * previously each kept their own copy of {value, label} with no color at
 * all (three programs of different disciplines rendered as identical gray
 * pills). Reuses the existing zone-* tokens (originally built for the 1RM%
 * calculator's training-goal table) rather than introducing new ones:
 * resistance -> zone-strength (red), running -> zone-endurance (blue),
 * hybrid -> zone-hypertrophy (green) — a genuinely mixed discipline gets
 * the third, distinct hue rather than reading as "half resistance."
 *
 * badgeClass/activeClassName are literal Tailwind class strings (not
 * built via template-string interpolation) so Tailwind's static scanner
 * can find and generate them — an interpolated `bg-${color}/15` would
 * silently produce no styles at all.
 */
export const DISCIPLINE_META: Record<
  ProgramDiscipline,
  { label: string; Icon: typeof Dumbbell; badgeClass: string; activeClassName: string }
> = {
  resistance: {
    label: "Weights",
    Icon: Dumbbell,
    badgeClass: "bg-zone-strength/15 text-zone-strength",
    activeClassName: "bg-zone-strength/15 text-zone-strength shadow-sm",
  },
  running: {
    label: "Running",
    Icon: PersonStanding,
    badgeClass: "bg-zone-endurance/15 text-zone-endurance",
    activeClassName: "bg-zone-endurance/15 text-zone-endurance shadow-sm",
  },
  hybrid: {
    label: "Hybrid",
    Icon: Waves,
    badgeClass: "bg-zone-hypertrophy/15 text-zone-hypertrophy",
    activeClassName: "bg-zone-hypertrophy/15 text-zone-hypertrophy shadow-sm",
  },
};
