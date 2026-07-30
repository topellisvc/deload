"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { createClient } from "@/lib/supabase/client";
import { createProgramFromParsedProgram } from "@/lib/programs/mutations";
import { upsertAthleteInjuryProfile } from "@/lib/profile/mutations";
import type {
  EquipmentAccess,
  GlobalRefusalScreen,
  HipPresentation,
  HybridPriority,
  InjuryProfile,
  KneePresentation,
  LowerBackPattern,
  ProgramGenerationInput,
  RedFlagScreen,
  SeasonPhase,
  Sex,
  SportGroup,
  TrainingGoal,
} from "@/lib/programs/generate/types";
import type { MuscleGroup } from "@/lib/exercises/types";
import type { ProgramDiscipline } from "@/lib/programs/types";
import type { ExperienceLevel } from "@/lib/supabase/types";

// ---- static option data ----

const GOAL_OPTIONS: { value: TrainingGoal; label: string; comingSoon?: boolean }[] = [
  { value: "get_stronger", label: "Get stronger" },
  { value: "build_muscle_hypertrophy", label: "Build muscle — general hypertrophy" },
  { value: "build_muscle_bodybuilding", label: "Build muscle — bodybuilding (weak-point focus)" },
  { value: "general_fitness", label: "General fitness" },
  { value: "lose_fat", label: "Lose fat" },
  { value: "run_general", label: "Run — general fitness" },
  { value: "run_5k", label: "Run — 5K" },
  { value: "run_10k", label: "Run — 10K" },
  { value: "run_half_marathon", label: "Run — half marathon" },
  { value: "run_marathon", label: "Run — marathon" },
  { value: "improve_conditioning", label: "Improve conditioning (non-running cardio)" },
  { value: "hybrid", label: "Hybrid — lifting + running" },
  { value: "powerlifting_peak", label: "Powerlifting meet peak" },
  { value: "power_athletic", label: "Power / athletic development" },
  { value: "sport_specific", label: "Sport-specific" },
];

const SPORT_GROUP_OPTIONS: { value: SportGroup; label: string }[] = [
  { value: "field_court_invasion", label: "Field/court invasion (soccer, basketball, hockey, rugby...)" },
  { value: "rotational_overhead", label: "Racquet / throwing (tennis, baseball, cricket, golf-adjacent)" },
  { value: "combat_striking", label: "Combat — striking (boxing, kickboxing, MMA)" },
  { value: "combat_grappling", label: "Combat — grappling (wrestling, BJJ, judo)" },
  { value: "swimming", label: "Swimming" },
  { value: "track_sprint_jump", label: "Track — sprints / jumps" },
  { value: "track_throws", label: "Track — throws" },
  { value: "endurance_other", label: "Endurance (cycling, rowing, triathlon...)" },
  { value: "golf", label: "Golf" },
  { value: "climbing", label: "Climbing" },
  { value: "skiing_snowboarding", label: "Skiing / snowboarding" },
  { value: "dance", label: "Dance" },
  { value: "hiking_hyrox", label: "Hiking / Hyrox" },
];

const SEASON_PHASE_OPTIONS: { value: SeasonPhase; label: string }[] = [
  { value: "off_season", label: "Off-season" },
  { value: "pre_season", label: "Pre-season" },
  { value: "in_season", label: "In-season" },
  { value: "post_season", label: "Post-season" },
];

const MAINTAINABLE_GOAL_OPTIONS = GOAL_OPTIONS.filter((g) =>
  (["get_stronger", "build_muscle_hypertrophy", "build_muscle_bodybuilding", "general_fitness", "lose_fat", "run_general", "run_5k", "run_10k", "run_half_marathon", "run_marathon"] as TrainingGoal[]).includes(
    g.value
  )
);

const RUN_GOALS: TrainingGoal[] = ["run_general", "run_5k", "run_10k", "run_half_marathon", "run_marathon"];

const LAGGING_MUSCLE_OPTIONS: MuscleGroup[] = ["chest", "back", "shoulders", "quadriceps", "hamstrings", "glutes", "calves", "core", "biceps", "triceps", "forearms"];

