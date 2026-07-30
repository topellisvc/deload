import type { ExperienceLevel } from "@/lib/supabase/types";
import type { BlockRole, ExerciseCategory, PrescriptionType, ProgramDiscipline } from "@/lib/programs/types";
import type { MuscleGroup } from "@/lib/exercises/types";

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
 *    SlotPrescription below are still expressed as a pure function of a
 *    WeekContext — that's intentional, they're the calendar *skeleton*. The
 *    feedback rules the coach specified are a runtime layer on top of that
 *    skeleton, not part of it, because they need session-logging data this
 *    module doesn't own. There are *four*, not three: §2 gives the RIR gate,
 *    the user-visible repeat/advance control, and the two-question readiness
 *    check; §10 step 2 adds a per-joint "better/same/worse" check, which is
 *    the same kind of object (a small stateful rule reading session history
 *    to adjust the next prescription) and needs the same storage and
 *    precedence handling. See deload-autoregulation-design.md.
 *
 *    That design fixes one rule this module must honour: the runtime layer
 *    never rewrites a set_prescriptions row. Adjustments are stored as
 *    events and applied at read time, so a coach reviewing a generated
 *    program always sees the authored number plus an explained adjustment,
 *    never a number that silently changed underneath them.
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
  /** §10's wrist section names two route-outs that no other flag here
   * catches, both because they present as ordinary "sore wrist" and are
   * missed for exactly that reason. Kept as their own fields rather than
   * folded into recentTraumaWith... because neither requires swelling or an
   * inability to bear weight, which is what that flag asks about.
   *
   * Thumb-base pain after a fall is a scaphoid presentation — the coach
   * calls it "a genuine fracture risk that gets missed," and a missed
   * scaphoid fracture is a non-union risk, not a wait-and-see. */
  thumbBasePainAfterFall: boolean;
  /** Clicking with pain on the pinky side under load — TFCC. */
  ulnarWristClickingUnderLoad: boolean;
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
  /** Throwing/bowling sessions per week — baseball, softball, cricket only;
   * null for every other sport. §7 gates this group specifically: UCL injury
   * risk is driven by throwing volume, so a gym program that adds upper-body
   * load without knowing the throwing workload is "a real hazard."
   *
   * null on a throwing sport is not "zero" — it means unknown, and the coach
   * gives two acceptable responses to unknown, both of which the template
   * must implement rather than guessing: cap total upper-body load, or state
   * plainly that the template does not manage the throwing arm. Either way,
   * no heavy overhead pressing, no high-volume bench, and no lat work to
   * fatigue on throwing days. */
  throwingSessionsPerWeek: number | null;
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

/** Required for every run_* goal, and for "hybrid" when either side is a
 * run_* goal; null otherwise. §11's minimum-timeline table and its one hard
 * refusal ("marathon, under 24 weeks, no running history → generate a half
 * instead and explain why in one sentence") are both unimplementable without
 * this — the goal enum alone can't distinguish someone with a 40 km/week base
 * from someone who has never run.
 *
 * §11's marathon prerequisite is stated as "already comfortably running 25-30
 * km/week for at least 6 weeks," which is why this is two fields rather than
 * one: a single big week doesn't establish a base, and a sustained small one
 * isn't the same input as a sustained large one. */
export interface RunningHistory {
  currentWeeklyKm: number;
  /** How many consecutive weeks they've held roughly that volume. */
  weeksAtCurrentVolume: number;
  /** §11 point 8: beginners get run/walk intervals and a cap of 2
   * consecutive running days for the first 8 weeks. Distinct from
   * currentWeeklyKm being 0 — someone can be returning to running with a
   * real history behind them. */
  hasRunContinuouslyThirtyMinutes: boolean;
}

/** Required when goal is "build_muscle_bodybuilding"; null otherwise. §4's
 * bodybuilding section says the template *should ask* which groups the user
 * considers lagging, then act on it: put them first in the session, train
 * them 3x/week, give them 2-4 extra sets, and take them closer to failure.
 * A general-hypertrophy template deliberately doesn't collect this — that's
 * the difference between being indexed on muscles and being indexed on
 * movement patterns. */
