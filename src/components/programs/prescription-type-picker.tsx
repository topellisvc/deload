"use client";

import type { LucideIcon } from "lucide-react";
import {
  BatteryMedium,
  Clock3,
  Dumbbell,
  Flame,
  Gauge,
  HeartPulse,
  ListOrdered,
  MessageSquareText,
  Percent,
  Repeat,
  Route,
  Shuffle,
} from "lucide-react";
import { PRESCRIPTION_TYPES_BY_CATEGORY } from "@/lib/programs/prescription-types";
import type { ExerciseCategory, PrescriptionType } from "@/lib/programs/types";
import { cn } from "@/lib/utils";

/** One icon per prescription type, purely decorative scanning aid — falls
 * back to Dumbbell for any value not listed (there isn't one today; this
 * is just so a future prescription type added to prescription-types.ts
 * without a matching entry here degrades to "shows *an* icon" instead of
 * crashing). Deliberately keyed by value alone rather than
 * (category, value) — 'rpe' means the same thing whether it's gating a
 * strength set or a cardio interval, so one icon per value is enough. */
const PRESCRIPTION_TYPE_ICONS: Partial<Record<PrescriptionType, LucideIcon>> = {
  fixed_weight: Dumbbell,
  percent_1rm: Percent,
  rpe: Gauge,
  rir: BatteryMedium,
  rep_range: ListOrdered,
  athlete_chooses_weight: Shuffle,
  coach_notes_only: MessageSquareText,
  distance: Route,
  time: Clock3,
  distance_time: Route,
  pace: Gauge,
  heart_rate_zone: HeartPulse,
  intervals: Repeat,
  calories: Flame,
  coach_notes: MessageSquareText,
};

interface PrescriptionTypePickerProps {
  category: ExerciseCategory;
  value: PrescriptionType;
  onChange: (type: PrescriptionType) => void;
}

/**
 * Replaces the plain <select> with a visual grid — one card per type, each
 * showing its icon, label, and the same short example
 * (prescription-types.ts's `example` field, e.g. "4 × 6 @ 100kg") the old
 * dropdown's <option> text never had room for. Entirely driven by
 * PRESCRIPTION_TYPES_BY_CATEGORY like everything else that reads prescription
 * types — adding a new type is still a data change in prescription-types.ts,
 * not a new branch here.
 */
export function PrescriptionTypePicker({ category, value, onChange }: PrescriptionTypePickerProps) {
  const options = PRESCRIPTION_TYPES_BY_CATEGORY[category];

  return (
    <div role="radiogroup" aria-label="Prescription type" className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
      {options.map((opt) => {
        const Icon = PRESCRIPTION_TYPE_ICONS[opt.value] ?? Dumbbell;
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt.value)}
            className={cn(
              "flex flex-col items-start gap-1 rounded-lg border px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              selected ? "border-primary bg-primary/5" : "border-border hover:border-border-strong hover:bg-surface-hover"
            )}
          >
            <span className={cn("flex items-center gap-1.5 text-xs font-semibold", selected ? "text-primary" : "text-foreground")}>
              <Icon className="size-3.5 shrink-0" />
              {opt.label}
            </span>
            <span className="text-[11px] text-muted-foreground">{opt.example}</span>
          </button>
        );
      })}
    </div>
  );
}
