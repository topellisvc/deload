import type { LucideIcon } from "lucide-react";
import { Dumbbell, Flame, HeartPulse, Layers, PersonStanding, RotateCw, Sunrise } from "lucide-react";
import type { BlockType } from "@/lib/programs/types";

export interface BlockTypeOption {
  value: BlockType;
  label: string;
  description: string;
  icon: LucideIcon;
}

/**
 * The "+ Add Block" picker's real, selectable options — the 7 types the
 * spec's "Initially support" list calls out. Ordered exactly as specced.
 * Each is a real, explicitly-stored block_type (migration 0056), not a
 * label derived from exercise count the way "Circuit" used to be — see
 * that migration's own doc comment.
 */
export const BLOCK_TYPE_OPTIONS: BlockTypeOption[] = [
  {
    value: "single",
    label: "Single Exercise",
    description: "One exercise, its own sets and rest.",
    icon: Dumbbell,
  },
  {
    value: "superset",
    label: "Superset",
    description: "Two exercises back to back, no rest between.",
    icon: Layers,
  },
  {
    value: "circuit",
    label: "Circuit",
    description: "Several exercises, rounds, rest, and a completion method.",
    icon: RotateCw,
  },
  {
    value: "cardio_session",
    label: "Cardio Session",
    description: "Time, distance, or calorie-based conditioning work.",
    icon: HeartPulse,
  },
  {
    value: "warmup",
    label: "Warm-up",
    description: "Prepares the athlete before the main workout.",
    icon: Sunrise,
  },
  {
    value: "mobility",
    label: "Mobility",
    description: "Stretches, activation drills, and range-of-motion work.",
    icon: PersonStanding,
  },
  {
    value: "conditioning",
    label: "Conditioning / Finisher",
    description: "Closes out the session with a final push.",
    icon: Flame,
  },
];

/**
 * Not yet real block_type values in the database (migration 0056 keeps
 * 'dropset' valid but unused, and doesn't add the rest at all yet) —
 * shown disabled in the picker so the roadmap is visible without
 * implying any of these can actually be created today. Adding real
 * support for one later is a check-constraint change plus a new
 * BLOCK_TYPE_OPTIONS entry, not a schema redesign — see migration 0056's
 * own comment on BlockType.
 */
export const COMING_SOON_BLOCK_TYPES: { label: string }[] = [
  { label: "Drop Set" },
  { label: "Tri-Set" },
  { label: "Giant Set" },
  { label: "Complex" },
  { label: "Contrast Set" },
  { label: "Plyometric" },
  { label: "Olympic Lifting" },
  { label: "Partner Workout" },
  { label: "Relay" },
];
