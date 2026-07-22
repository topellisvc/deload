import type { LucideIcon } from "lucide-react";
import { Dumbbell, Flame, Gauge, Percent, Shuffle } from "lucide-react";

/**
 * Central registry of live tools. Deliberately small right now — we ship
 * one tool at a time, fully finished, rather than scaffolding placeholders
 * for tools that don't exist yet. Add an entry here only when a tool is
 * production-ready.
 */
export interface ToolMeta {
  slug: string;
  name: string;
  description: string;
  icon: LucideIcon;
}

export const TOOLS: ToolMeta[] = [
  {
    slug: "one-rep-max",
    name: "One-Rep Max Calculator",
    description:
      "Estimate your true one-rep max from any set, with a confidence range and a full percentage-based training table.",
    icon: Dumbbell,
  },
  {
    slug: "acwr",
    name: "Training Load Ratio (ACWR) Calculator",
    description:
      "Check whether your recent training load has spiked relative to your 4-week baseline, using the acute:chronic workload ratio method from sports science.",
    icon: Gauge,
  },
  {
    slug: "quick-workout",
    name: "Quick Workout Generator",
    description:
      "Pick a goal, your equipment, a focus area, and how much time you have — get a balanced session built from real exercise-selection rules, not a random shuffle.",
    icon: Shuffle,
  },
  {
    slug: "body-fat-percentage",
    name: "Body Fat Percentage Calculator",
    description:
      "Estimate your body fat percentage from a tape measure using the U.S. Navy circumference method, with an honest accuracy margin and a fat mass / lean mass breakdown.",
    icon: Percent,
  },
  {
    slug: "calorie-macro-calculator",
    name: "Calorie & Macro Calculator",
    description:
      "Estimate your daily calorie target and a protein/fat/carb split from multiple published formulas, with an honest range instead of one falsely precise number.",
    icon: Flame,
  },
];
