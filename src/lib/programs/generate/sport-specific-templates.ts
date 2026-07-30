import { needsHumanReason, recommendConsultationReason } from "@/lib/programs/generate/injuries";
import type {
  DayPlan,
  ExerciseSlot,
  ProgramGenerationInput,
  ProgramPhase,
  ProgramTemplate,
  SeasonPhase,
  SlotPattern,
  SportGroup,
  SportProfile,
  TemplateResult,
  TrainingGoal,
  WeekContext,
  WeekSetPlan,
  WeekStructure,
} from "@/lib/programs/generate/types";
import type { MuscleGroup } from "@/lib/exercises/types";

/**
 * §7's sport-specific template — deliberately built as "general athletic
 * development with a [sport] emphasis," per the coach's own framing: "what's
 * genuinely sport-specific about gym work is much smaller than users think
 * ... ~70-80% of a good off-season gym program is identical." This file's
 * name is a small honesty check on itself — it does not attempt a movement
 * screen, skill work, tactical conditioning, or return-to-play, all of which
 * §7 explicitly draws the line at.
 *
 * THE ONE THING THAT MATTERS MOST: SEASON PHASE, NOT SPORT
 * -------------------------------------------------------------
 * "In-season vs off-season... matters more than which sport it is... if
 * your generator can only do one sport-specific thing, do this table." This
 * file treats SeasonPhase as the primary axis — it sets days/week, session
 * intensity, and how many movements a day even gets (in-season trims to
 * this file's top 3-4 priority slots, per §7's "3-4 movements" cap) — and
 * layers each SportGroup's emphasis on top of that shared shape, not the
 * other way around.
 *
 * WHY GROUPS, AND WHY THE ORDERED-SLOT-LIST TRIMMING APPROACH
 * -----------------------------------------------------------------
 * SportGroup is already the coach's own grouping (see that type's comment).
 * Each group's slot list here is ordered highest-priority first — usually
 * the pattern §7 names as that group's biggest real difference (adductor
 * work for field/court, rotational power for racquet/golf/throwers, neck for
 * combat/rugby-adjacent sports) — so that in-season's harder trim keeps
 * what actually matters for that sport rather than an arbitrary subset.
 *
 * WHAT THIS FILE ACTS ON VERSUS ONLY WARNS ABOUT
 * ---------------------------------------------------
 * §7's "3-4 targeted questions instead of a movement screen" are
 * SportProfile's own fields. Two of them change the generated structure:
 * `canReachArmsOverheadAgainstWall` drops vertical_push from the day
 * entirely when false (mirroring how a flagged shoulder already
 * substitutes away from it elsewhere in this generator); `throwingSessionsPerWeek`
 * on a rotational_overhead athlete either states plainly that this template
 * doesn't manage the throwing arm (unknown volume) or drops heavy pressing
 * outright (meaningful known volume) — the two responses §7 explicitly
 * calls acceptable. `canSquatToDepthPainFree`, `injuryInLast12Months` and
 * `currentPain` are lighter-weight than the full InjuryProfile screen this
 * questionnaire also collects, so rather than pretend to re-derive a
 * substitution graph from a single yes/no, they surface as warnings asking
 * the athlete to flag it before the relevant session — consistent with §7's
 * own instruction not to pretend this is a movement screen.
 * `currentlyCuttingWeight` downgrades volume ~30% regardless of sport, per
 * the coach's explicit instruction (this app refuses to give weight-cut
 * guidance itself; the flag only affects training-load defaults, same
 * convention as PowerliftingMeetDetails' handling elsewhere).
 *
 * WHAT'S ALREADY UNREACHABLE, NOT SOMETHING THIS FILE NEEDS TO REFUSE
 * -----------------------------------------------------------------------
 * §7's flat refusal list mostly isn't reachable through this path at all:
 * youth pre-puberty and return-to-play-under-12-months are
 * GlobalRefusalScreen fields, checked by needsHumanReason before this file's
 * logic ever runs; youth throwing pitchers/bowlers are covered by the
 * throwing-volume handling above; gymnastics/diving and "Olympic
 * weightlifting as a sport" were never given SportGroup values to select in
 * the first place (see that type's own comment — deliberately not split out
 * further). Only the weight-cut case needed an explicit downgrade here.
 *
 * WHAT'S NOT MODELED, STATED ONCE
 * -------------------------------------
 * §7's "in-season: no lower-body work of consequence if games are within
 * 48h" and "deload the week of a big competition" both need calendar/
 * fixture data this generator's static types don't carry — a template
 * builder that doesn't know what day training happens can't know what's
 * 48h from a game. Both are runtime-scheduling concerns, not something a
 * week-shape skeleton can enforce.
 */

