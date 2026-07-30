import type { ExperienceLevel } from "@/lib/supabase/types";
import type { BlockRole, ExerciseCategory, PrescriptionType, ProgramDiscipline } from "@/lib/programs/types";
import type { MovementPattern, MuscleGroup } from "@/lib/exercises/types";

/**
 * "Build my program" — a questionnaire-driven program generator, deliberately
 * built as a fully deterministic pipeline rather than an LLM freehanding a
 * plan. See lib/programs/generate/README (this file's sibling comments) for
 * the reasoning: real programming science (linear progression, RP-style
 * volume landmarks, base-build-peak-taper for running) is well-established
 * and testable as plain code, whereas letting a model invent set/rep/
 * intensity numbers and progression math from scratch is exactly the kind
 * of thing that can quietly produce an unsafe or nonsensical plan. Every
 * type in this module exists to keep "how much/how hard/what exercise" as
 * data and pure functions, not a prompt.
 *
 * This module's shape reflects a real S&C coach's answers (see
 * deload-program-generator-coach-answers.md in the project root, not this
 * repo — it's the design reference, not app code) to a structured interview,
 * not generic published science. Two of that document's framing points
 * shaped this file directly:
 *
 * 1. "Do not ship a purely calendar-based generator." WeekSetPlan/
 *    SlotPrescription below are still expressed as a pure function of week
 *    index — that's intentional, they're the calendar *skeleton*. The three
 *    feedback rules the coach specified (RPE gate, user-visible repeat/
 *    advance, two-question readiness check) are a runtime layer on top of
 *    that skeleton, not part of it, because they need session-logging data
 *    this module doesn't own. See the tracked task for that layer.
 * 2. "Section 10 [injuries] is where software can actually hurt someone."
 *    InjuryProfile/RedFlagScreen below model the coach's three-step gate
 *    (screen for red flags → route out; otherwise substitute-and-modify,
 *    never blanket-exclude; regress in a fixed order) rather than a flat
 *    list of banned exercises. That section is called out for a
 *    physiotherapist review before shipping — passing type-checks and
 *    tests is not sign-off.
 */

/** What the person is training for — drives both which discipline template
 * runs and which periodization style fits. Deliberately a flat enum rather
 * than free text: each value maps to exactly one template family below, so
 * "genuinely good" stays checkable (a template either exists and is tested,
 * or the goal isn't supported yet — no silent LLM improvisation to fall
 * back on).
 *
 * build_muscle_hypertrophy and build_muscle_bodybuilding are deliberately
 * separate values, not one goal with a difficulty flag — the coach's answer
 * to §4 is that bodybuilding is indexed on muscles (weak-point auditing,
 * regional isolation emphasis, higher per-muscle frequency) where general
 * hypertrophy is indexed on movement patterns, and that difference cascades
 * into exercise selection, not just set/rep numbers. */
export type TrainingGoal =
  | "build_muscle_hypertrophy"
  | "build_muscle_bodybuilding"
  | "get_stronger"
  | "powerlifting_peak"
  | "power_athletic"
  | "lose_fat"
  | "general_fitness"
  | "sport_specific"
  | "run_general"
  | "run_5k"
  | "run_10k"
  | "run_half_marathon"
  | "run_marathon"
  | "improve_conditioning"
  | "hybrid";

export type EquipmentAccess = "full_gym" | "home_gym" | "minimal_equipment" | "bodyweight_only";

export type Sex = "male" | "female" | "prefer_not_to_say";

/** Fields the coach flagged as commonly skipped by generic generators
 * (§14 point 13) — each has a real, testable effect on defaults, and none
 * of them should ever be used to *reduce* loading/volume defaults (the
 * "standard, insulting failure mode" the coach called out specifically for
 * sex, and the patronizing-intensity-reduction failure mode for age). */
export interface AthleteProfile {
  age: number;
  bodyweightKg: number | null;
  sex: Sex;
  /** True if the athlete is returning from a layoff of >=7 days. Per §3/
   * §14 point 12, a returner is *not* a novice — strength regains fast
   * (muscle memory) but connective tissue doesn't keep pace — so this seeds
   * a distinct 2-3 week ramp-in at ~60-70% of remembered loads rather than
   * resuming a plan at full load. Independent of experienceLevel. */
  recentLayoff: boolean;
}

