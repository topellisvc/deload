"use client";

import { Button } from "@/components/ui/button";

interface RirCheckScreenProps {
  exerciseName: string;
  onAnswer: (performedRir: 0 | 1 | 2 | 3) => void;
  busy: boolean;
}

const OPTIONS: { value: 0 | 1 | 2 | 3; label: string; sublabel: string }[] = [
  { value: 0, label: "0", sublabel: "That was my limit" },
  { value: 1, label: "1", sublabel: "Maybe one more" },
  { value: 2, label: "2", sublabel: "Comfortably 2 more" },
  { value: 3, label: "3+", sublabel: "Plenty left" },
];

/**
 * Rule 1's own question (coach-answers §2 Rule 1): "how many more reps
 * could you have done?" — asked once per autoregulation-eligible exercise,
 * right after its last working set, never per set. Kept as its own
 * transitional step (a variant of the "exercise-complete" moment, see
 * training-session.tsx) rather than folded into StrengthSetLogger's own
 * two-tap flow, which is deliberately narrower (see that component's doc
 * comment on why RPE/RIR isn't part of the per-set input).
 *
 * A ternary-plus-one scale (0/1/2/3+), not a 1-10 RPE slider — see
 * lib/training/autoregulation.ts's header comment and coach-answers §4
 * point 4 on why novices reliably mis-rate a 10-point scale but rate this
 * one well.
 */
export function RirCheckScreen({ exerciseName, onAnswer, busy }: RirCheckScreenProps) {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center gap-6 px-6 py-12 text-center">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-bold text-foreground">One quick question</h2>
        <p className="text-sm text-muted-foreground">
          On your last set of <span className="font-medium text-foreground">{exerciseName}</span>, how many more reps could you have done?
        </p>
      </div>

      <div className="grid w-full grid-cols-2 gap-2.5">
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            disabled={busy}
            onClick={() => onAnswer(option.value)}
            className="flex flex-col items-center gap-1 rounded-xl border border-border bg-surface px-4 py-5 transition hover:border-primary hover:bg-primary/5 disabled:pointer-events-none disabled:opacity-60"
          >
            <span className="text-3xl font-bold tabular-nums text-foreground">{option.label}</span>
            <span className="text-xs text-muted-foreground">{option.sublabel}</span>
          </button>
        ))}
      </div>

      {busy && <Button variant="ghost" size="sm" disabled className="text-muted-foreground">Saving…</Button>}
    </div>
  );
}