export function isSportSpecificGoal(goal: TrainingGoal): goal is "sport_specific" {
  return goal === "sport_specific";
}

interface SeasonPhaseSpec {
  dayRange: readonly [number, number];
  sets: number;
  minReps: number;
  maxReps: number;
  rir: number;
  restSeconds: number;
  maxSlotsPerDay: number;
  label: string;
  notes: string;
}

// §7's own table, translated RPE -> RIR (RPE = 10 - RIR) at the more
// conservative end of each range, same convention as every other template
// in this module.
const SEASON_PHASE_TABLE: Record<SeasonPhase, SeasonPhaseSpec> = {
  off_season: {
    dayRange: [3, 4],
    sets: 4,
    minReps: 6,
    maxReps: 10,
    rir: 3,
    restSeconds: 120,
    maxSlotsPerDay: 7,
    label: "Off-Season",
    notes: "Off-season — highest volume this program will ask of you. Some soreness is acceptable; new exercises are fine here.",
  },
  pre_season: {
    dayRange: [2, 3],
    sets: 3,
    minReps: 4,
    maxReps: 8,
    rir: 2,
    restSeconds: 150,
    maxSlotsPerDay: 6,
    label: "Pre-Season",
    notes: "Pre-season — shifting toward power and speed. Volume is down from off-season as sport volume climbs.",
  },
  in_season: {
    dayRange: [1, 2],
    sets: 3,
    minReps: 3,
    maxReps: 5,
    rir: 3,
    restSeconds: 150,
    maxSlotsPerDay: 4,
    label: "In-Season",
    notes: "In-season — maintenance only. Heavy-ish, low volume, zero intended soreness. No new exercises, and this should never be the thing that leaves you sore for a match.",
  },
  post_season: {
    dayRange: [0, 2],
    sets: 2,
    minReps: 8,
    maxReps: 12,
    rir: 4,
    restSeconds: 90,
    maxSlotsPerDay: 3,
    label: "Post-Season",
    notes: "Post-season / transition — rest and address nagging issues. This is deliberately unstructured; treat it as optional, not a program to chase numbers on.",
  },
};

interface SlotSpec {
  pattern: SlotPattern;
  muscleGroup: MuscleGroup;
}

const SQUAT: SlotSpec = { pattern: "squat_bilateral", muscleGroup: "quadriceps" };
const HINGE: SlotSpec = { pattern: "hinge_bilateral", muscleGroup: "hamstrings" };
const PULL: SlotSpec = { pattern: "horizontal_pull", muscleGroup: "back" };
const PUSH: SlotSpec = { pattern: "horizontal_push", muscleGroup: "chest" };
const VERTICAL_PUSH: SlotSpec = { pattern: "vertical_push", muscleGroup: "shoulders" };
const JUMP: SlotSpec = { pattern: "jump", muscleGroup: "quadriceps" };
const CORE: SlotSpec = { pattern: "anti_extension", muscleGroup: "core" };

/**
 * One ordered slot list per group, highest-priority first — see this file's
 * header comment. `canOverhead` inserts/omits vertical_push per SportProfile
 * .canReachArmsOverheadAgainstWall; swimming omits it unconditionally
 * (already gets more overhead volume than it needs from the pool) rather
 * than reading that flag at all.
 */
