"use client";

import type { LucideIcon } from "lucide-react";
import { Award, Clock3, Flame, ListOrdered, Repeat, Timer } from "lucide-react";
import { COMPLETION_METHODS } from "@/lib/programs/completion-methods";
import type { CompletionMethod } from "@/lib/programs/types";
import { cn } from "@/lib/utils";

/** One icon per completion method, purely a scanning aid — same "falls back
 * to a sane default, keyed by value" pattern prescription-type-picker.tsx
 * already uses. */
const COMPLETION_METHOD_ICONS: Record<CompletionMethod, LucideIcon> = {
  traditional_rounds: Repeat,
  timed: Clock3,
  amrap: Flame,
  emom: Timer,
  for_time: ListOrdered,
  quality: Award,
};

interface CompletionMethodPickerProps {
  value: CompletionMethod;
  onChange: (method: CompletionMethod) => void;
}

/**
 * How a circuit is considered "done" — drives which of the circuit's own
 * timing fields (Rounds / Rest Between Rounds / Duration / Interval) even
 * apply, per completion-methods.ts's declarative field map. Same visual
 * pattern as PrescriptionTypePicker (a grid of labeled cards rather than a
 * plain <select>) so a coach can see every option's short example at once
 * instead of reading six options blind in a closed dropdown.
 */
export function CompletionMethodPicker({ value, onChange }: CompletionMethodPickerProps) {
  return (
    <div role="radiogroup" aria-label="Completion method" className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
      {COMPLETION_METHODS.map((opt) => {
        const Icon = COMPLETION_METHOD_ICONS[opt.value];
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