const RED_FLAG_LABELS: Record<keyof RedFlagScreen, string> = {
  radicularOrNumbnessSymptoms: "Numbness, tingling, or pain radiating down an arm or leg",
  unexplainedWeakness: "Unexplained weakness",
  nightPainThatWakesThem: "Pain that wakes you at night",
  jointLocksCatchesOrGivesWay: "A joint that locks, catches, or gives way",
  recentTraumaWithSwellingOrCantBearWeight: "Recent trauma with swelling, or you can't bear weight on it",
  postSurgicalWithinSixMonthsNoClearance: "Surgery within the last 6 months, without clearance to train",
  systemicSymptomsAlongsidePain: "Unexplained weight loss or fever alongside pain",
  bladderOrBowelChangeWithBackPain: "A change in bladder or bowel function alongside back pain",
  severeOrWorseningPain: "Pain that's severe, or has been getting worse despite rest",
  thumbBasePainAfterFall: "Thumb-base pain after a fall",
  ulnarWristClickingUnderLoad: "Clicking with pain on the pinky side of the wrist under load",
};

const GLOBAL_REFUSAL_LABELS: Record<keyof GlobalRefusalScreen, string> = {
  pregnantWithPelvicFloorSymptoms: "Pregnant, with pelvic floor symptoms",
  persistentWidespreadChronicPain: "Persistent, widespread, or chronic pain",
  returnToPlayUnder12Months: "Returning to play from a significant injury within the last 12 months",
  youthPrePuberty: "Pre-puberty (roughly under 13-14, or pre-peak-height-velocity)",
};

const LOWER_BACK_OPTIONS: { value: LowerBackPattern; label: string }[] = [
  { value: "flexion_intolerant", label: "Worse when bending forward" },
  { value: "extension_intolerant", label: "Worse when arching backward" },
  { value: "unsure", label: "Not sure" },
];

const KNEE_OPTIONS: { value: KneePresentation; label: string }[] = [
  { value: "anterior_patellar", label: "Front of the knee, under the kneecap" },
  { value: "meniscal_joint_line", label: "Along the joint line — catching or locking" },
  { value: "post_surgical_or_acl", label: "Post-surgery or ACL" },
  { value: "unsure", label: "Not sure" },
];

const HIP_OPTIONS: { value: HipPresentation; label: string }[] = [
  { value: "anterior_groin", label: "Front of the hip / groin" },
  { value: "lateral_glute", label: "Side of the hip / outer glute" },
  { value: "posterior_hamstring", label: "Back of the hip / upper hamstring" },
  { value: "unsure", label: "Not sure" },
];

function clearRedFlags(): RedFlagScreen {
  return {
    radicularOrNumbnessSymptoms: false,
    unexplainedWeakness: false,
    nightPainThatWakesThem: false,
    jointLocksCatchesOrGivesWay: false,
    recentTraumaWithSwellingOrCantBearWeight: false,
    postSurgicalWithinSixMonthsNoClearance: false,
    systemicSymptomsAlongsidePain: false,
    bladderOrBowelChangeWithBackPain: false,
    severeOrWorseningPain: false,
    thumbBasePainAfterFall: false,
    ulnarWristClickingUnderLoad: false,
  };
}

function clearGlobalRefusals(): GlobalRefusalScreen {
  return { pregnantWithPelvicFloorSymptoms: false, persistentWidespreadChronicPain: false, returnToPlayUnder12Months: false, youthPrePuberty: false };
}

function isRunGoalValue(goal: TrainingGoal): boolean {
  return RUN_GOALS.includes(goal);
}

// ---- small presentational helpers ----

function CheckboxRow({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-2.5 text-sm text-foreground">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 shrink-0 rounded border-border text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      />
      <span>{label}</span>
    </label>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5 sm:p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </div>
  );
}

// ---- main component ----

type Stage = "idle" | "generating" | "reviewing" | "creating";

interface GenerateResponse {
  name?: string;
  discipline?: ProgramDiscipline;
  weeks?: import("@/lib/programs/types").WeekRow[];
  warnings?: string[];
  recommendConsultation?: { reason: string } | null;
  error?: string;
  needsHumanReason?: string;
}