function orderedSlotsForGroup(group: SportGroup, canOverhead: boolean): SlotSpec[] {
  const overheadPush: SlotSpec[] = canOverhead ? [VERTICAL_PUSH] : [];

  switch (group) {
    case "field_court_invasion":
      // Hamstring/adductor prophylaxis is §7's single most emphasized
      // priority in this group — placed right after the primary lower-body
      // pattern so it survives in-season trimming.
      return [SQUAT, HINGE, { pattern: "hip_adduction", muscleGroup: "glutes" }, PULL, PUSH, ...overheadPush, JUMP, CORE];
    case "rotational_overhead":
      return [SQUAT, HINGE, { pattern: "rotational_power", muscleGroup: "core" }, PULL, PUSH, { pattern: "scapular_control", muscleGroup: "shoulders" }, ...overheadPush, CORE];
    case "combat_striking":
      return [SQUAT, HINGE, { pattern: "rotational_power", muscleGroup: "core" }, PULL, PUSH, { pattern: "neck", muscleGroup: "full_body" }, CORE];
    case "combat_grappling":
      // Grip/isometric endurance is "often the actual limiting factor,
      // almost never programmed" — the carry slot is the closest proxy this
      // library has.
      return [SQUAT, HINGE, { pattern: "carry", muscleGroup: "full_body" }, PULL, PUSH, { pattern: "neck", muscleGroup: "full_body" }, CORE];
    case "swimming":
      // Reduce overhead/pulling volume rather than add to it — no
      // vertical_push, no extra horizontal_pull beyond what's already here.
      return [SQUAT, HINGE, { pattern: "scapular_control", muscleGroup: "shoulders" }, JUMP, CORE, { pattern: "calf_gastroc", muscleGroup: "calves" }];
    case "track_sprint_jump":
      return [SQUAT, HINGE, { pattern: "hinge_unilateral", muscleGroup: "hamstrings" }, JUMP, PULL, PUSH, CORE];
    case "track_throws":
      // "Program much closer to a weightlifter/powerlifter... mass is an
      // asset" — leans on the same base four plus rotational power rather
      // than trimming toward speed work.
      return [SQUAT, HINGE, { pattern: "rotational_power", muscleGroup: "core" }, PULL, PUSH, ...overheadPush, CORE];
    case "endurance_other":
      return [SQUAT, HINGE, { pattern: "squat_unilateral", muscleGroup: "quadriceps" }, { pattern: "calf_soleus", muscleGroup: "calves" }, JUMP, CORE];
    case "golf":
      return [SQUAT, HINGE, { pattern: "rotational_power", muscleGroup: "core" }, { pattern: "anti_rotation", muscleGroup: "core" }, PULL, PUSH, CORE];
    case "climbing":
      // Pulling bias is the sport itself — antagonist pressing work is
      // placed early on purpose, to balance it rather than pile onto it.
      return [PULL, SQUAT, HINGE, PUSH, { pattern: "scapular_control", muscleGroup: "shoulders" }, CORE];
    case "skiing_snowboarding":
      return [SQUAT, HINGE, { pattern: "squat_unilateral", muscleGroup: "quadriceps" }, JUMP, CORE, PULL];
    case "dance":
      return [{ pattern: "squat_unilateral", muscleGroup: "quadriceps" }, HINGE, { pattern: "calf_soleus", muscleGroup: "calves" }, { pattern: "hip_abduction", muscleGroup: "glutes" }, CORE];
    case "hiking_hyrox":
      return [SQUAT, HINGE, { pattern: "carry", muscleGroup: "full_body" }, PULL, PUSH, CORE];
    default:
      return [SQUAT, HINGE, PULL, PUSH, CORE];
  }
}

