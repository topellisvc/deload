"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { SleepQuality, SorenessLevel } from "@/lib/training/autoregulation";

interface ReadinessCheckScreenProps {
  onAnswer: (sleep: SleepQuality, soreness: SorenessLevel) => void;
  busy: boolean;
}

const SLEEP_OPTIONS: { value: SleepQuality; label: string }[] = [
  { value: "good", label: "Good" },
  { value: "ok", label: "Okay" },
  { value: "bad", label: "Bad" },
];

const SORENESS_OPTIONS: { value: SorenessLevel; label: string }[] = [
  { value: "fresh", label: "Fresh" },
  { value: "normal", label: "Normal" },
  { value: "beat_up", label: "Beat up" },
];

function OptionRow<T extends string>({
  label,
  options,
  selected,
  onSelect,
  disabled,
}: {
  label: string;
  options: { value: T; label: string }[];
  selected: T | null;
  onSelect: (value: T) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <div className="grid grid-cols-3 gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(option.value)}
            className={`rounded-xl border px-3 py-3 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-60 ${
              selected === option.value
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-surface text-muted-foreground hover:text-foreground"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Rule 3's own two questions (coach-answers §2 Rule 3) — asked once, right
 * after Begin, before the exercise list. Never re-asked on resume (see
 * TrainingModeSession.readiness's doc comment).
 *
 * Both answers landing in the worst bucket (bad sleep + beat-up soreness)
 * downregulates this session only: the last set of each exercise is
 * dropped (see lib/training/sequence.ts's dropLastSet) and the on-screen
 * advisory below asks the athlete to treat their top set as an RPE 7
 * ceiling. That second half is deliberately an on-screen instruction, not a
 * silently rewritten weight or percentage — this app never mutates a stored
 * prescription number to represent a stop-condition (see this file's
 * sibling components' own doc comments on the same principle), and "stop
 * around RPE 7" is a real-time effort judgment the athlete makes mid-set,
 * not a number this generator could compute in advance regardless of
 * prescription type (rir/rpe/percent_1rm/fixed_weight all mean something
 * different for "what's RPE 7 here").
 */
export function ReadinessCheckScreen({ onAnswer, busy }: ReadinessCheckScreenProps) {
  const [sleep, setSleep] = useState<SleepQuality | null>(null);
  const [soreness, setSoreness] = useState<SorenessLevel | null>(null);

  const canContinue = sleep !== null && soreness !== null && !busy;

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center gap-8 px-6 py-12">
      <div className="flex flex-col gap-1 text-center">
        <h2 className="text-xl font-bold text-foreground">Before you start</h2>
        <p className="text-sm text-muted-foreground">Two quick questions — this only ever adjusts today, never your program.</p>
      </div>

      <OptionRow label="How did you sleep last night?" options={SLEEP_OPTIONS} selected={sleep} onSelect={setSleep} disabled={busy} />
      <OptionRow label="How sore are you today?" options={SORENESS_OPTIONS} selected={soreness} onSelect={setSoreness} disabled={busy} />

      <Button size="lg" className="h-14 text-base" disabled={!canContinue} onClick={() => sleep && soreness && onAnswer(sleep, soreness)}>
        {busy ? "Saving…" : "Continue"}
      </Button>
    </div>
  );
}