export interface BodybuildingProfile {
  laggingMuscleGroups: MuscleGroup[];
}

/** §12's one high-value default: cycling and rowing produce far less muscle
 * damage than running and incline treadmill work, so someone lifting
 * seriously should have their conditioning biased toward cycling — the coach
 * says "this one default choice removes most concurrent-training friction."
 * Collected as a preference because the interference argument only wins if
 * they'll actually do it (§14 point 1). */
export type ConditioningModality = "cycling" | "rowing" | "incline_walking" | "elliptical" | "swimming" | "no_preference";

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
  /** Required for run_* goals and for a hybrid with a running side. */
  running: RunningHistory | null;
  /** Required when goal is "build_muscle_bodybuilding", ignored otherwise. */
  bodybuilding: BodybuildingProfile | null;
  conditioningModality: ConditioningModality;
  /** §6's middle ground. Hang power clean, high pull and power snatch from
   * blocks are "allowed but not default" — motivated people can learn them,
   * but the coach wants them behind an explicit "have you been coached on
   * this lift?" question, with the template defaulting to trap-bar jumps and
   * DB snatches instead. False must mean "don't prescribe them," never
   * "prescribe with a video link": §6's do-not-auto-prescribe list exists
   * because the failure mode is a barbell on the spine or wrists.
   *
   * Note this never unlocks the full snatch or clean & jerk, which §6 and
   * §7's refusal list put outside the automated path regardless of what the
   * user claims about their coaching history. */
  coachedOnOlympicLifts: boolean;
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

/**
 * §3 branches deloads into two kinds that need *opposite* treatment, which is
 * why this isn't a boolean:
 *
 * - `volume_cut` — the default. Cut sets 40-50%, hold load at 85-90% of last
 *   week, same reps, every set stops at RPE <= 6. The point is to dissipate
 *   fatigue while preserving the skill and neural adaptations already built,
 *   which dropping to 50% load and high reps preserves neither of.
 * - `joint_connective` — achy elbows/knees/shoulders, "everything is creaky."
 *   Load is the irritant, so cut *intensity* harder (65-70%) and reduce volume
 *   only modestly. Applying the default here keeps hammering the thing that
 *   hurts.
 * - `systemic` — bad sleep, low appetite, flat mood, resting HR up. Cut volume
 *   and frequency, drop a session, but keep a couple of heavy-ish singles at
 *   RPE 7 purely to hold the skill.
 *
 * The two-question readiness check (§2 Rule 3) is what distinguishes the last
 * two at runtime; a template picks a kind for a *scheduled* deload.
 */
export type DeloadKind = "volume_cut" | "joint_connective" | "systemic";

/**
 * Where in its own structure a week sits. A single union across every
 * discipline rather than a per-discipline generic: each template family only
 * ever emits its own values, and keeping forWeek's signature monomorphic is
 * worth more than preventing a running template from theoretically returning
 * "peaking".
 *
 * `calibration` is deliberately not "week 1" — §4's calibration rules (cap
 * everything at RPE 7 including accessories, prescribe reps and an effort
 * ceiling rather than a load, 2 sets not 4 on any exercise the athlete has
 * never done) also apply to a returner's ramp-in weeks per §14 point 12, and
 * to the first week after a reactive light week. Phase, not position.
 */
export type ProgramPhase =
  // Universal
  | "calibration"
  | "standard"
  | "deload"
  // Resistance blocks — §2's advanced 4- and 8-week structures
  | "accumulation"
  | "transition"
  | "intensification"
  | "realization"
  // Powerlifting peak — §5's weeks-out table
  | "gpp"
  | "strength"
  | "peaking"
  | "taper"
  | "meet_week"
  // Running — §11's base -> quality -> taper architecture
  | "base"
  | "quality"
  | "down_week";

