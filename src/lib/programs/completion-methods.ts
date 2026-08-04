import type { CompletionMethod } from "@/lib/programs/types";

/**
 * The declarative source of truth for "given this completion method, which
 * of ExerciseBlock's circuit-settings fields actually matter" — mirrors the
 * pattern prescription-types.ts already uses for PrescriptionType. The
 * Circuit block editor (circuit-block-card.tsx) reads this to decide which
 * of Rounds / Rest Between Exercises / Rest Between Rounds / Duration /
 * Interval to show for the coach's chosen method, instead of every field
 * always being visible regardless of whether it means anything for that
 * method (e.g. "Rest Between Rounds" doesn't apply to an EMOM, which has no
 * separate round-rest — the rest IS whatever's left of the minute).
 *
 * These five map straight onto ExerciseBlock's own columns (migration
 * 0056): rounds, rest_between_exercises_seconds, rest_between_rounds_seconds,
 * duration_seconds, interval_seconds. `goal`, `custom_name`, and `notes`
 * are free text and always relevant regardless of method, so they aren't
 * part of this map.
 */
export type CompletionMethodField = "rounds" | "rest_between_exercises" | "rest_between_rounds" | "duration" | "interval";

export interface CompletionMethodDef {
  value: CompletionMethod;
  label: string;
  /** Short example shown in the completion-method picker. */
  example: string;
  description: string;
  fields: CompletionMethodField[];
}

export const COMPLETION_METHODS: CompletionMethodDef[] = [
  {
    value: "traditional_rounds",
    label: "Traditional Rounds",
    example: "3 rounds, 60s rest between rounds",
    description: "Work through every exercise, rest, then repeat for a fixed number of rounds.",
    fields: ["rounds", "rest_between_exercises", "rest_between_rounds"],
  },
  {
    value: "timed",
    label: "Timed Circuit",
    example: "Work continuously for 20 minutes",
    description: "Cycle through the exercises for a fixed total time, not a fixed round count.",
    fields: ["duration", "rest_between_exercises"],
  },
  {
    value: "amrap",
    label: "AMRAP",
    example: "As many rounds as possible in 15 minutes",
    description: "Complete as many rounds as possible before the time cap.",
    fields: ["duration", "rest_between_exercises"],
  },
  {
    value: "emom",
    label: "EMOM",
    example: "8 rounds, every 60 seconds",
    description: "Start a new round every fixed interval — rest is whatever's left of it.",
    fields: ["rounds", "interval"],
  },
  {
    value: "for_time",
    label: "For Time",
    example: "5 rounds, as fast as possible",
    description: "Complete a fixed number of rounds as quickly as possible, with an optional time cap.",
    fields: ["rounds", "rest_between_exercises", "duration"],
  },
  {
    value: "quality",
    label: "Quality",
    example: "3 rounds, untimed",
    description: "No time pressure — focus on technique, with generous rest between exercises and rounds.",
    fields: ["rounds", "rest_between_exercises", "rest_between_rounds"],
  },
];

export function getCompletionMethodDef(method: CompletionMethod): CompletionMethodDef | undefined {
  return COMPLETION_METHODS.find((m) => m.value === method);
}

/** Sensible starting method for a freshly-created circuit — the most
 * familiar/common shape (fixed rounds, rest between them) before the coach
 * picks something more specific. */
export function defaultCompletionMethod(): CompletionMethod {
  return COMPLETION_METHODS[0]!.value;
}

/** Whether a given circuit-settings field should be shown for this method —
 * what circuit-block-card.tsx actually calls per-field rather than reading
 * `.fields.includes(...)` at every call site. */
export function isFieldRelevant(method: CompletionMethod, field: CompletionMethodField): boolean {
  return getCompletionMethodDef(method)?.fields.includes(field) ?? false;
}
