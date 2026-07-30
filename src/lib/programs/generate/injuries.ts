import type { Exercise } from "@/lib/exercises/types";
import { contraindications } from "@/lib/programs/generate/patterns";
import type { GlobalRefusalScreen, InjuryProfile, RedFlagScreen } from "@/lib/programs/generate/types";

/**
 * Section 10's three-step gate, and the §7/§5 refusals that work the same way.
 * This is the section the coach called out specifically: "everything else, if
 * you get it wrong, produces a mediocre program. Get injuries wrong and you
 * make someone's tendinopathy worse for six months." Flagged for a
 * physiotherapist review before shipping — passing these tests is not
 * sign-off.
 *
 * THE THREE STEPS, AND WHERE EACH ONE LIVES
 * ------------------------------------------
 * 1. Screen for red flags -> route out entirely. `redFlagReason` and
 *    `globalRefusalReason` below, plus `jointRouteOutReason` for the one
 *    per-joint case (post-surgical/ACL knee) that isn't a RedFlagScreen or
 *    GlobalRefusalScreen field. Any non-null result here means: no plan, full
 *    stop. Feeds TemplateResult's `needsHumanReason` variant.
 * 2. Otherwise, substitute and modify — never blanket-exclude. `activeTags`
 *    turns an InjuryProfile into the set of InjuryTag values currently "hot"
 *    for this athlete, and `isSafeForInjuries` checks one exercise against
 *    them. The *runtime* half of this step — the next-session "better/same/
 *    worse" question that walks a joint's ladder up or down — reads
 *    autoregulation_events and belongs to task #25, not this module: it needs
 *    session history, which is exactly the kind of state this generator's
 *    static types deliberately don't carry (see types.ts's header comment).
 * 3. Regress in a fixed order (ROM -> load -> speed/tempo -> implement/grip ->
 *    same-pattern substitute -> remove the pattern, last resort). That order
 *    is encoded once, in patterns.ts's ladderFor() — a regression is already
 *    "one step down the ladder," and isSafeForInjuries only decides whether a
 *    given rung is available at all, not which rung to try next. Exercise
 *    selection (task #14) is what actually walks a ladder calling
 *    isSafeForInjuries at each rung; this module doesn't call ladderFor
 *    itself so it stays testable without a real exercise list.
 *
 * WHY A SEPARATE InjuryTag VOCABULARY, NOT InjuryProfile ITSELF
 * ---------------------------------------------------------------
 * patterns.ts's `contraindications()` reads a per-exercise
 * `metadata.injury_contraindications` string[] — data, tagged once per
 * exercise at seed/curation time, same mechanism as slot_patterns. That data
 * has to agree with *something* fixed, and InjuryProfile isn't it: a single
 * `lowerBack` flag covers two presentations needing opposite modifications
 * (§10's flexion-intolerant vs extension-intolerant), so "contraindicated for
 * lower_back" isn't a meaningful tag to put on an exercise — a loaded good
 * morning is contraindicated for one presentation and fine for the other.
 * InjuryTag is the vocabulary both sides — the seed data and this module —
 * agree on instead, one entry per *presentation*, not per joint.
 *
 * "unsure" (the coach's answer for when disambiguation fails) maps to the
 * union of every presentation's tags for that joint, i.e. the most
 * conservative available combination — §10's explicit instruction is to
 * default conservatively rather than guess.
 */
export type InjuryTag =
  | "shoulder"
  | "lower_back_flexion_intolerant"
  | "lower_back_extension_intolerant"
  | "knee_anterior_patellar"
  | "knee_meniscal_joint_line"
  | "wrist"
  | "hip_anterior_groin"
  | "hip_lateral_glute"
  | "hip_posterior_hamstring"
  | "elbow";

export const ALL_INJURY_TAGS: readonly InjuryTag[] = [
  "shoulder",
  "lower_back_flexion_intolerant",
  "lower_back_extension_intolerant",
  "knee_anterior_patellar",
  "knee_meniscal_joint_line",
  "wrist",
  "hip_anterior_groin",
  "hip_lateral_glute",
  "hip_posterior_hamstring",
  "elbow",
] as const;