const GROUP_NOTES: Record<SportGroup, string> = {
  field_court_invasion: "Hamstring and adductor work are non-negotiable here, not optional accessories — they're included in every session by default.",
  rotational_overhead: "Rotational power and shoulder health are this group's biggest levers — med ball rotational work and posterior-cuff/scapular control are built in.",
  combat_striking: "You're almost certainly already carrying a full fatigue load from sport training — this stays short and low-volume on purpose, and should never be the reason you're sore for practice.",
  combat_grappling: "Grip and neck work are included deliberately — both are commonly under-trained for grappling and both are load-bearing for the sport.",
  swimming: "This program reduces overhead and pulling volume rather than adding to it — you're likely already at or near the ceiling for shoulder-friendly overhead work from the pool alone.",
  track_sprint_jump: "Low volume, high intensity, long rest, nothing to failure — sprinting and jumping are the training here; the gym work supports it rather than competing with it.",
  track_throws: "This leans closer to a strength/weightlifting emphasis than a sprinter's program — for this group, more mass is usually an asset, not something to manage.",
  endurance_other: "Heavy and low-volume, on purpose — there's good evidence heavy strength work improves economy, and essentially none that high-rep 'muscular endurance' lifting does anything but cost you fatigue your sport needs instead.",
  golf: "Rotational speed and the ability to separate hips from shoulders are the priority quality here, with anti-rotation core work to keep the lumbar spine out of the rotation.",
  climbing: "Antagonist pressing work is included specifically to balance the sport's heavy pulling bias — shoulder health depends on it as much as grip does.",
  skiing_snowboarding: "Eccentric quad capacity and landing/deceleration mechanics are the main injury-prevention lever for this group.",
  dance: "Volume is kept conservative here on purpose — dancers are commonly under-fuelled and over-trained, and this program shouldn't add to that risk.",
  hiking_hyrox: "This is essentially endurance plus loaded carries and grip work — kept simple on purpose.",
};

function slotPrescription(spec: SeasonPhaseSpec, cuttingWeight: boolean): { forWeek: (ctx: WeekContext) => WeekSetPlan } {
  const sets = cuttingWeight ? Math.max(1, Math.round(spec.sets * 0.7)) : spec.sets;
  const notes = cuttingWeight ? `${spec.notes} Volume is reduced further while you're cutting weight — maintenance only, no new stimulus.` : spec.notes;
  return {
    forWeek: (): WeekSetPlan => ({ prescriptionType: "rir", sets, minReps: spec.minReps, maxReps: spec.maxReps, rir: spec.rir, restSeconds: spec.restSeconds, notes }),
  };
}

function toExerciseSlot(slot: SlotSpec, spec: SeasonPhaseSpec, cuttingWeight: boolean, isPrimary: boolean): ExerciseSlot {
  return {
    role: "main",
    category: "strength",
    movementPattern: slot.pattern,
    primaryMuscleGroup: slot.muscleGroup,
    isPrimary,
    autoregulationEligible: isPrimary,
    prescription: slotPrescription(spec, cuttingWeight),
  };
}

function buildDay(label: string, slots: SlotSpec[], spec: SeasonPhaseSpec, cuttingWeight: boolean): DayPlan {
  const trimmed = slots.slice(0, spec.maxSlotsPerDay);
  const exerciseSlots = trimmed.map((slot, i) => toExerciseSlot(slot, spec, cuttingWeight, i < 2));
  const loadsLowerBody = trimmed.some((s) => s.pattern === "squat_bilateral" || s.pattern === "squat_unilateral" || s.pattern === "hinge_bilateral" || s.pattern === "hinge_unilateral" || s.pattern === "jump");
  return { label, isRestDay: false, intensity: "moderate", loadsLowerBody, slots: exerciseSlots };
}

function buildDays(sport: SportProfile, requestedDays: number, warnings: string[]): DayPlan[] {
  const spec = SEASON_PHASE_TABLE[sport.seasonPhase];
  const [minDays, maxDays] = spec.dayRange;
  const effectiveDays = Math.min(maxDays, Math.max(minDays, requestedDays));
  if (effectiveDays !== requestedDays) {
    warnings.push(`${spec.label} caps at ${minDays === maxDays ? minDays : `${minDays}-${maxDays}`} lifting days a week regardless of what you asked for — ${spec.notes}`);
  }
  if (effectiveDays === 0) {
    warnings.push("No structured lifting days are generated for this phase — see the note above. Revisit this once you're back in pre-season or off-season training.");
    return [];
  }

  let slots = orderedSlotsForGroup(sport.sportGroup, sport.canReachArmsOverheadAgainstWall);
  if (!sport.canReachArmsOverheadAgainstWall) {
    warnings.push("You reported you can't reach your arms overhead against a wall pain-free, so overhead pressing is left out of this program entirely.");
  }

  if (sport.sportGroup === "rotational_overhead") {
    if (sport.throwingSessionsPerWeek == null) {
      warnings.push("This template doesn't manage your throwing arm — work with a pitching or bowling coach on that volume specifically.");
    } else if (sport.throwingSessionsPerWeek >= 3) {
      slots = slots.filter((s) => s.pattern !== "vertical_push");
      warnings.push(
        `With ${sport.throwingSessionsPerWeek} throwing sessions a week, this program drops heavy overhead pressing to avoid adding fatigue to an arm that's already working hard. No lat work to fatigue on throwing days is on you to manage day-to-day — this static plan can't see your weekly calendar.`
      );
    }
  }

  const days: DayPlan[] = [];
  for (let i = 0; i < effectiveDays; i++) {
    days.push(buildDay(`${spec.label} ${i + 1}`, slots, spec, sport.currentlyCuttingWeight));
  }
  return days;
}