/**
 * Everything a SlotPrescription needs to resolve one week's numbers.
 *
 * An object rather than positional arguments on purpose: this replaced
 * `(weekIndex, totalWeeks, isDeloadWeek)`, and the reason it had to change is
 * that a boolean couldn't carry DeloadKind and nothing carried phase identity
 * at all — leaving every template to re-derive its phase from arithmetic on
 * weekIndex, duplicated and untestable in isolation. An object means the next
 * addition (a returner ramp factor, a fat-loss volume discount) doesn't break
 * every template's signature again.
 *
 * Note what is deliberately *not* here: anything about a specific athlete's
 * logged performance. This is the calendar skeleton. The runtime feedback
 * layer adjusts a resolved WeekSetPlan at training time and stores its
 * adjustments separately — see this file's header comment.
 */
export interface WeekContext {
  /** 1-based, matching ProgramWeek.position. */
  weekIndex: number;
  totalWeeks: number;
  phase: ProgramPhase;
  /** null when this isn't a deload week. */
  deload: { kind: DeloadKind } | null;
}

export interface SlotPrescription {
  forWeek: (ctx: WeekContext) => WeekSetPlan;
}

/**
 * The generator's own movement-pattern vocabulary — finer than
 * lib/exercises/types.ts's `MovementPattern` column, which can't
 * distinguish horizontal from vertical pull, hip hinge from knee flexion, or
 * bilateral from unilateral squatting/hinging (all real weekly
 * non-negotiables per §1/§8). See patterns.ts's header comment for the full
 * reasoning and the per-exercise data model (`exercises.metadata`) that maps
 * real library rows onto this vocabulary — that reasoning lives there rather
 * than here because it's about how the tagging/ladder mechanism works, not
 * about what a day template needs to be able to ask for, which is this type.
 *
 * Defined here rather than in patterns.ts so that ExerciseSlot (below) can
 * use it without patterns.ts and types.ts importing each other in a circle —
 * patterns.ts already depends on this file for EquipmentAccess, so the
 * dependency only runs one way. patterns.ts re-exports this type and builds
 * ALL_SLOT_PATTERNS/isSlotPattern from it.
 */
export type SlotPattern =
  | "squat_bilateral"
  | "squat_unilateral"
  | "hinge_bilateral"
  | "hinge_unilateral"
  | "knee_flexion"
  | "horizontal_push"
  | "vertical_push"
  | "horizontal_pull"
  | "vertical_pull"
  | "carry"
  | "anti_extension"
  | "anti_rotation"
  | "rotational_power"
  | "hip_abduction"
  | "hip_adduction"
  | "calf_gastroc"
  | "calf_soleus"
  | "neck"
  | "jump"
  | "throw"
  | "sprint"
  | "shoulder_external_rotation"
  | "scapular_control"
  | "isometric_tendon";

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
  movementPattern: SlotPattern | null;
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

/** §13 point 6: "Count hard sessions across modalities, not within them." For
 * most people 3 genuinely hard sessions a week is the sustainable ceiling, and
 * a week containing heavy squats, heavy deadlifts, an interval session and a
 * long run is four — "it will fail." The coach calls this the single most
 * useful hybrid guardrail and notes it's easy to code, but only if each day
 * carries a tag to count. Also gates §13's sequencing rules (no heavy
 * lower-body within 24 h of a long run) and §6's 48 h between high-CNS
 * sessions. */
export type SessionIntensity = "easy" | "moderate" | "hard";

