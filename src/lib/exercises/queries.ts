import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Exercise,
  ExerciseCoachingCue,
  ExerciseCommonMistake,
  ExerciseDetail,
  ExerciseFilters,
  ExerciseHistoryForAthlete,
  ExerciseRelationship,
  ExerciseUsageStats,
  RelatedExercise,
} from "@/lib/exercises/types";
import { prescriptionCategoryToLibraryCategories } from "@/lib/exercises/constants";
import type { ExerciseCategory } from "@/lib/programs/types";
import type { ExerciseSearchResult } from "@/lib/programs/exercise-search";

function groupBy<T, K>(items: T[], key: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const arr = map.get(k);
    if (arr) arr.push(item);
    else map.set(k, [item]);
  }
  return map;
}

/**
 * Every exercise referenced by a set of block_exercises rows, keyed by id —
 * the flat lookup that lets getProgramTree/getTrainingDayForTraining attach
 * a live `exercise_name` onto each BlockExerciseRow (see those files'
 * comments) without breaking getExerciseDisplayName's synchronous contract.
 * Same flat-query-and-stitch shape as every other level of the program
 * tree, deliberately not a PostgREST embedded select (see queries.ts's
 * header comment on why this codebase avoids that at depth).
 */
export async function getExerciseNamesByIds(supabase: SupabaseClient, ids: string[]): Promise<Map<string, string>> {
  const uniqueIds = Array.from(new Set(ids.filter((id): id is string => !!id)));
  if (uniqueIds.length === 0) return new Map();

  const { data } = await supabase.from("exercises").select("id, name").in("id", uniqueIds);
  return new Map(((data ?? []) as { id: string; name: string }[]).map((r) => [r.id, r.name]));
}

/** Full-text/filtered browse for the Exercise Library list page. */
export async function listExercises(supabase: SupabaseClient, filters: ExerciseFilters = {}): Promise<Exercise[]> {
  let query = supabase.from("exercises").select("*");

  if (!filters.includeArchived) query = query.eq("is_archived", false);
  if (filters.category) query = query.eq("category", filters.category);
  if (filters.equipment) query = query.eq("equipment", filters.equipment);
  if (filters.primaryMuscleGroup) query = query.eq("primary_muscle_group", filters.primaryMuscleGroup);
  if (filters.movementPattern) query = query.eq("movement_pattern", filters.movementPattern);
  if (filters.difficulty) query = query.eq("difficulty", filters.difficulty);

  const trimmed = filters.search?.trim();
  if (trimmed) {
    query = query.textSearch("search_vector", trimmed, { type: "websearch", config: "english" });
  } else {
    query = query.order("name", { ascending: true });
  }

  const { data, error } = await query.limit(500);
  if (error || !data) return [];
  return data as Exercise[];
}

export async function getExerciseById(supabase: SupabaseClient, id: string): Promise<Exercise | null> {
  const { data } = await supabase.from("exercises").select("*").eq("id", id).maybeSingle<Exercise>();
  return data ?? null;
}

function toRelated(rows: { related_exercise_id: string; position: number }[], namesById: Map<string, Exercise>): RelatedExercise[] {
  return rows
    .sort((a, b) => a.position - b.position)
    .map((r) => namesById.get(r.related_exercise_id))
    .filter((e): e is Exercise => !!e)
    .map((e) => ({ id: e.id, name: e.name, difficulty: e.difficulty }));
}

/**
 * Everything the Exercise Detail page renders: the exercise row plus its
 * coaching cues, common mistakes, and progression/regression/variation
 * chains resolved to real names (a link needs a name, not just an id).
 * Variations are stored as a single undirected row (0035's header comment)
 * so they're read from both sides of `exercise_id`/`related_exercise_id`.
 */
