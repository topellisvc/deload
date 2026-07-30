"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { JointCheckAnswer, JointKey } from "@/lib/training/autoregulation";

interface JointCheckScreenProps {
  /** Which joints to ask about — the athlete's currently-flagged joints
   * (athlete_injury_profiles, migration 0047), never the full six. */
  joints: JointKey[];
  onAnswer: (answers: Record<JointKey, JointCheckAnswer>) => void;
  busy: boolean;
}

const JOINT_LABELS: Record<JointKey, string> = {
  shoulder: "Shoulder",
  wrist: "Wrist",
  elbow: "Elbow",
  lower_back: "Lower back",
  knee: "Knee",
  hip: "Hip",
};

const ANSWER_OPTIONS: { value: JointCheckAnswer; label: string }[] = [
  { value: "worse", label: "Worse" },
  { value: "same", label: "Same" },
  { value: "better", label: "Better" },
];

/**
 * Rule 4's own question (coach-answers §10 step 2) — asked once per
 * flagged joint, right after Rule 3's readiness check and before the
 * exercise list. Two in a row in either direction is what actually moves
 * anything (see lib/training/autoregulation.ts's decideJointCheck); this
 * screen just collects today's raw answer per joint and hands the whole
 * batch back at once; the previous-answer comparison and any resulting
 * ladder walk happen in the caller (training-session.tsx's
 * handleJointCheckAnswer).
 */
export function JointCheckScreen({ joints, onAnswer, busy }: JointCheckScreenProps) {
  const [answers, setAnswers] = useState<Partial<Record<JointKey, JointCheckAnswer>>>({});

  const canContinue = !busy && joints.every((joint) => answers[joint] !== undefined);

  function handleSubmit() {
    if (!canContinue) return;
    onAnswer(answers as Record<JointKey, JointCheckAnswer>);
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center gap-8 px-6 py-12">
      <div className="flex flex-col gap-1 text-center">
        <h2 className="text-xl font-bold text-foreground">How&apos;s it feeling?</h2>
        <p className="text-sm text-muted-foreground">Compared to last session — this only ever adjusts your plan, never punishes you for answering honestly.</p>
      </div>

      {joints.map((joint) => (
        <div key={joint} className="flex flex-col gap-2">
          <span className="text-sm font-medium text-foreground">{JOINT_LABELS[joint]}</span>
          <div className="grid grid-cols-3 gap-2">
            {ANSWER_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                disabled={busy}
                onClick={() => setAnswers((prev) => ({ ...prev, [joint]: option.value }))}
                className={`rounded-xl border px-3 py-3 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-60 ${
                  answers[joint] === option.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-surface text-muted-foreground hover:text-foreground"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      ))}

      <Button size="lg" className="h-14 text-base" disabled={!canContinue} onClick={handleSubmit}>
        {busy ? "Saving…" : "Continue"}
      </Button>
    </div>
  );
}