export interface DayPlan {
  label: string;
  isRestDay: boolean;
  /** Ignored when isRestDay. */
  intensity: SessionIntensity;
  /** True for a day whose lower body is meaningfully loaded — the specific
   * thing §13's spacing rules and §6's sprint/plyo spacing are about. A hard
   * upper-body day doesn't conflict with a long run; a moderate lower-body
   * one can. */
  loadsLowerBody: boolean;
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
  /** 1-based week index -> the kind of deload that week applies. Read by each
   * slot's own forWeek (via WeekContext.deload), since only the template that
   * built a slot's prescription knows how "reduced" should look for that slot
   * — a strength slot drops sets, a running slot drops mileage.
   *
   * A Map rather than the number[] this replaced, because §3's two deload
   * kinds need opposite treatment and a bare index list can't say which one a
   * given week is. Empty for a novice's first ~3 months: §3 is explicit that
   * a true novice isn't generating enough absolute training stress to
   * accumulate meaningful fatigue, that what stalls them is technique, food
   * or sleep rather than fatigue, and that forcing a deload in month 2 mostly
   * interrupts the momentum you're trying to protect. Reactive resets and the
   * runtime light-week triggers cover that case instead. */
  deloadWeeks: Map<number, DeloadKind>;
  /** 1-based week index -> phase, for every week in the program. Built by the
   * template because only it knows its own structure; consumed by
   * assemble.ts to construct each week's WeekContext. */
  phaseByWeek: Map<number, ProgramPhase>;
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
/**
 * A successfully generated template, plus the things the coach's answers
 * insist be *said* rather than silently applied.
 *
 * `warnings` exists because "say so in the UI" appears throughout the source
 * document and a success case that can't carry text means none of it ships:
 * that 2 days/week is maintenance for an advanced lifter (§1), that a novice's
 * week was capped at 4 days and why (§1), that 6 days with 75+ min sessions is
 * a completion risk (§1), that a meet prep is short (§5), that load is
 * expected to plateau in a deficit so the success metric is maintained load
 * and reps rather than weekly increases (§4), that this is general athletic
 * development with a sport emphasis and not a sport-specific program (§7),
 * that a marathon request became a half-marathon plan (§11), that a hybrid's
 * secondary goal is maintained and not developed (§13), and that hybrid
 * training raises energy requirements enough that under-fuelling is the usual
 * reason these plans fail (§13).
 *
 * These are not errors. The plan is sound; the user needs to know something
 * about it.
 */
export interface GeneratedTemplate {
  template: ProgramTemplate;
  warnings: string[];
  /**
   * Non-null when §10 point 7 fired: shoulder + lower back flagged together,
   * or three or more flags at once. The coach's instruction is specific — do
   * not intersect six exclusion lists and emit "a program of leg curls and
   * lateral raises." Generate a deliberately conservative full-body program
   * *and* recommend a consultation.
   *
   * Deliberately a field on the success case rather than a fourth variant of
   * TemplateResult: a plan really was produced and is safe to train on, which
   * is categorically different from needsHumanReason (no plan at all, and no
   * adjustment to the questionnaire should be offered as a workaround). The
   * UI must surface it prominently rather than treating it as another
   * warning string.
   */
  recommendConsultation: { reason: string } | null;
}

export type TemplateResult = GeneratedTemplate | { error: string } | { needsHumanReason: string };

export type TemplateBuilder = (input: ProgramGenerationInput) => TemplateResult;

/** Narrows Exercise.secondary_muscle_groups, which the Exercise Library types
 * as a bare string[] (it mirrors a text[] column). §8's set-counting rule
 * credits indirect work at 0.5 — a bench press counting 1.0 chest, 0.5 front
 * delt, 0.5 triceps — so per-muscle volume totals are computed *from* this
 * array, and an unrecognised string silently vanishing from a total is the
 * kind of bug that makes the whole volume-landmark check meaningless.
 *
 * Narrowing here rather than changing the shared Exercise type on purpose:
 * that type mirrors the database column and is consumed across the Exercise
 * Library UI, the picker and the detail page, none of which need the
 * guarantee. Keeping the boundary check inside generate/ means this feature
 * can be removed by deleting this directory. */
export function toMuscleGroups(values: readonly string[]): MuscleGroup[] {
  const valid = new Set<string>([
    "chest",
    "back",
    "shoulders",
    "quadriceps",
    "hamstrings",
    "glutes",
    "calves",
    "core",
    "biceps",
    "triceps",
    "forearms",
    "full_body",
  ] satisfies readonly MuscleGroup[]);
  return values.filter((value): value is MuscleGroup => valid.has(value));
}
