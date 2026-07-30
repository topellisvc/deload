/**
 * Rule 1 of the runtime autoregulation layer (coach-answers §2 Rule 1,
 * deload-autoregulation-design.md) — the RIR gate. Asked once per
 * autoregulation-eligible exercise, after its last working set: "how many
 * more reps could you have done?" as 0 / 1 / 2 / 3-or-more.
 *
 * A pure decision module, same convention as e1rm.ts and patterns.ts in
 * lib/programs/generate — this file makes no Supabase calls and knows
 * nothing about React. The caller (training-session.tsx) is responsible for
 * fetching recent autoregulation_events for this exact block_exercise
 * (newest first) and for actually persisting whatever this decides; see
 * lib/training/mutations.ts's createAutoregulationEvent.
 *
 * WHY THIS ISN'T JUST THREE OUTCOMES
 * -----------------------------------------
 * The database's autoregulation_events.kind check constraint (migration
 * 0044) only allows 'advance' | 'hold' | 'reset_10pct' for this rule — but
 * the coach's answer describes four distinct reported states (0/1/2/3+
 * RIR), and one of them (1 RIR, "proceed as planned") genuinely changes
 * nothing and has nothing worth recording. Rather than force that into a
 * fourth DB-level kind, RirGateOutcome adds a fourth *conceptual* value,
 * `no_change`, that the caller simply never writes an event for. This also
 * keeps the consecutive-miss counter below correct without any special-
 * casing: a `no_change` session is never in the event history at all, so it
 * neither extends nor breaks a miss streak, which is exactly the right
 * behavior (a clean single at RIR 1 shouldn't erase a miss from last time,
 * or count toward one either).
 *
 * WHY THE CONSECUTIVE-MISS COUNT SKIPS readiness_downregulated
 * --------------------------------------------------------------------
 * Rule 3 (the pre-session readiness check) is explicit that a bad-sleep,
 * bad-soreness downregulation must never count as a failed progression —
 * see migration 0044's comment on why 'readiness_downregulated' exists as
 * its own event kind. countsAsConsecutiveMiss below walks recentEvents
 * (newest first) and skips straight past any 'readiness_downregulated'
 * entries without either counting them or breaking the streak, so a
 * genuinely missed session on either side of a rough-night session still
 * correctly reads as two misses in a row.
 */

export type AutoregulationEventKind = "advance" | "hold" | "reset_10pct" | "readiness_downregulated" | "joint_regress" | "joint_progress";

export type RirGateOutcome = "advance" | "hold" | "reset_10pct" | "no_change";

export interface RirGateInput {
  /** 0, 1, 2, or 3 (3 standing in for "3 or more," the top bucket of the
   * ternary-plus-one scale the coach specifies). Null means the athlete
   * wasn't asked at all — defensively treated as "not enough information,"
   * never as a stand-in for a miss or a green light to advance. */
  performedRir: 0 | 1 | 2 | 3 | null;
  /** True when the prescribed rep target wasn't hit on the working
   * set(s) — independent of the reported RIR, since someone can report a
   * nonzero RIR while still stopping short of the assigned number. The
   * coach's rule holds on a miss regardless of what RIR was claimed. */
  repsMissed: boolean;
  /** This exact block_exercise's own autoregulation_events, newest first.
   * Only as much history as is needed to answer "was the single most
   * recent relevant event also a miss-hold" — callers may pass as little
   * as the most recent handful of rows (see the lift-specific DB index in
   * migration 0044). */
  recentEvents: readonly { kind: AutoregulationEventKind }[];
}

export interface RirGateResult {
  outcome: RirGateOutcome;
  /** Multiplier to apply to the next session's suggested e1RM-derived load
   * (see applyOutcomeToEstimate) — 1 for hold/no_change, >1 for advance,
   * 0.9 for reset_10pct. */
  multiplier: number;
  /** Plain-language reason, suitable for a coach reviewing
   * autoregulation_events.detail or an athlete-facing note. */
  reason: string;
}

/** True when the most recent *relevant* prior event for this lift was
 * itself a miss-hold — i.e., this new miss would make two in a row.
 * readiness_downregulated entries are skipped, not treated as breaking or
 * extending the streak (see header comment); an 'advance' or 'reset_10pct'
 * as the most recent relevant event both correctly return false, since
 * either means the streak reset. */
function isSecondConsecutiveMiss(recentEvents: readonly { kind: AutoregulationEventKind }[]): boolean {
  for (const event of recentEvents) {
    if (event.kind === "readiness_downregulated") continue;
    return event.kind === "hold";
  }
  return false;
}

export function decideRirGate(input: RirGateInput): RirGateResult {
  const { performedRir, repsMissed, recentEvents } = input;

  if (performedRir === null) {
    return { outcome: "no_change", multiplier: 1, reason: "No RIR was reported for this session — leaving next session's target unchanged." };
  }

  const missed = repsMissed || performedRir === 0;
  if (missed) {
    if (isSecondConsecutiveMiss(recentEvents)) {
      return {
        outcome: "reset_10pct",
        multiplier: 0.9,
        reason: "Missed the prescribed reps two sessions in a row on this lift — dropping the load 10% rather than grinding at the same number again.",
      };
    }
    return {
      outcome: "hold",
      multiplier: 1,
      reason: repsMissed
        ? "Missed the prescribed reps this session — holding the load rather than increasing it."
        : "Reported 0 reps in reserve — holding the load rather than increasing it.",
    };
  }

  if (performedRir === 1) {
    return { outcome: "no_change", multiplier: 1, reason: "1 rep in reserve — right where this was aimed, proceeding exactly as planned." };
  }
  if (performedRir === 2) {
    return { outcome: "advance", multiplier: 1.015, reason: "2 reps in reserve — on track to add a little more next session." };
  }
  return { outcome: "advance", multiplier: 1.03, reason: "3 or more reps in reserve — adding a bit extra next session." };
}

/**
 * Rule 3 — the two-question pre-session readiness check (coach-answers §2
 * Rule 3). Asked once, before the athlete starts the exercise list, never
 * per exercise.
 *
 * Only the *both bad* combination downregulates — a bad night's sleep on
 * its own, or high soreness on its own, is normal training life and not
 * something this app should react to. Both together is the coach's actual
 * threshold for "today should ask less of you than the plan does."
 */
export type SleepQuality = "good" | "ok" | "bad";
export type SorenessLevel = "fresh" | "normal" | "beat_up";

export interface ReadinessCheck {
  sleep: SleepQuality;
  soreness: SorenessLevel;
}

export function decideReadinessDownregulation(readiness: ReadinessCheck): boolean {
  return readiness.sleep === "bad" && readiness.soreness === "beat_up";
}