/**
 * Step 1a. Any true field ends the automated path — see §10's red-flag list.
 * Deliberately checked as a flat "any true" rather than weighted: the coach's
 * answer treats every one of these as independently sufficient to route out,
 * not as contributing evidence toward some threshold.
 */
export function redFlagReason(screen: RedFlagScreen): string | null {
  if (screen.radicularOrNumbnessSymptoms) return "Numbness, tingling, or pain radiating down a limb needs a clinical assessment before training.";
  if (screen.unexplainedWeakness) return "Unexplained weakness needs a clinical assessment before training.";
  if (screen.nightPainThatWakesThem) return "Pain that wakes you at night needs a clinical assessment before training.";
  if (screen.jointLocksCatchesOrGivesWay) return "A joint that locks, catches, or gives way needs a clinical assessment before training.";
  if (screen.recentTraumaWithSwellingOrCantBearWeight) return "Recent trauma with swelling or an inability to bear weight needs a clinical assessment before training.";
  if (screen.postSurgicalWithinSixMonthsNoClearance) return "Surgery within the last 6 months needs written clinical clearance before training resumes.";
  if (screen.systemicSymptomsAlongsidePain) return "Unexplained weight loss or fever alongside pain needs a clinical assessment before training.";
  if (screen.bladderOrBowelChangeWithBackPain) return "A change in bladder or bowel function alongside back pain needs same-day medical attention, not a training plan.";
  if (screen.severeOrWorseningPain) return "Pain this severe, or pain that's been getting worse despite rest, needs a clinical assessment before training.";
  if (screen.thumbBasePainAfterFall) return "Thumb-base pain after a fall can be a scaphoid fracture — this needs a clinical assessment, not a training plan.";
  if (screen.ulnarWristClickingUnderLoad) return "Clicking with pain on the pinky side of the wrist under load needs a clinical assessment before training.";
  return null;
}

/**
 * Step 1b. §7's sport refusal list and §10 point 4-7's non-joint refusals,
 * plus §5's weight-cut refusal (surfaced through SportProfile.currentlyCuttingWeight
 * rather than here, since it downgrades a plan rather than blocking one — see
 * that field's comment in types.ts).
 */
export function globalRefusalReason(screen: GlobalRefusalScreen): string | null {
  if (screen.pregnantWithPelvicFloorSymptoms) return "Pelvic floor symptoms during or after pregnancy need a clinical assessment — this isn't safe to automate.";
  if (screen.persistentWidespreadChronicPain) return "Persistent widespread or chronic pain is a person-management problem, not an exercise-selection one — this needs a human to frame and dose it.";
  if (screen.returnToPlayUnder12Months) return "Returning to play from a significant injury within 12 months needs a clinician's objective return-to-sport criteria, not an automated plan.";
  if (screen.youthPrePuberty) return "This app doesn't auto-generate programs for pre-puberty athletes — no maximal loading or 1RM work should be prescribed at this stage without a coach involved.";
  return null;
}

/**
 * The one per-joint route-out that isn't a red flag or a global refusal: §10's
 * knee section says post-ACL or post-surgical "needs objective return-to-sport
 * criteria and a clinician," full stop, independent of how long ago it was
 * (contrast with RedFlagScreen's postSurgicalWithinSixMonthsNoClearance, which
 * is time-boxed and joint-agnostic). Selecting this presentation on the knee
 * disambiguation question is itself the signal — there's no lesser version of
 * it to substitute around.
 */
export function jointRouteOutReason(injuries: InjuryProfile): string | null {
  if (injuries.knee?.presentation === "post_surgical_or_acl") {
    return "Post-ACL or post-surgical knees need objective return-to-sport criteria from a clinician before resuming structured training.";
  }
  return null;
}

/**
 * Runs all of step 1 in the order §10 gives it. Null means the automated path
 * may proceed to step 2 with `activeTags`; a non-null result is a
 * TemplateResult `needsHumanReason` and no plan should be produced.
 */
export function needsHumanReason(input: { redFlags: RedFlagScreen; globalRefusals: GlobalRefusalScreen; injuries: InjuryProfile }): string | null {
  return redFlagReason(input.redFlags) ?? globalRefusalReason(input.globalRefusals) ?? jointRouteOutReason(input.injuries);
}