/** Lower back, knee, and hip need a disambiguating question because the
 * *same* complaint ("hurts when I squat") wants opposite modifications
 * depending on presentation (§10 hip section: "the highest ratio of
 * 'sounds simple, needs disambiguation' in the whole list"). Shoulder,
 * wrist, and elbow don't need a sub-branch — the coach's answers for those
 * three give one substitution ladder regardless of presentation. */
export type LowerBackPattern = "flexion_intolerant" | "extension_intolerant" | "unsure";
export type KneePresentation = "anterior_patellar" | "meniscal_joint_line" | "post_surgical_or_acl" | "unsure";
export type HipPresentation = "anterior_groin" | "lateral_glute" | "posterior_hamstring" | "unsure";

/** Replaces a flat "list of flagged joints" with the decision-tree shape
 * the coach's answers actually require — see this file's header comment.
 * `null` means "not flagged." A present-but-unresolved presentation
 * ("unsure") should default to the most conservative modification for that
 * joint, per §10's instruction to default conservatively when
 * disambiguation fails rather than guess. */
export interface InjuryProfile {
  shoulder: boolean;
  lowerBack: { pattern: LowerBackPattern } | null;
  knee: { presentation: KneePresentation } | null;
  wrist: boolean;
  hip: { presentation: HipPresentation } | null;
  elbow: boolean;
}

/** Step 1 of §10's three-step gate. Any true value here means the
 * automated path must not run at all — this produces a "needs a clinician"
 * TemplateResult (see below), never a generated plan, regardless of how
 * good the rest of the inputs look. Deliberately checked before any
 * template logic runs, not folded into InjuryProfile, so it can't be
 * silently bypassed by a template that only reads InjuryProfile. */
export interface RedFlagScreen {
  radicularOrNumbnessSymptoms: boolean;
  unexplainedWeakness: boolean;
  nightPainThatWakesThem: boolean;
  jointLocksCatchesOrGivesWay: boolean;
  recentTraumaWithSwellingOrCantBearWeight: boolean;
  postSurgicalWithinSixMonthsNoClearance: boolean;
  systemicSymptomsAlongsidePain: boolean;
  bladderOrBowelChangeWithBackPain: boolean;
  severeOrWorseningPain: boolean;
}

/** Conditions the coach's answers say to route to a human rather than
 * attempt, beyond the joint-level RedFlagScreen — §7's sport refusal list,
 * §10 point 4-7's non-joint refusals, §5's weight-cut refusal. Each is a
 * simple yes/no the questionnaire can ask directly; none of these should
 * ever be inferred. */
export interface GlobalRefusalScreen {
  pregnantWithPelvicFloorSymptoms: boolean;
  persistentWidespreadChronicPain: boolean;
  /** Return-to-play from ACL/Achilles/fracture/concussion/surgery within
   * 12 months — §10 point 6, §7 refusal item 6. */
  returnToPlayUnder12Months: boolean;
  /** Youth pre-puberty or early-puberty (roughly under 13-14, or
   * pre-peak-height-velocity) — §7 refusal item 5. Route to a general
   * athletic-development template with no maximal loading/1RM work if the
   * questionnaire supports it; otherwise decline outright. */
  youthPrePuberty: boolean;
}

/** Required only when goal is "powerlifting_peak"; null otherwise. */
export interface PowerliftingMeetDetails {
  /** ISO date string. Weeks-out is computed against "today" at generation
   * time and drives the phase table in §5 (16-13/12-9/8-5/4-3/2/1 weeks
   * out). <8 weeks on a first meet compresses to an 8-week peak with a
   * short-prep warning; <4 weeks generates a taper-only plan. */
  meetDateISO: string;
  isFirstMeet: boolean;
}

/** The coach's 7 sport groupings (§7) — deliberately groups, not one value
 * per sport, because the answers are explicit that most sports within a
 * group get "basically the same programming." Where a group needs a
 * genuinely distinct template despite the grouping (rugby/American
 * football within field_court_invasion; sprinters/jumpers vs throwers
 * within track), that's a template-selection detail for task #23, not a
 * reason to split the enum further here. */
