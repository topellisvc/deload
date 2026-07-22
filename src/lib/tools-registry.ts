import type { LucideIcon } from "lucide-react";
import { CalendarDays, Compass, Dumbbell, Flame, Gauge, Percent, Shuffle, Timer } from "lucide-react";

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

// Order here drives display order on the homepage, /tools, and the "More
// tools" cross-links — broadest-appeal tools first, more specialized /
// coach-oriented tools (like ACWR) last.
export const TOOLS: ToolMeta[] = [
  {
    slug: "one-rep-max",
    name: "One-Rep Max Calculator",
    description:
      "Estimate your true one-rep max from any set, with a confidence range and a full percentage-based training table.",
    icon: Dumbbell,
  },
  {
    slug: "running-pace-calculator",
    name: "Running Pace Calculator",
    description:
      "Solve pace, time, or distance from any two, see even splits, and predict your finish time at other race distances using Riegel's formula.",
    icon: Timer,
  },
  {
    slug: "calorie-macro-calculator",
    name: "Calorie & Macro Calculator",
    description:
      "Estimate your daily calorie target and a protein/fat/carb split from multiple published formulas, with an honest range instead of one falsely precise number.",
    icon: Flame,
  },
  {
    slug: "body-fat-percentage",
    name: "Body Fat Percentage Calculator",
    description:
      "Estimate your body fat percentage from a tape measure using the U.S. Navy circumference method, with an honest accuracy margin and a fat mass / lean mass breakdown.",
    icon: Percent,
  },
  {
    slug: "training-style-finder",
    name: "Training Style Finder",
    description:
      "Not sure what kind of training actually fits you? Answer 4 questions to find out which of 8 disciplines — from powerlifting-style to CrossFit-style to power & speed training — suits your goal and equipment.",
    icon: Compass,
  },
  {
    slug: "training-split-finder",
    name: "Training Split Finder",
    description:
      "Find the training split that actually fits your goal, experience, and how many days a week you can train — Full Body, Upper/Lower, or Push/Pull/Legs, with the reasoning shown.",
    icon: CalendarDays,
  },
  {
    slug: "quick-workout",
    name: "Quick Workout Generator",
    description:
      "Pick a goal, your equipment, a focus area, and how much time you have — get a balanced session built from real exercise-selection rules, not a random shuffle.",
    icon: Shuffle,
  },
  {
    slug: "acwr",
    name: "Training Load Ratio (ACWR) Calculator",
    description:
      "Check whether your recent training load has spiked relative to your 4-week baseline, using the acute:chronic workload ratio method from sports science.",
    icon: Gauge,
  },
];