/**
 * Step 2. Which InjuryTag values are "hot" for this athlete right now — the
 * set exercise selection must treat as contraindicated. Empty when nothing is
 * flagged, which is the common case and means every exercise is a candidate.
 *
 * `post_surgical_or_acl` intentionally produces no tag: it's handled entirely
 * by jointRouteOutReason above and should never reach here (a caller that
 * checks needsHumanReason first, as it must, will already have stopped).
 */
export function activeTags(injuries: InjuryProfile): InjuryTag[] {
  const tags: InjuryTag[] = [];

  if (injuries.shoulder) tags.push("shoulder");
  if (injuries.wrist) tags.push("wrist");
  if (injuries.elbow) tags.push("elbow");

  switch (injuries.lowerBack?.pattern) {
    case "flexion_intolerant":
      tags.push("lower_back_flexion_intolerant");
      break;
    case "extension_intolerant":
      tags.push("lower_back_extension_intolerant");
      break;
    case "unsure":
      tags.push("lower_back_flexion_intolerant", "lower_back_extension_intolerant");
      break;
    default:
      break;
  }

  switch (injuries.knee?.presentation) {
    case "anterior_patellar":
      tags.push("knee_anterior_patellar");
      break;
    case "meniscal_joint_line":
      tags.push("knee_meniscal_joint_line");
      break;
    case "unsure":
      tags.push("knee_anterior_patellar", "knee_meniscal_joint_line");
      break;
    // "post_surgical_or_acl" deliberately produces no tag — see doc comment.
    default:
      break;
  }

  switch (injuries.hip?.presentation) {
    case "anterior_groin":
      tags.push("hip_anterior_groin");
      break;
    case "lateral_glute":
      tags.push("hip_lateral_glute");
      break;
    case "posterior_hamstring":
      tags.push("hip_posterior_hamstring");
      break;
    case "unsure":
      tags.push("hip_anterior_groin", "hip_lateral_glute", "hip_posterior_hamstring");
      break;
    default:
      break;
  }

  return tags;
}

/**
 * Step 2/3, per exercise. True when this exercise carries none of the
 * athlete's active tags and is therefore safe to select. An untagged
 * exercise (no `injury_contraindications` metadata at all) is always safe —
 * absence of data means "no known contraindication," not "assume the worst,"
 * matching patterns.ts's own convention that missing tags fail toward being
 * skipped for *positive* requirements (slot_patterns) but not toward being
 * excluded for *negative* ones.
 */
export function isSafeForInjuries(exercise: Pick<Exercise, "metadata">, tags: readonly InjuryTag[]): boolean {
  if (tags.length === 0) return true;
  const exerciseTags = contraindications(exercise);
  return !exerciseTags.some((tag) => (tags as readonly string[]).includes(tag));
}

/**
 * §10 point 7: shoulder + lower back flagged together, or three or more flags
 * at once, signals the substitution graph will produce something incoherent —
 * "generate a deliberately conservative full-body program and recommend a
 * consultation, rather than intersecting six exclusion lists." This is a
 * property of the success case (GeneratedTemplate.recommendConsultation), not
 * a refusal: a plan really is produced and is safe to train on.
 *
 * Counts joints flagged, not tags produced — "unsure" on one joint pushes out
 * two or three tags but is still one flagged joint, and the coach's "three or
 * more flags" means three body parts, not three exclusion rules.
 */
export function recommendConsultationReason(injuries: InjuryProfile): string | null {
  const flaggedJoints = [
    injuries.shoulder,
    injuries.lowerBack !== null,
    injuries.knee !== null,
    injuries.wrist,
    injuries.hip !== null,
    injuries.elbow,
  ].filter(Boolean).length;

  if (injuries.shoulder && injuries.lowerBack !== null) {
    return "Shoulder and lower back are both flagged — generating a conservative full-body plan and recommending a consultation rather than trying to satisfy both substitution graphs at once.";
  }
  if (flaggedJoints >= 3) {
    return "Three or more joints are flagged — generating a conservative full-body plan and recommending a consultation rather than intersecting that many exclusion lists.";
  }
  return null;
}