export async function getExerciseDetail(supabase: SupabaseClient, id: string): Promise<ExerciseDetail | null> {
  const exercise = await getExerciseById(supabase, id);
  if (!exercise) return null;

  const [cuesResult, mistakesResult, relResult, variationInverseResult] = await Promise.all([
    supabase.from("exercise_coaching_cues").select("*").eq("exercise_id", id).order("position", { ascending: true }),
    supabase.from("exercise_common_mistakes").select("*").eq("exercise_id", id).order("position", { ascending: true }),
    supabase.from("exercise_relationships").select("*").eq("exercise_id", id),
    supabase.from("exercise_relationships").select("*").eq("related_exercise_id", id).eq("relationship_type", "variation"),
  ]);

  const relationships = [...((relResult.data ?? []) as ExerciseRelationship[])];
  // Variations stored with this exercise on the *related* side still count
  // as this exercise's variations — fold them in as if they pointed the
  // other way, so the detail page doesn't have to know about storage
  // direction.
  for (const row of (variationInverseResult.data ?? []) as ExerciseRelationship[]) {
    relationships.push({ ...row, related_exercise_id: row.exercise_id });
  }

  const relatedIds = Array.from(new Set(relationships.map((r) => r.related_exercise_id)));
  const relatedExercises = relatedIds.length
    ? ((await supabase.from("exercises").select("*").in("id", relatedIds)).data as Exercise[] | null) ?? []
    : [];
  const relatedById = new Map(relatedExercises.map((e) => [e.id, e]));

  return {
    ...exercise,
    coachingCues: (cuesResult.data ?? []) as ExerciseCoachingCue[],
    commonMistakes: (mistakesResult.data ?? []) as ExerciseCommonMistake[],
    progressions: toRelated(relationships.filter((r) => r.relationship_type === "progression"), relatedById),
    regressions: toRelated(relationships.filter((r) => r.relationship_type === "regression"), relatedById),
    variations: toRelated(relationships.filter((r) => r.relationship_type === "variation"), relatedById),
  };
}

/**
 * DB-backed results for the Program Builder's exercise picker
 * (ExerciseSearchField's optional `librarySearch` prop) — searches the
 * shared Exercise Library rather than the static in-code lists. Scoped by
 * the block's own prescription category via
 * prescriptionCategoryToLibraryCategories, so a "strength" block also
 * surfaces mobility/stretching/plyometric/olympic-lift exercises (they all
 * prescribe sets x reps the same way) while a "running"/"cardio" block only
 * sees its own category.
 */
export async function searchExerciseLibraryForPicker(
  supabase: SupabaseClient,
  params: { query: string; blockCategory: ExerciseCategory; limit?: number }
): Promise<ExerciseSearchResult[]> {
  const libraryCategories = prescriptionCategoryToLibraryCategories(params.blockCategory);
  let query = supabase.from("exercises").select("id, name").eq("is_archived", false).in("category", libraryCategories);

  const trimmed = params.query.trim();
  if (trimmed) {
    query = query.textSearch("search_vector", trimmed, { type: "websearch", config: "english" });
  } else {
    query = query.order("name", { ascending: true });
  }

  const { data, error } = await query.limit(params.limit ?? 50);
  if (error || !data) return [];
  return (data as { id: string; name: string }[]).map((row) => ({
    id: row.id,
    name: row.name,
    category: params.blockCategory,
  }));
}

/** "Used in N Programs, Completed N Times, Used by N Coaches" (spec) —
 * always computed live, never cached, so it can never drift. */
