import { FOCUS_LABELS, GOAL_LABELS, type GeneratedWorkout } from "./generate-workout";

/**
 * Deterministic, template-based explanation of why a generated workout
 * looks the way it does. No AI here on purpose — the selection logic is
 * rule-based and explainable, so the explanation just needs to state the
 * rules that actually ran, matching the transparency the rest of the site
 * uses instead of presenting the output as a black box.
 */
export function explainWorkout(workout: GeneratedWorkout): string {
  const goalLabel = GOAL_LABELS[workout.goal].toLowerCase();
  const focusLabel = FOCUS_LABELS[workout.focus].toLowerCase();
  const compound = workout.exercises.find((we) => we.exercise.isCompound);

  const base = compound
    ? `This is a ${focusLabel} session built around ${goalLabel}: compound movements like ${compound.exercise.name.toLowerCase()} are prioritized first, using ${compound.sets} sets of ${compound.reps} reps with ${compound.restSeconds}s rest — the set, rep, and rest combination generally associated with ${goalLabel} adaptations.`
    : `This is a ${focusLabel} session built around ${goalLabel}.`;

  const overBudget = workout.estimatedMinutes > workout.requestedMinutes * 1.15;
  const timingNote = overBudget
    ? ` Heads up: ${goalLabel} work needs longer rest periods to be effective, so this session will likely run closer to ${workout.estimatedMinutes} minutes than the ${workout.requestedMinutes} you asked for — cutting rest short would undercut the goal you picked.`
    : ` Estimated total time is about ${workout.estimatedMinutes} minutes, close to your ${workout.requestedMinutes}-minute target.`;

  return base + timingNote;
}