function phaseByWeekFor(programLengthWeeks: number): Map<number, ProgramPhase> {
  const phaseByWeek = new Map<number, ProgramPhase>();
  for (let week = 1; week <= programLengthWeeks; week++) phaseByWeek.set(week, "standard");
  return phaseByWeek;
}

export function buildSportSpecificTemplate(input: ProgramGenerationInput): TemplateResult {
  const routeOut = needsHumanReason({ redFlags: input.redFlags, globalRefusals: input.globalRefusals, injuries: input.injuries });
  if (routeOut) return { needsHumanReason: routeOut };

  if (!isSportSpecificGoal(input.goal)) {
    return { error: `buildSportSpecificTemplate does not handle goal "${input.goal}"` };
  }
  if (!input.sport) {
    return { error: "Sport-specific programming requires a SportProfile (sport group, season phase, and the four screening questions)." };
  }
  const sport = input.sport;

  const warnings: string[] = [GROUP_NOTES[sport.sportGroup]];
  const days = buildDays(sport, input.daysPerWeek, warnings);

  if (sport.currentlyCuttingWeight) {
    warnings.push("You're cutting weight, so this program is downgraded across the board — maintenance only, no new stimulus. This app doesn't give weight-cut guidance itself; that's between you and your coach.");
  }
  if (sport.canSquatToDepthPainFree === false) {
    warnings.push("You reported you can't squat to depth pain-free — flag this before your first heavy squat session. A box squat or leg press may be a better fit than what's prescribed here.");
  }
  if (sport.injuryInLast12Months || sport.currentPain) {
    warnings.push(
      "You flagged an injury in the last 12 months or current pain on the sport screen — this is a lighter-weight check than the full injury questionnaire elsewhere in this app, so mention it directly to whoever reviews this program."
    );
  }
  if (sport.position) {
    warnings.push(`Position noted (${sport.position}) — this can matter more than the sport label, but isn't used to change the generated structure in this version.`);
  }

  const template: ProgramTemplate = {
    name: `${GROUP_LABELS[sport.sportGroup]} — General Athletic Development (${SEASON_PHASE_TABLE[sport.seasonPhase].label})`,
    discipline: "resistance",
    weekStructure: { days } satisfies WeekStructure,
    deloadWeeks: new Map(),
    phaseByWeek: phaseByWeekFor(input.programLengthWeeks),
  };

  return { template, warnings, recommendConsultation: consultationFrom(input) };
}

const GROUP_LABELS: Record<SportGroup, string> = {
  field_court_invasion: "Field/Court",
  rotational_overhead: "Racquet/Throwing",
  combat_striking: "Combat (Striking)",
  combat_grappling: "Combat (Grappling)",
  swimming: "Swimming",
  track_sprint_jump: "Track — Sprint/Jump",
  track_throws: "Track — Throws",
  endurance_other: "Endurance",
  golf: "Golf",
  climbing: "Climbing",
  skiing_snowboarding: "Skiing/Snowboarding",
  dance: "Dance",
  hiking_hyrox: "Hiking/Hyrox",
};

function consultationFrom(input: ProgramGenerationInput): { reason: string } | null {
  const reason = recommendConsultationReason(input.injuries);
  return reason ? { reason } : null;
}