export type SportGroup =
  | "field_court_invasion"
  | "rotational_overhead"
  | "combat_striking"
  | "combat_grappling"
  | "swimming"
  | "track_sprint_jump"
  | "track_throws"
  | "endurance_other"
  | "golf"
  | "climbing"
  | "skiing_snowboarding"
  | "dance"
  | "hiking_hyrox";

export type SeasonPhase = "off_season" | "pre_season" | "in_season" | "post_season";

/** Required only when goal is "sport_specific"; null otherwise. Fields
 * below are the "3-4 targeted questions instead of a movement screen" the
 * coach's §7 answer specifies. */
export interface SportProfile {
  sportGroup: SportGroup;
  /** Matters more than the sport itself per §7 — ask it explicitly. */
  seasonPhase: SeasonPhase;
  practicesOrGamesPerWeek: number;
  /** Free-text position/role (e.g. rugby "forwards vs backs", baseball
   * "pitcher vs position player"). Surfaced to the template as a hint only
   * — not a fixed enough vocabulary to branch deterministic logic on, but
   * per §7's rugby note this one detail can matter more than the sport
   * label, so it's carried through rather than discarded. */
  position: string | null;
  injuryInLast12Months: boolean;
  currentPain: boolean;
  canSquatToDepthPainFree: boolean;
  canReachArmsOverheadAgainstWall: boolean;
  /** Combat/weight-class sports only. True means downgrade everything —
   * volume -30%, no new stimulus, maintenance only — rather than program
   * normally. The coach's answers refuse to give weight-cut guidance
   * itself; this flag only affects training-load defaults. */
  currentlyCuttingWeight: boolean;
}

export type HybridPriority = "resistance_primary" | "endurance_primary";

/** Required only when goal is "hybrid"; null otherwise. §13: force a
 * priority declaration — the secondary goal is maintained, not developed,
 * and the UI should say so explicitly. secondaryGoal reuses TrainingGoal
 * so the hybrid template can borrow directly from an existing run/cardio/
 * resistance template for whichever side isn't primary, rather than
 * duplicating maintenance-dose logic. */
export interface HybridProfile {
  priority: HybridPriority;
  secondaryGoal: TrainingGoal;
}

export interface ProgramGenerationInput {
  goal: TrainingGoal;
  experienceLevel: ExperienceLevel;
  daysPerWeek: number;
  /** Roughly how long a single session should take — used to cap how many
   * exercise slots a day gets, not fed into any intensity/volume math. */
  sessionLengthMinutes: number;
  equipmentAccess: EquipmentAccess;
  athlete: AthleteProfile;
  injuries: InjuryProfile;
  redFlags: RedFlagScreen;
  globalRefusals: GlobalRefusalScreen;
  programLengthWeeks: number;
  /** Required when goal is "powerlifting_peak", ignored otherwise. */
  powerlifting: PowerliftingMeetDetails | null;
  /** Required when goal is "sport_specific", ignored otherwise. */
  sport: SportProfile | null;
  /** Required when goal is "hybrid", ignored otherwise. */
  hybrid: HybridProfile | null;
}

/** The fully-resolved prescription for one exercise slot in one specific
 * week — everything toSetRow (assemble.ts) needs to build a real SetRow.
 * Produced by a SlotPrescription's forWeek function, never hand-authored
 * per week; see ProgramTemplate's own comment for why progression is
 * expressed as a function of week index instead of duplicated per-week data.
 *
 * This is the calendar *skeleton* referenced in this file's header comment
 * — it does not know about a specific athlete's logged RPE/readiness. The
 * runtime feedback layer (RPE gate, repeat/advance, readiness check) reads
 * and adjusts a resolved WeekSetPlan at training time; it doesn't change
 * this type's shape. */
export interface WeekSetPlan {
  prescriptionType: PrescriptionType;
  sets: number;
  reps?: string | null;
  minReps?: number | null;
  maxReps?: number | null;
  percent1RM?: number | null;
  rpe?: number | null;
  rir?: number | null;
  restSeconds?: number | null;
  distanceMeters?: number | null;
  durationSeconds?: number | null;
  paceSecondsPerKm?: number | null;
  heartRateZone?: number | null;
  notes?: string | null;
}

