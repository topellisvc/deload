import type { Exercise } from "@/lib/exercises/types";
import { ladderFor, SHOULDER_SUBSTITUTABLE_PATTERNS } from "@/lib/programs/generate/patterns";
import type { SlotPattern } from "@/lib/programs/generate/patterns";
import type { InjuryProfile } from "@/lib/programs/generate/types";

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

/**
 * Rule 4 — the per-joint "how was it after last session?" check
 * (coach-answers §10 step 2). For any joint the athlete has flagged, asked
 * before the next session on that joint: better / same / worse.
 *
 * Two in a row is the coach's own threshold in both directions — worse
 * twice in a row regresses one step down that joint's substitution ladder
 * (see generate/patterns.ts's ladderFor, which already sorts a pattern's
 * candidates most-to-least demanding); better twice in a row progresses one
 * step back up. A single "worse" or "same" reading changes nothing, the
 * same "don't overreact to one data point" principle Rule 1's RIR gate
 * already uses for a single miss.
 *
 * This function only decides the *step direction*. Walking that step
 * against a specific joint's exercise ladder — finding the athlete's
 * current exercise for a pattern, then substituting the next-lighter or
 * next-heavier candidate from ladderFor's output — is nextRungExerciseId,
 * below. Two pieces of durable state that decision needs (which joints an
 * athlete has flagged at all, and what they answered last time for this
 * joint) now live in athlete_injury_profiles and joint_check_answers
 * (migration 0047) — see flaggedJoints below and lib/training/queries.ts's
 * getPreviousJointCheckAnswer. The actual database write that moves a
 * block_exercise's exercise_id to the next rung is
 * lib/training/mutations.ts's applyJointLadderStep.
 */
export type JointCheckAnswer = "better" | "same" | "worse";
export type JointCheckOutcome = "regress" | "progress" | "no_change";

/**
 * Deliberately takes the *previous session's raw answer* for this joint
 * rather than an AutoregulationEventKind history the way decideRirGate
 * does — unlike Rule 1's miss-hold, which is itself written as an event on
 * the very first occurrence (so a second miss can look back and find it),
 * a single "worse" here does nothing and so has no natural event to record
 * — there would be nothing in an event history for a second "worse" to
 * compare against. The caller (training-session.tsx) instead reads the
 * prior answer from joint_check_answers, the durable per-athlete,
 * per-joint answer log migration 0047 added specifically for this.
 */
export function decideJointCheck(current: JointCheckAnswer, previous: JointCheckAnswer | null): JointCheckOutcome {
  if (current === "worse" && previous === "worse") return "regress";
  if (current === "better" && previous === "better") return "progress";
  return "no_change";
}

/**
 * The six joints §10's decision trees cover, using the same field names
 * InjuryProfile itself uses except lowerBack -> lower_back (matching the DB
 * identifier in athlete_injury_profiles/joint_check_answers, migration
 * 0047 — table/column identifiers are snake_case by convention everywhere
 * else in this schema).
 */
export type JointKey = "shoulder" | "wrist" | "elbow" | "lower_back" | "knee" | "hip";

export const ALL_JOINT_KEYS: readonly JointKey[] = ["shoulder", "wrist", "elbow", "lower_back", "knee", "hip"] as const;

/**
 * Which of the six joints a standing InjuryProfile currently has flagged —
 * the runtime version of the same "is this joint hot" question activeTags
 * (generate/injuries.ts) answers at generation time. This is what decides
 * which joints Training Mode even asks the better/same/worse question
 * about; it reads athlete_injury_profiles (migration 0047), the standing
 * store that now persists what InjuryProfile used to only hold as one-off
 * local state inside the generate-program form.
 */
export function flaggedJoints(injuries: InjuryProfile): JointKey[] {
  const joints: JointKey[] = [];
  if (injuries.shoulder) joints.push("shoulder");
  if (injuries.wrist) joints.push("wrist");
  if (injuries.elbow) joints.push("elbow");
  if (injuries.lowerBack) joints.push("lower_back");
  if (injuries.knee) joints.push("knee");
  if (injuries.hip) joints.push("hip");
  return joints;
}

/**
 * Which SlotPatterns (generate/patterns.ts) each joint's ladder walk
 * applies to — i.e., which of an athlete's currently-assigned exercises
 * count as "for this joint" when a regress/progress fires.
 *
 * shoulder reuses patterns.ts's own SHOULDER_SUBSTITUTABLE_PATTERNS
 * verbatim, since that's already the coach-specified set for "the two
 * patterns the shoulder branch is allowed to substitute away from." The
 * other five joints aren't defined anywhere else in this codebase, so
 * these are a reasonable first pass grounded in which patterns load each
 * joint under axial/lever demand — not a clinically reviewed list. Same
 * "flagged for a physiotherapist review before shipping" caveat
 * generate/injuries.ts's header comment already carries for this entire
 * area; nothing here should be read as clinical sign-off.
 */
export const JOINT_PATTERNS: Record<JointKey, readonly SlotPattern[]> = {
  shoulder: SHOULDER_SUBSTITUTABLE_PATTERNS,
  elbow: ["horizontal_push", "vertical_push"],
  wrist: ["horizontal_push", "vertical_push"],
  lower_back: ["hinge_bilateral", "hinge_unilateral", "anti_extension", "anti_rotation"],
  knee: ["squat_bilateral", "squat_unilateral", "knee_flexion"],
  hip: ["hinge_bilateral", "hinge_unilateral", "hip_abduction", "hip_adduction"],
};

/**
 * One ladder step for a single already-identified exercise, in the given
 * direction — the piece this file's decideJointCheck doc comment (above)
 * flagged as not implemented. This only decides *which exercise id* is
 * next; it doesn't touch the database (see lib/training/mutations.ts's
 * applyJointLadderStep for the write side) and it doesn't decide *which*
 * of an athlete's exercises this applies to — the caller resolves that by
 * pattern, using JOINT_PATTERNS above.
 *
 * `pool` should already be filtered to what's actually usable for this
 * athlete (equipment access, injury tags for every *other* active joint) —
 * this function only walks the ladder within whatever pool it's given.
 * Returns null when the current exercise isn't found on this pattern's
 * ladder at all (e.g. a custom/untagged exercise), or when it's already at
 * the ladder's most/least demanding end and there's nowhere further to
 * step — both cases mean "leave this exercise alone."
 */
export function nextRungExerciseId<T extends Pick<Exercise, "id" | "movement_pattern" | "primary_muscle_group" | "metadata">>(
  pool: readonly T[],
  pattern: SlotPattern,
  currentExerciseId: string,
  direction: "regress" | "progress"
): string | null {
  const ladder = ladderFor(pool, pattern);
  const index = ladder.findIndex((exercise) => exercise.id === currentExerciseId);
  if (index === -1) return null;
  const nextIndex = direction === "regress" ? index + 1 : index - 1;
  if (nextIndex < 0 || nextIndex >= ladder.length) return null;
  return ladder[nextIndex]!.id;
}