export async function getExerciseUsageStats(supabase: SupabaseClient, exerciseId: string): Promise<ExerciseUsageStats> {
  const { data: blockExerciseRows } = await supabase
    .from("block_exercises")
    .select("id, block_id, exercise_blocks!inner(day_id, training_days!inner(week_id, program_weeks!inner(program_id, programs!inner(owner_id))))")
    .eq("exercise_id", exerciseId);

  // The nested embed above is only used here (a single stats rollup, not
  // part of the program tree's own render path) so it doesn't fight with
  // that file's flat-fetch-and-stitch convention — see queries.ts's header
  // comment for why that convention exists for the tree itself.
  type Row = { exercise_blocks: { training_days: { program_weeks: { program_id: string; programs: { owner_id: string } } } } };
  const rows = (blockExerciseRows ?? []) as unknown as Row[];
  const blockExerciseIds = ((blockExerciseRows ?? []) as { id: string }[]).map((r) => r.id);

  const programIds = new Set(rows.map((r) => r.exercise_blocks.training_days.program_weeks.program_id));
  const coachIds = new Set(rows.map((r) => r.exercise_blocks.training_days.program_weeks.programs.owner_id));

  let completedCount = 0;
  if (blockExerciseIds.length > 0) {
    const { count } = await supabase
      .from("logged_sets")
      .select("id", { count: "exact", head: true })
      .in("block_exercise_id", blockExerciseIds);
    completedCount = count ?? 0;
  }

  return { programCount: programIds.size, completedCount, coachCount: coachIds.size };
}

/**
 * A coach's view of how a specific athlete has performed this exercise —
 * "Last Performed, Previous Loads, Estimated 1RM, Recent Notes" (spec),
 * to help make programming decisions. Matched by exercise identity
 * (exercise_id), same convention as getPreviousPerformanceForExercises in
 * lib/training/queries.ts.
 */
export async function getExerciseHistoryForAthlete(
  supabase: SupabaseClient,
  athleteId: string,
  exerciseId: string
): Promise<ExerciseHistoryForAthlete> {
  const { data: matchedBlockExercises } = await supabase.from("block_exercises").select("id").eq("exercise_id", exerciseId);
  const blockExerciseIds = ((matchedBlockExercises ?? []) as { id: string }[]).map((r) => r.id);

  if (blockExerciseIds.length === 0) return { lastPerformed: null, estimated1RM: null, recentEntries: [] };

  const { data: loggedSetsData } = await supabase
    .from("logged_sets")
    .select("*, session_logs!inner(performed_on, athlete_id)")
    .in("block_exercise_id", blockExerciseIds)
    .eq("session_logs.athlete_id", athleteId)
    .order("created_at", { ascending: false })
    .limit(200);

  type Row = {
    session_log_id: string;
    block_exercise_id: string;
    performed_weight: number | null;
    performed_reps: number | null;
    performed_rpe: number | null;
    // Exercise-level notes ("Left shoulder felt tight") are their own
    // notes-only logged_sets row rather than a field on block_exercises —
    // see the comment in lib/training/mutations.ts's finishSession.
    notes: string | null;
    session_logs: { performed_on: string };
  };
  const rows = (loggedSetsData ?? []) as unknown as Row[];

  const bySession = groupBy(rows, (r) => r.session_log_id);
  const entries = Array.from(bySession.values())
    .map((sessionRows) => {
      const first = sessionRows[0]!;
      const realSets = sessionRows.filter((r) => r.performed_weight != null || r.performed_reps != null);
      return {
        performedOn: first.session_logs.performed_on,
        sets: realSets.map((r) => ({ weight: r.performed_weight, reps: r.performed_reps, rpe: r.performed_rpe })),
        notes: sessionRows.find((r) => r.notes?.trim())?.notes ?? null,
      };
    })
    .sort((a, b) => (a.performedOn < b.performedOn ? 1 : -1))
    .slice(0, 10);

  let estimated1RM: number | null = null;
  for (const row of rows) {
    if (row.performed_weight == null || row.performed_reps == null || row.performed_reps === 0) continue;
    // Epley formula — same estimate used for 1RM personal records elsewhere
    // in the app.
    const estimate = row.performed_reps === 1 ? row.performed_weight : row.performed_weight * (1 + row.performed_reps / 30);
    if (estimated1RM === null || estimate > estimated1RM) estimated1RM = estimate;
  }

  return {
    lastPerformed: entries[0]?.performedOn ?? null,
    estimated1RM: estimated1RM !== null ? Math.round(estimated1RM * 10) / 10 : null,
    recentEntries: entries,
  };
}