export interface SlotPrescription {
  forWeek: (weekIndex: number, totalWeeks: number, isDeloadWeek: boolean) => WeekSetPlan;
}

/** One exercise's worth of a training day — not yet a real exercise, just a
 * description of what the day needs at this position (a squat pattern hit
 * for quads, a horizontal pull for back, etc). select-exercises.ts resolves
 * each slot to a real Exercise Library row; assemble.ts turns the resolved
 * pair (slot + exercise) into a BlockExerciseRow. `movementPattern`/
 * `primaryMuscleGroup` are both nullable because some slots (a plain
 * conditioning finisher, an "athlete's choice" accessory) don't need to
 * pin either — see select-exercises.ts's fallback ordering. */
export interface ExerciseSlot {
  role: BlockRole;
  category: ExerciseCategory;
  movementPattern: MovementPattern | null;
  primaryMuscleGroup: MuscleGroup | null;
  /** Compound/primary-pattern slots get filled before accessory slots when
   * a day must be trimmed to fit sessionLengthMinutes (see trimDayToLength
   * in generate-plan.ts) — losing an accessory row is a much smaller
   * quality hit than losing the day's main lift. */
  isPrimary: boolean;
  /** True for the 3-5 movements a template designates as scheduled-
   * progression lifts (§2: "don't put an accessory on a scheduled
   * progression"). This is also the flag the runtime RPE-gate rule (task
   * #20) reads to decide which slots' next-session load it's allowed to
   * adjust — inert until that layer exists, but the data needs to be
   * produced here since only the template knows which slots are primary
   * progression lifts versus opportunistic accessories. */
  autoregulationEligible: boolean;
  prescription: SlotPrescription;
}

export interface DayPlan {
  label: string;
  isRestDay: boolean;
  slots: ExerciseSlot[];
}

/**
 * The week-to-week *structure* of a generated program: which days exist,
 * what each day trains, in what order. Deliberately identical across every
 * generated week — only the numbers inside each slot's SlotPrescription
 * change week to week (progressive overload, wave loading, a deload's
 * volume cut). Real programs sometimes also rotate exercises or shift
 * emphasis block to block; that's a real simplification this v1 makes on
 * purpose (documented in each template's own comment) rather than
 * something attempted here — it keeps every template a single, testable
 * data structure instead of programLengthWeeks worth of near-duplicates.
 */
export interface WeekStructure {
  days: DayPlan[];
}

export interface ProgramTemplate {
  name: string;
  discipline: ProgramDiscipline;
  weekStructure: WeekStructure;
  /** 1-based week indices that should apply a deload (reduced volume/
   * intensity) — read by each slot's own forWeek, since only the template
   * that built a slot's prescription knows how "reduced" should look for
   * that slot (e.g. a strength slot drops sets, a running slot drops
   * mileage). */
  deloadWeeks: number[];
}

/**
 * A template family (one per goal/discipline) picks the right variant for
 * the person's experience level and constraints, or reports why it can't.
 * Two distinct non-success cases, deliberately not collapsed into one:
 *
 * - `error`: the requested combination can't produce a *sound* plan as
 *   specified (e.g. marathon goal with 2 days/week and no running history),
 *   but a different combination of the same inputs would work fine. The UI
 *   can suggest the adjustment (§11: "generate a half-marathon plan
 *   instead, explain why in one sentence").
 * - `needsHumanReason`: nothing in this input space should be
 *   auto-generated at all — a RedFlagScreen hit, a GlobalRefusalScreen hit,
 *   or a §7/§5 hard-refusal case (youth pitcher, gymnastics, active weight
 *   cut, Olympic weightlifting as a sport, third-attempt/weight-cut
 *   guidance). No adjustment to the questionnaire answers should be
 *   presented as a workaround — the UI should say "this needs a real coach"
 *   and stop, not retry with different inputs.
 *
 * Returning an explicit result rather than silently degrading the plan is
 * the same "don't quietly produce something unsound" principle as keeping
 * AI off the critical path.
 */
export type TemplateResult = { template: ProgramTemplate } | { error: string } | { needsHumanReason: string };

export type TemplateBuilder = (input: ProgramGenerationInput) => TemplateResult;
