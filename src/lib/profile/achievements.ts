import type { LucideIcon } from "lucide-react";
import { Award, CalendarCheck, ClipboardList, Flame, Trophy } from "lucide-react";

export interface AchievementInput {
  sessionCount: number;
  programsCreated: number;
  createdAt: string;
}

export interface AchievementDef {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  check: (input: AchievementInput) => boolean;
}

/**
 * Every achievement is a pure function of data that already exists
 * (session/program counts, account age) — nothing is tracked separately,
 * so there's no "unlock" event to record and no way for this list to
 * drift out of sync with reality. Adding a new milestone later is just
 * adding an entry here with its own `check`.
 */
export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: "first_workout",
    label: "First Workout Logged",
    description: "Log your first training session",
    icon: Flame,
    check: (s) => s.sessionCount >= 1,
  },
  {
    id: "ten_sessions",
    label: "10 Sessions",
    description: "Log 10 training sessions",
    icon: CalendarCheck,
    check: (s) => s.sessionCount >= 10,
  },
  {
    id: "hundred_sessions",
    label: "100 Sessions",
    description: "Log 100 training sessions",
    icon: Trophy,
    check: (s) => s.sessionCount >= 100,
  },
  {
    id: "first_program",
    label: "First Program Created",
    description: "Build your first program",
    icon: ClipboardList,
    check: (s) => s.programsCreated >= 1,
  },
  {
    id: "one_year_member",
    label: "One Year Member",
    description: "Be a member for a full year",
    icon: Award,
    check: (s) => Date.now() - new Date(s.createdAt).getTime() >= 365 * 86400000,
  },
];