export function GenerateProgramForm({ userId }: { userId: string }) {
  const router = useRouter();

  const [goal, setGoal] = useState<TrainingGoal>("get_stronger");
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>("beginner");
  const [daysPerWeek, setDaysPerWeek] = useState(3);
  const [sessionLengthMinutes, setSessionLengthMinutes] = useState(60);
  const [equipmentAccess, setEquipmentAccess] = useState<EquipmentAccess>("full_gym");
  const [programLengthWeeks, setProgramLengthWeeks] = useState(8);

  const [age, setAge] = useState(30);
  const [bodyweightKg, setBodyweightKg] = useState("");
  const [sex, setSex] = useState<Sex>("prefer_not_to_say");
  const [recentLayoff, setRecentLayoff] = useState(false);

  const [redFlags, setRedFlags] = useState<RedFlagScreen>(clearRedFlags());
  const [globalRefusals, setGlobalRefusals] = useState<GlobalRefusalScreen>(clearGlobalRefusals());

  const [shoulder, setShoulder] = useState(false);
  const [wrist, setWrist] = useState(false);
  const [elbow, setElbow] = useState(false);
  const [lowerBackFlagged, setLowerBackFlagged] = useState(false);
  const [lowerBackPattern, setLowerBackPattern] = useState<LowerBackPattern>("unsure");
  const [kneeFlagged, setKneeFlagged] = useState(false);
  const [kneePresentation, setKneePresentation] = useState<KneePresentation>("unsure");
  const [hipFlagged, setHipFlagged] = useState(false);
  const [hipPresentation, setHipPresentation] = useState<HipPresentation>("unsure");

  const [laggingMuscleGroups, setLaggingMuscleGroups] = useState<MuscleGroup[]>([]);

  const [includeCardio, setIncludeCardio] = useState(false);

  const [currentWeeklyKm, setCurrentWeeklyKm] = useState(15);
  const [weeksAtCurrentVolume, setWeeksAtCurrentVolume] = useState(4);
  const [hasRunContinuouslyThirtyMinutes, setHasRunContinuouslyThirtyMinutes] = useState(true);

  const [hybridPriority, setHybridPriority] = useState<HybridPriority>("resistance_primary");
  const [hybridPrimaryGoal, setHybridPrimaryGoal] = useState<TrainingGoal>("get_stronger");
  const [hybridSecondaryGoal, setHybridSecondaryGoal] = useState<TrainingGoal>("run_general");

  const [meetDate, setMeetDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 12 * 7); // default to a defensible 12-week-out prep
    return d.toISOString().slice(0, 10);
  });
  const [isFirstMeet, setIsFirstMeet] = useState(true);

  const [coachedOnOlympicLifts, setCoachedOnOlympicLifts] = useState(false);

  const [sportGroup, setSportGroup] = useState<SportGroup>("field_court_invasion");
  const [seasonPhase, setSeasonPhase] = useState<SeasonPhase>("off_season");
  const [practicesOrGamesPerWeek, setPracticesOrGamesPerWeek] = useState(3);
  const [position, setPosition] = useState("");
  const [sportInjuryInLast12Months, setSportInjuryInLast12Months] = useState(false);
  const [sportCurrentPain, setSportCurrentPain] = useState(false);
  const [canSquatToDepthPainFree, setCanSquatToDepthPainFree] = useState(true);
  const [canReachArmsOverheadAgainstWall, setCanReachArmsOverheadAgainstWall] = useState(true);
  const [currentlyCuttingWeight, setCurrentlyCuttingWeight] = useState(false);
  const [throwingSessionsPerWeek, setThrowingSessionsPerWeek] = useState("");

  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [needsHumanReason, setNeedsHumanReason] = useState<string | null>(null);
  const [reviewResult, setReviewResult] = useState<GenerateResponse | null>(null);

  const needsRunningHistory = isRunGoalValue(goal) || (goal === "hybrid" && (isRunGoalValue(hybridPrimaryGoal) || isRunGoalValue(hybridSecondaryGoal)));

  function toggleLaggingGroup(group: MuscleGroup, checked: boolean) {
    setLaggingMuscleGroups((prev) => (checked ? [...prev, group] : prev.filter((g) => g !== group)));
  }

  function buildInput(): ProgramGenerationInput {
    const injuries: InjuryProfile = {
      shoulder,
      wrist,
      elbow,
      lowerBack: lowerBackFlagged ? { pattern: lowerBackPattern } : null,
      knee: kneeFlagged ? { presentation: kneePresentation } : null,
      hip: hipFlagged ? { presentation: hipPresentation } : null,
    };

    return {
      goal,
      experienceLevel,
      daysPerWeek,
      sessionLengthMinutes,
      equipmentAccess,
      athlete: { age, bodyweightKg: bodyweightKg.trim() ? Number(bodyweightKg) : null, sex, recentLayoff },
      injuries,
      redFlags,
      globalRefusals,
      programLengthWeeks,
      powerlifting: goal === "powerlifting_peak" ? { meetDateISO: new Date(meetDate).toISOString(), isFirstMeet } : null,
      sport:
        goal === "sport_specific"
          ? {
              sportGroup,
              seasonPhase,
              practicesOrGamesPerWeek,
              position: position.trim() ? position.trim() : null,
              injuryInLast12Months: sportInjuryInLast12Months,
              currentPain: sportCurrentPain,
              canSquatToDepthPainFree,
              canReachArmsOverheadAgainstWall,
              currentlyCuttingWeight,
              throwingSessionsPerWeek: throwingSessionsPerWeek.trim() ? Number(throwingSessionsPerWeek) : null,
            }
          : null,
      hybrid: goal === "hybrid" ? { priority: hybridPriority, primaryGoal: hybridPrimaryGoal, secondaryGoal: hybridSecondaryGoal } : null,
      running: needsRunningHistory ? { currentWeeklyKm, weeksAtCurrentVolume, hasRunContinuouslyThirtyMinutes } : null,
      bodybuilding: goal === "build_muscle_bodybuilding" ? { laggingMuscleGroups } : null,
      conditioningModality: "no_preference",
      coachedOnOlympicLifts,
      includeCardio,
    };
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNeedsHumanReason(null);
    setReviewResult(null);
    setStage("generating");

    let data: GenerateResponse;
    try {
      const res = await fetch("/api/programs/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(buildInput()),
      });
      data = await res.json();
    } catch {
      setStage("idle");
      setError("Couldn't reach the server. Check your connection and try again.");
      return;
    }

    if (data.needsHumanReason) {
      setStage("idle");
      setNeedsHumanReason(data.needsHumanReason);
      return;
    }
    if (data.error || !data.weeks) {
      setStage("idle");
      setError(data.error ?? "Couldn't generate a program from these answers.");
      return;
    }

    setReviewResult(data);
    setStage("reviewing");
  }

  async function handleConfirmCreate() {
    if (!reviewResult?.weeks || !reviewResult.name || !reviewResult.discipline) return;
    setStage("creating");
    const supabase = createClient();
    const { program, error: createError } = await createProgramFromParsedProgram(supabase, {
      name: reviewResult.name,
      discipline: reviewResult.discipline,
      weeks: reviewResult.weeks,
      userId,
    });

    if (createError || !program) {
      setStage("reviewing");
      setError(createError ?? "The program was generated but couldn't be saved.");
      return;
    }

    // Best-effort: persist this questionnaire's InjuryProfile as the
    // athlete's standing profile (migration 0047), so Training Mode's Rule
    // 4 per-joint check has something durable to read later instead of it
    // evaporating with this form's local state. This form only ever
    // creates self-programmed programs (userId, no athleteId override —
    // see createProgramFromParsedProgram's own athleteId ?? userId
    // fallback), so the acting user is the athlete here. A failure here
    // shouldn't block navigation to the program that was already saved
    // successfully, matching how other auxiliary writes in this app (e.g.
    // training-session.tsx's readiness_downregulated event) are
    // fire-and-forget rather than user-blocking.
    void upsertAthleteInjuryProfile(supabase, { athleteId: userId, injuries: buildInput().injuries });

    router.push(`/programs/${program.id}/edit`);
  }

  if (needsHumanReason) {
    return (
      <div className="flex gap-3 rounded-2xl border border-danger/30 bg-danger/10 p-5 sm:p-6">
        <ShieldAlert className="mt-0.5 size-5 shrink-0 text-danger" />
        <div className="flex flex-col gap-2">
          <h2 className="text-base font-semibold text-foreground">This needs a real coach, not an automated plan</h2>
          <p className="text-sm text-foreground">{needsHumanReason}</p>
          <p className="text-sm text-muted-foreground">
            Nothing about adjusting the answers on this form would change that — please see a qualified coach or clinician before training.
          </p>
        </div>
      </div>
    );
  }

  if ((stage === "reviewing" || stage === "creating") && reviewResult) {
    const creating = stage === "creating";
    return (
      <div className="flex flex-col gap-4">
        <Section title={reviewResult.name ?? "Your program"} description={`${reviewResult.weeks?.length ?? 0} weeks — review before it's created.`}>
          {reviewResult.recommendConsultation && (
            <div className="flex gap-3 rounded-lg border border-danger/30 bg-danger/10 p-3">
              <ShieldAlert className="mt-0.5 size-4 shrink-0 text-danger" />
              <p className="text-sm text-foreground">{reviewResult.recommendConsultation.reason}</p>
            </div>
          )}
          {reviewResult.warnings && reviewResult.warnings.length > 0 && (
            <div className="flex flex-col gap-2">
              {reviewResult.warnings.map((w, i) => (
                <div key={i} className="flex gap-3 rounded-lg border border-border bg-surface-hover p-3">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <p className="text-sm text-foreground">{w}</p>
                </div>
              ))}
            </div>
          )}
          {error && (
            <div className="flex gap-3 rounded-lg border border-danger/30 bg-danger/10 p-3">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
              <p className="text-sm text-foreground">{error}</p>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={() => setStage("idle")} disabled={creating}>
              Back to edit answers
            </Button>
            <Button type="button" onClick={handleConfirmCreate} disabled={creating}>
              {creating ? "Creating program…" : "Create this program"}
            </Button>
          </div>
        </Section>
      </div>
    );
  }

  const submitting = stage === "generating";

  return (
    <form onSubmit={handleGenerate} className="flex flex-col gap-6">
      <Section title="Goal & schedule">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="goal">Goal</Label>
            <Select id="goal" value={goal} onChange={(e) => setGoal(e.target.value as TrainingGoal)}>
              {GOAL_OPTIONS.map((g) => (
                <option key={g.value} value={g.value} disabled={g.comingSoon}>
                  {g.label}
                  {g.comingSoon ? " (coming soon)" : ""}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="equipment">Equipment access</Label>
            <Select id="equipment" value={equipmentAccess} onChange={(e) => setEquipmentAccess(e.target.value as EquipmentAccess)}>
              <option value="full_gym">Full gym</option>
              <option value="home_gym">Home gym (barbell, dumbbells, bands)</option>
              <option value="minimal_equipment">Minimal equipment (dumbbells, bands, kettlebell)</option>
              <option value="bodyweight_only">Bodyweight only</option>
            </Select>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label>Experience level</Label>
          <SegmentedControl
            aria-label="Experience level"
            value={experienceLevel}
            onChange={setExperienceLevel}
            options={[
              { value: "beginner", label: "Beginner" },
              { value: "intermediate", label: "Intermediate" },
              { value: "advanced", label: "Advanced" },
            ]}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="daysPerWeek">Days per week</Label>
            <Input id="daysPerWeek" type="number" min={1} max={7} value={daysPerWeek} onChange={(e) => setDaysPerWeek(Number(e.target.value))} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="sessionLength">Session length (minutes)</Label>
            <Input id="sessionLength" type="number" min={15} max={180} value={sessionLengthMinutes} onChange={(e) => setSessionLengthMinutes(Number(e.target.value))} />
          </div>
          {goal !== "powerlifting_peak" && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="programLength">Program length (weeks)</Label>
              <Input id="programLength" type="number" min={1} max={52} value={programLengthWeeks} onChange={(e) => setProgramLengthWeeks(Number(e.target.value))} />
            </div>
          )}
        </div>
      </Section>

      {goal === "powerlifting_peak" && (
        <Section title="Meet details" description="Everything is timed backwards from this date — program length isn't asked for separately.">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="meetDate">Meet date</Label>
              <Input id="meetDate" type="date" value={meetDate} onChange={(e) => setMeetDate(e.target.value)} />
            </div>
          </div>
          <CheckboxRow id="firstMeet" label="This is my first meet" checked={isFirstMeet} onChange={setIsFirstMeet} />
        </Section>
      )}

      <Section title="About you">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="age">Age</Label>
            <Input id="age" type="number" min={13} max={100} value={age} onChange={(e) => setAge(Number(e.target.value))} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="bodyweight">Bodyweight (kg, optional)</Label>
            <Input id="bodyweight" type="number" min={0} value={bodyweightKg} onChange={(e) => setBodyweightKg(e.target.value)} placeholder="Optional" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="sex">Sex</Label>
            <Select id="sex" value={sex} onChange={(e) => setSex(e.target.value as Sex)}>
              <option value="prefer_not_to_say">Prefer not to say</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </Select>
          </div>
        </div>
        <CheckboxRow
          id="recentLayoff"
          label="I'm returning from a layoff of a week or more (this changes the ramp-in, not just the intensity)"
          checked={recentLayoff}
          onChange={setRecentLayoff}
        />
      </Section>

      {goal === "build_muscle_bodybuilding" && (
        <Section title="Lagging muscle groups" description="Whatever you pick gets trained first in the session, more often, and closer to failure.">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
            {LAGGING_MUSCLE_OPTIONS.map((group) => (
              <CheckboxRow
                key={group}
                id={`lagging-${group}`}
                label={group.replace(/_/g, " ")}
                checked={laggingMuscleGroups.includes(group)}
                onChange={(checked) => toggleLaggingGroup(group, checked)}
              />
            ))}
          </div>
        </Section>
      )}

      {(goal === "general_fitness" || goal === "lose_fat") && (
        <Section title="Cardio" description="Optional — 2 easy cardio sessions on top of your lifting days. Included, not developed; pick Conditioning or Hybrid if cardio itself is the priority.">
          <CheckboxRow id="includeCardio" label="Include cardio sessions in this program" checked={includeCardio} onChange={setIncludeCardio} />
        </Section>
      )}

      {goal === "hybrid" && (
        <Section title="Hybrid priority" description="The secondary goal is maintained, not developed — pick which discipline wins.">
          <div className="flex flex-col gap-2">
            <Label>Priority</Label>
            <SegmentedControl
              aria-label="Hybrid priority"
              value={hybridPriority}
              onChange={setHybridPriority}
              options={[
                { value: "resistance_primary", label: "Lifting primary" },
                { value: "endurance_primary", label: "Running primary" },
              ]}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="hybridPrimary">Primary goal</Label>
              <Select id="hybridPrimary" value={hybridPrimaryGoal} onChange={(e) => setHybridPrimaryGoal(e.target.value as TrainingGoal)}>
                {MAINTAINABLE_GOAL_OPTIONS.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="hybridSecondary">Secondary (maintained) goal</Label>
              <Select id="hybridSecondary" value={hybridSecondaryGoal} onChange={(e) => setHybridSecondaryGoal(e.target.value as TrainingGoal)}>
                {MAINTAINABLE_GOAL_OPTIONS.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </Section>
      )}

      {goal === "sport_specific" && (
        <Section
          title="Sport profile"
          description="This builds general athletic development with a sport emphasis, not a program specific to your sport — season phase matters more than the sport itself."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="sportGroup">Sport</Label>
              <Select id="sportGroup" value={sportGroup} onChange={(e) => setSportGroup(e.target.value as SportGroup)}>
                {SPORT_GROUP_OPTIONS.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="seasonPhase">Season phase</Label>
              <Select id="seasonPhase" value={seasonPhase} onChange={(e) => setSeasonPhase(e.target.value as SeasonPhase)}>
                {SEASON_PHASE_OPTIONS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="practicesPerWeek">Practices / games per week</Label>
              <Input
                id="practicesPerWeek"
                type="number"
                min={0}
                max={14}
                value={practicesOrGamesPerWeek}
                onChange={(e) => setPracticesOrGamesPerWeek(Number(e.target.value))}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="position">Position / role (optional)</Label>
              <Input id="position" value={position} onChange={(e) => setPosition(e.target.value)} placeholder="e.g. forward, pitcher" />
            </div>
          </div>

          <CheckboxRow id="sportInjury12mo" label="Injury in the last 12 months" checked={sportInjuryInLast12Months} onChange={setSportInjuryInLast12Months} />
          <CheckboxRow id="sportCurrentPain" label="Current pain" checked={sportCurrentPain} onChange={setSportCurrentPain} />
          <CheckboxRow
            id="squatDepth"
            label="I can squat to depth pain-free"
            checked={canSquatToDepthPainFree}
            onChange={setCanSquatToDepthPainFree}
          />
          <CheckboxRow
            id="overheadWall"
            label="I can reach my arms overhead against a wall pain-free"
            checked={canReachArmsOverheadAgainstWall}
            onChange={setCanReachArmsOverheadAgainstWall}
          />
          <CheckboxRow
            id="cuttingWeight"
            label="I'm currently cutting weight for competition"
            checked={currentlyCuttingWeight}
            onChange={setCurrentlyCuttingWeight}
          />

          {sportGroup === "rotational_overhead" && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="throwingSessions">Throwing/bowling sessions per week (baseball, softball, cricket only — leave blank otherwise)</Label>
              <Input
                id="throwingSessions"
                type="number"
                min={0}
                max={14}
                value={throwingSessionsPerWeek}
                onChange={(e) => setThrowingSessionsPerWeek(e.target.value)}
                placeholder="Leave blank if not applicable"
              />
            </div>
          )}
        </Section>
      )}

      {needsRunningHistory && (
        <Section title="Running history" description="A single big week doesn't establish a base — both fields matter.">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="weeklyKm">Current weekly volume (km)</Label>
              <Input id="weeklyKm" type="number" min={0} value={currentWeeklyKm} onChange={(e) => setCurrentWeeklyKm(Number(e.target.value))} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="weeksAtVolume">Weeks at that volume</Label>
              <Input id="weeksAtVolume" type="number" min={0} value={weeksAtCurrentVolume} onChange={(e) => setWeeksAtCurrentVolume(Number(e.target.value))} />
            </div>
          </div>
          <CheckboxRow
            id="canRun30"
            label="I can already run continuously for 30 minutes"
            checked={hasRunContinuouslyThirtyMinutes}
            onChange={setHasRunContinuouslyThirtyMinutes}
          />
        </Section>
      )}

      <Section title="Injuries" description="Same complaint, opposite fix depending on presentation — this is why each one asks a follow-up.">
        <CheckboxRow id="injury-shoulder" label="Shoulder" checked={shoulder} onChange={setShoulder} />
        <CheckboxRow id="injury-wrist" label="Wrist" checked={wrist} onChange={setWrist} />
        <CheckboxRow id="injury-elbow" label="Elbow" checked={elbow} onChange={setElbow} />

        <CheckboxRow id="injury-lowerback" label="Lower back" checked={lowerBackFlagged} onChange={setLowerBackFlagged} />
        {lowerBackFlagged && (
          <Select className="ml-6 w-fit" value={lowerBackPattern} onChange={(e) => setLowerBackPattern(e.target.value as LowerBackPattern)}>
            {LOWER_BACK_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        )}

        <CheckboxRow id="injury-knee" label="Knee" checked={kneeFlagged} onChange={setKneeFlagged} />
        {kneeFlagged && (
          <Select className="ml-6 w-fit" value={kneePresentation} onChange={(e) => setKneePresentation(e.target.value as KneePresentation)}>
            {KNEE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        )}

        <CheckboxRow id="injury-hip" label="Hip" checked={hipFlagged} onChange={setHipFlagged} />
        {hipFlagged && (
          <Select className="ml-6 w-fit" value={hipPresentation} onChange={(e) => setHipPresentation(e.target.value as HipPresentation)}>
            {HIP_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        )}
      </Section>

      <Section title="Safety screen" description="Any one of these stops automated generation entirely — a real coach or clinician needs to be involved instead.">
        <div className="flex flex-col gap-2">
          {(Object.keys(RED_FLAG_LABELS) as (keyof RedFlagScreen)[]).map((key) => (
            <CheckboxRow
              key={key}
              id={`redflag-${key}`}
              label={RED_FLAG_LABELS[key]}
              checked={redFlags[key]}
              onChange={(checked) => setRedFlags((prev) => ({ ...prev, [key]: checked }))}
            />
          ))}
          {(Object.keys(GLOBAL_REFUSAL_LABELS) as (keyof GlobalRefusalScreen)[]).map((key) => (
            <CheckboxRow
              key={key}
              id={`refusal-${key}`}
              label={GLOBAL_REFUSAL_LABELS[key]}
              checked={globalRefusals[key]}
              onChange={(checked) => setGlobalRefusals((prev) => ({ ...prev, [key]: checked }))}
            />
          ))}
        </div>
      </Section>

      <Section title="Olympic lifts" description="Hang clean, power clean, and similar lifts are opt-in only — they stay out of the plan unless you confirm you've been coached on them.">
        <CheckboxRow id="coached" label="I've been coached on Olympic lift technique" checked={coachedOnOlympicLifts} onChange={setCoachedOnOlympicLifts} />
      </Section>

      {error && (
        <div className="flex gap-3 rounded-lg border border-danger/30 bg-danger/10 p-4">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
          <p className="text-sm text-foreground">{error}</p>
        </div>
      )}

      <div className="flex justify-end">
        <Button type="submit" size="lg" disabled={submitting || GOAL_OPTIONS.find((g) => g.value === goal)?.comingSoon}>
          {submitting ? "Generating program…" : "Generate program"}
        </Button>
      </div>
    </form>
  );
}
