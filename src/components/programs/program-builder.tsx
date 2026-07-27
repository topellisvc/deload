"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Plus, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type {
  BlockExerciseRow,
  BlockRole,
  BlockRow,
  DayRow,
  DayTemplateRow,
  ExerciseCategory,
  ExerciseTemplateRow,
  PrescriptionType,
  ProgramDiscipline,
  ProgramTree,
  SetRow,
  WeekRow,
} from "@/lib/programs/types";
import { defaultCategoryForDiscipline, defaultPrescriptionType } from "@/lib/programs/prescription-types";
import { DISCIPLINE_META } from "@/lib/programs/discipline-meta";
import * as m from "@/lib/programs/mutations";
import { getExerciseLibrary, addToExerciseLibrary } from "@/lib/programs/exercise-library";
import { getExerciseTemplates } from "@/lib/programs/exercise-templates";
import { getDayTemplates } from "@/lib/programs/day-templates";
import type { ExerciseSearchResult } from "@/lib/programs/exercise-search";
import { useBuilderMode, type BuilderMode } from "@/lib/programs/use-builder-mode";
import { DayColumn } from "@/components/programs/day-column";
import { AthletePreviewDay } from "@/components/programs/athlete-preview";
import { AddWeekDialog } from "@/components/programs/add-week-dialog";
import { SaveExerciseTemplateDialog } from "@/components/programs/save-exercise-template-dialog";
import { SaveDayTemplateDialog } from "@/components/programs/save-day-template-dialog";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ScrollFadeX } from "@/components/ui/scroll-fade-x";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { cn } from "@/lib/utils";

const BUILDER_MODE_OPTIONS: { value: BuilderMode; label: string }[] = [
  { value: "simple", label: "Simple" },
  { value: "advanced", label: "Advanced" },
  { value: "preview", label: "Preview" },
];

/** One shared confirm dialog for this whole builder rather than a
 * separate open/target state per confirmable action (delete program,
 * delete week, switch category — each with a different message and a
 * different thing to actually do on confirm) — simplest way to replace
 * window.confirm() at three unrelated call sites without three near-copies
 * of the same open/close/submitting plumbing. */
interface PendingConfirm {
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void | Promise<void>;
}

const DISCIPLINE_OPTIONS: { value: ProgramDiscipline; label: string; activeClassName: string }[] = (
  Object.keys(DISCIPLINE_META) as ProgramDiscipline[]
).map((value) => ({ value, label: DISCIPLINE_META[value].label, activeClassName: DISCIPLINE_META[value].activeClassName }));

/**
 * Every position column in the program tree (program_weeks, training_days,
 * exercise_blocks, block_exercises, set_prescriptions) has a `unique
 * (parent_id, position)` constraint. Deleting an item never renumbers its
 * siblings — a week/block/exercise/set gets removed, but whatever came
 * after it keeps its original position — so `items.length` (a count) can
 * end up lower than the highest position actually still in use. Basing a
 * new item's position on the real max instead of the count is what keeps
 * "add" from ever proposing a position that's already taken (confirmed
 * live: `items.length + 1` collided with a leftover position and threw
 * "duplicate key value violates unique constraint" after a mid-list delete).
 */
function nextPosition(items: { position: number }[]): number {
  return items.reduce((max, item) => Math.max(max, item.position), 0) + 1;
}

interface ProgramBuilderProps {
  initialProgram: ProgramTree;
}

/**
 * Owns the whole program tree as local state and applies every edit
 * optimistically: the UI updates immediately, and the matching Supabase
 * write fires in the background. If a write fails, we surface a banner
 * rather than silently losing the edit or blocking the UI on every
 * keystroke — full rollback isn't implemented for v1, since with RLS
 * already enforcing access and the network being the main realistic
 * failure mode, a visible retry-or-refresh prompt is enough for now.
 */
export function ProgramBuilder({ initialProgram }: ProgramBuilderProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [program, setProgram] = useState(initialProgram);
  const [selectedWeekId, setSelectedWeekId] = useState(initialProgram.weeks[0]?.id ?? "");
  const [addWeekOpen, setAddWeekOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState(initialProgram.name);
  const [deleting, setDeleting] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);
  // "Make this a superset" needs a server-generated exercise id before it
  // can update local state (unlike most other edits here, which apply
  // optimistically first) — so the click has a real network round-trip
  // with no visible effect until it resolves. Tracked per-block so the
  // button can disable itself and say so instead of silently doing
  // nothing, and so a second click during that window can't fire a
  // duplicate insert (confirmed live: clicking twice in quick succession
  // read as "the first click didn't register" when actually the request
  // just hadn't resolved yet).
  const [addingExerciseBlockId, setAddingExerciseBlockId] = useState<string | null>(null);
  const [mode, setMode] = useBuilderMode();
  // The coach's own saved custom exercises (migration 0031) — fetched once
  // on mount, not per-keystroke of every search box on the page (see
  // exercise-search.ts's own doc comment). `program.owner_id` is safe to
  // use as the library's owner here specifically because this component
  // only ever renders for the program's owner — the edit page redirects
  // anyone else back to the read-only view before ProgramBuilder mounts.
  const [library, setLibrary] = useState<ExerciseSearchResult[]>([]);
  // Saved exercise/day templates (migration 0033) — fetched once alongside
  // the exercise library, same reasoning: one small per-owner list, not
  // worth a live query per render. `onSaved` on each save dialog appends
  // straight into this state so a freshly-saved template appears in every
  // "insert template" control immediately, no refetch.
  const [exerciseTemplates, setExerciseTemplates] = useState<ExerciseTemplateRow[]>([]);
  const [dayTemplates, setDayTemplates] = useState<DayTemplateRow[]>([]);
  // Which exercise/day the "Save as template" dialog is currently open
  // for — null means closed. Holding the actual row (not just an id) is
  // simplest here since the dialog needs the live BlockExerciseRow/DayRow
  // to snapshot, and the caller already has it in hand at the moment the
  // action is triggered.
  const [saveExerciseTemplateFor, setSaveExerciseTemplateFor] = useState<BlockExerciseRow | null>(null);
  const [saveDayTemplateFor, setSaveDayTemplateFor] = useState<DayRow | null>(null);

  useEffect(() => setNameDraft(program.name), [program.name]);

  useEffect(() => {
    let cancelled = false;
    getExerciseLibrary(supabase, program.owner_id).then((entries) => {
      if (!cancelled) setLibrary(entries.map((e) => ({ id: null, name: e.name, category: e.category })));
    });
    getExerciseTemplates(supabase, program.owner_id).then((templates) => {
      if (!cancelled) setExerciseTemplates(templates);
    });
    getDayTemplates(supabase, program.owner_id).then((templates) => {
      if (!cancelled) setDayTemplates(templates);
    });
    return () => {
      cancelled = true;
    };
  }, [supabase, program.owner_id]);

  // Every program is created with a first week and never allowed to drop
  // below one (handleDeleteWeek blocks removing the last week), so this is
  // safe. Asserted non-null rather than narrowed by an `if` guard because
  // the handlers below are hoisted function declarations — control-flow
  // narrowing from a guard here wouldn't carry into their bodies, but the
  // variable's actual type does.
  const week = (program.weeks.find((w) => w.id === selectedWeekId) ?? program.weeks[0])!;

  function fail(message: string) {
    setSaveError(message);
  }

  // ---- immutable tree-update helpers ----
  function updateWeek(weekId: string, updater: (w: WeekRow) => WeekRow) {
    setProgram((p) => ({ ...p, weeks: p.weeks.map((w) => (w.id === weekId ? updater(w) : w)) }));
  }
  function updateDay(weekId: string, dayId: string, updater: (d: DayRow) => DayRow) {
    updateWeek(weekId, (w) => ({ ...w, days: w.days.map((d) => (d.id === dayId ? updater(d) : d)) }));
  }
  function updateBlock(weekId: string, dayId: string, blockId: string, updater: (b: BlockRow) => BlockRow) {
    updateDay(weekId, dayId, (d) => ({ ...d, blocks: d.blocks.map((b) => (b.id === blockId ? updater(b) : b)) }));
  }

  // ---- program-level ----
  async function commitName() {
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === program.name) {
      setNameDraft(program.name);
      return;
    }
    setProgram((p) => ({ ...p, name: trimmed }));
    const { error } = await m.updateProgram(supabase, program.id, { name: trimmed });
    if (error) fail(error);
  }

  async function handleDisciplineChange(discipline: ProgramDiscipline) {
    setProgram((p) => ({ ...p, discipline }));
    const { error } = await m.updateProgram(supabase, program.id, { discipline });
    if (error) fail(error);
  }

  function handleDeleteProgram() {
    setPendingConfirm({
      title: "Delete program?",
      description: `Delete "${program.name}"? This can't be undone.`,
      confirmLabel: "Delete",
      onConfirm: async () => {
        setDeleting(true);
        const { error } = await m.deleteProgram(supabase, program.id);
        setPendingConfirm(null);
        if (error) {
          setDeleting(false);
          fail(error);
          return;
        }
        router.push("/programs");
      },
    });
  }

  // ---- weeks ----
  async function handleAddWeek(params: { sourceWeek?: WeekRow; progressionPercent?: number }): Promise<string | null> {
    const lastWeek = program.weeks[program.weeks.length - 1];
    if (!lastWeek) return "This program has no weeks yet.";
    const dayTemplate = lastWeek.days.map((d) => ({ label: d.label, is_rest_day: d.is_rest_day }));
    const { week: newWeek, error } = await m.addWeek(supabase, {
      programId: program.id,
      position: nextPosition(program.weeks),
      dayTemplate,
      sourceWeek: params.sourceWeek,
      progressionPercent: params.progressionPercent,
    });
    if (error || !newWeek) return error ?? "Something went wrong adding the week.";
    setProgram((p) => ({ ...p, weeks: [...p.weeks, newWeek] }));
    setSelectedWeekId(newWeek.id);
    return null;
  }

  function handleDeleteWeek(weekId: string) {
    if (program.weeks.length <= 1) return;
    const target = program.weeks.find((w) => w.id === weekId);
    if (!target) return;
    setPendingConfirm({
      title: "Delete week?",
      description: `Delete ${target.label || `Week ${target.position}`}? This can't be undone.`,
      confirmLabel: "Delete",
      onConfirm: async () => {
        const remaining = program.weeks.filter((w) => w.id !== weekId);
        setProgram((p) => ({ ...p, weeks: remaining }));
        if (selectedWeekId === weekId) setSelectedWeekId(remaining[0]?.id ?? "");
        setPendingConfirm(null);
        const { error } = await m.deleteWeek(supabase, weekId);
        if (error) fail(error);
      },
    });
  }

  // ---- days ----
  function handleUpdateDay(dayId: string, patch: { label?: string | null; is_rest_day?: boolean }) {
    updateDay(week.id, dayId, (d) => ({ ...d, ...patch }));
    m.updateDay(supabase, dayId, patch).then(({ error }) => {
      if (error) fail(error);
    });
  }

  async function handleCopyDayTo(sourceDay: DayRow, targetDayId: string) {
    const targetDay = week.days.find((d) => d.id === targetDayId);
    if (!targetDay) return;
    const { blocks, error } = await m.copyDayContents(supabase, {
      sourceDay,
      targetDayId,
      targetDayBlocks: targetDay.blocks,
    });
    if (error) {
      fail(error);
      return;
    }
    updateDay(week.id, targetDayId, (d) => ({ ...d, blocks: [...d.blocks, ...blocks] }));
  }

  function handleOpenSaveDayTemplate(dayId: string) {
    const day = week.days.find((d) => d.id === dayId);
    if (day) setSaveDayTemplateFor(day);
  }

  async function handleInsertDayTemplate(dayId: string, template: DayTemplateRow) {
    const targetDay = week.days.find((d) => d.id === dayId);
    if (!targetDay) return;
    const { blocks, error } = await m.insertDayTemplate(supabase, {
      targetDayId: dayId,
      targetDayBlocks: targetDay.blocks,
      template,
    });
    if (error) {
      fail(error);
      return;
    }
    updateDay(week.id, dayId, (d) => ({ ...d, blocks: [...d.blocks, ...blocks] }));
  }

  // ---- blocks ----
  async function handleAddBlock(dayId: string, role: BlockRole = "main") {
    const day = week.days.find((d) => d.id === dayId);
    if (!day) return;
    const { block, error } = await m.addExerciseBlock(supabase, {
      dayId,
      position: nextPosition(day.blocks.filter((b) => b.block_role === role)),
      category: defaultCategoryForDiscipline(program.discipline),
      role,
    });
    if (error || !block) {
      fail(error ?? "Couldn't add exercise.");
      return;
    }
    updateDay(week.id, dayId, (d) => ({ ...d, blocks: [...d.blocks, block] }));
  }

  async function handleInsertExerciseTemplate(dayId: string, role: BlockRole, template: ExerciseTemplateRow) {
    const day = week.days.find((d) => d.id === dayId);
    if (!day) return;
    const { block, error } = await m.addExerciseBlockFromTemplate(supabase, {
      dayId,
      position: nextPosition(day.blocks.filter((b) => b.block_role === role)),
      role,
      template,
    });
    if (error || !block) {
      fail(error ?? "Couldn't insert that template.");
      return;
    }
    updateDay(week.id, dayId, (d) => ({ ...d, blocks: [...d.blocks, block] }));
  }

  function handleDeleteBlock(dayId: string, blockId: string) {
    updateDay(week.id, dayId, (d) => ({ ...d, blocks: d.blocks.filter((b) => b.id !== blockId) }));
    m.deleteBlock(supabase, blockId).then(({ error }) => {
      if (error) fail(error);
    });
  }

  // ---- superset/circuit grouping ----
  async function handleAddExerciseToBlock(dayId: string, blockId: string) {
    if (addingExerciseBlockId === blockId) return; // already in flight — see state comment above
    const day = week.days.find((d) => d.id === dayId);
    const block = day?.blocks.find((b) => b.id === blockId);
    if (!block) return;
    setAddingExerciseBlockId(blockId);
    // A superset pairing should default to matching whatever's already in
    // the block (e.g. pairing two strength accessories stays strength)
    // rather than the program's overall discipline — a hybrid program's
    // strength block shouldn't suddenly default its 2nd exercise to
    // "cardio" just because the program as a whole mixes both.
    const category = block.exercises[0]?.exercise_category ?? defaultCategoryForDiscipline(program.discipline);
    const { exercise, error } = await m.addExerciseToBlock(supabase, {
      blockId,
      position: nextPosition(block.exercises),
      category,
    });
    setAddingExerciseBlockId(null);
    if (error || !exercise) {
      fail(error ?? "Couldn't add exercise.");
      return;
    }
    const becomesGrouped = block.exercises.length + 1 === 2;
    updateBlock(week.id, dayId, blockId, (b) => ({
      ...b,
      exercises: [...b.exercises, exercise],
      block_type: becomesGrouped ? "superset" : b.block_type,
    }));
    if (becomesGrouped) {
      m.updateBlockType(supabase, blockId, "superset").then(({ error: e }) => {
        if (e) fail(e);
      });
    }
  }

  async function handleRemoveExerciseFromBlock(dayId: string, blockId: string, blockExerciseId: string) {
    const day = week.days.find((d) => d.id === dayId);
    const block = day?.blocks.find((b) => b.id === blockId);
    // Removing the block's only exercise should delete the whole block
    // instead (via the block's own delete button) — this button is
    // hidden in the UI until there are 2+ exercises, but guard here too.
    if (!block || block.exercises.length <= 1) return;
    const becomesUngrouped = block.exercises.length - 1 === 1;
    updateBlock(week.id, dayId, blockId, (b) => ({
      ...b,
      exercises: b.exercises.filter((ex) => ex.id !== blockExerciseId),
      block_type: becomesUngrouped ? "straight" : b.block_type,
    }));
    m.removeExerciseFromBlock(supabase, blockExerciseId).then(({ error }) => {
      if (error) fail(error);
    });
    if (becomesUngrouped) {
      m.updateBlockType(supabase, blockId, "straight").then(({ error }) => {
        if (error) fail(error);
      });
    }
  }

  function handleRoundsChange(dayId: string, blockId: string, rounds: number) {
    updateBlock(week.id, dayId, blockId, (b) => ({ ...b, rounds }));
    m.updateBlockRounds(supabase, blockId, rounds).then(({ error }) => {
      if (error) fail(error);
    });
  }

  // ---- exercise + sets ----
  function handleExerciseChange(
    dayId: string,
    blockId: string,
    blockExerciseId: string,
    patch: { exercise_id: string | null; custom_name: string | null }
  ) {
    updateBlock(week.id, dayId, blockId, (b) => ({
      ...b,
      exercises: b.exercises.map((ex) => (ex.id === blockExerciseId ? { ...ex, ...patch } : ex)),
    }));
    m.updateBlockExercise(supabase, blockExerciseId, patch).then(({ error }) => {
      if (error) fail(error);
    });
  }

  function handleNoteChange(dayId: string, blockId: string, blockExerciseId: string, notes: string | null) {
    updateBlock(week.id, dayId, blockId, (b) => ({
      ...b,
      exercises: b.exercises.map((ex) => (ex.id === blockExerciseId ? { ...ex, notes } : ex)),
    }));
    m.updateBlockExercise(supabase, blockExerciseId, { notes }).then(({ error }) => {
      if (error) fail(error);
    });
  }

  /** A name typed into the exercise search that didn't match anything
   * existing (built-in or already-saved) gets remembered here so it's a
   * real search result for every future exercise, in this program and
   * every other one — not just this one row's custom_name. Applied
   * optimistically to local `library` state (so it's searchable again
   * immediately, in the same session) with the actual save firing in the
   * background; a failure here is low-stakes enough (the exercise the
   * coach just picked is already attached to this block_exercise via the
   * normal onExerciseChange path regardless) not to surface its own error
   * banner. */
  function handleCreateCustomExercise(name: string, category: ExerciseCategory) {
    const alreadyKnown = library.some((e) => e.category === category && e.name.toLowerCase() === name.toLowerCase());
    if (!alreadyKnown) setLibrary((prev) => [...prev, { id: null, name, category }]);
    void addToExerciseLibrary(supabase, { ownerId: program.owner_id, name, category });
  }

  async function handleDuplicateExercise(dayId: string, blockId: string, blockExerciseId: string) {
    const day = week.days.find((d) => d.id === dayId);
    const sourceBlock = day?.blocks.find((b) => b.id === blockId);
    const exercise = sourceBlock?.exercises.find((ex) => ex.id === blockExerciseId);
    if (!day || !sourceBlock || !exercise) return;
    const { block, error } = await m.duplicateExercise(supabase, {
      dayId,
      position: nextPosition(day.blocks.filter((b) => b.block_role === sourceBlock.block_role)),
      exercise,
      blockRole: sourceBlock.block_role,
    });
    if (error || !block) {
      fail(error ?? "Couldn't duplicate that exercise.");
      return;
    }
    updateDay(week.id, dayId, (d) => ({ ...d, blocks: [...d.blocks, block] }));
  }

  function handleOpenSaveExerciseTemplate(dayId: string, blockId: string, blockExerciseId: string) {
    const exercise = week.days.find((d) => d.id === dayId)?.blocks.find((b) => b.id === blockId)?.exercises.find((ex) => ex.id === blockExerciseId);
    if (exercise) setSaveExerciseTemplateFor(exercise);
  }

  // `role` isn't needed here — block ids are globally unique regardless of
  // section, so the optimistic position-patch below works the same either
  // way. It's only in BlockSection's callback signature because each
  // section is its own independent drag surface (see day-column.tsx).
  function handleReorderBlocks(dayId: string, orderedBlocks: { id: string; position: number }[]) {
    const day = week.days.find((d) => d.id === dayId);
    if (!day) return;
    const positionById = new Map(orderedBlocks.map((b) => [b.id, b.position]));
    const reordered = [...day.blocks].map((b) => ({ ...b, position: positionById.get(b.id) ?? b.position })).sort((a, b) => a.position - b.position);
    updateDay(week.id, dayId, (d) => ({ ...d, blocks: reordered }));
    m.reorderBlocks(supabase, orderedBlocks).then(({ error }) => {
      if (error) fail(error);
    });
  }

  function handleReorderSets(dayId: string, blockId: string, blockExerciseId: string, orderedSets: { id: string; position: number }[]) {
    const positionById = new Map(orderedSets.map((s) => [s.id, s.position]));
    updateBlock(week.id, dayId, blockId, (b) => ({
      ...b,
      exercises: b.exercises.map((ex) =>
        ex.id === blockExerciseId
          ? { ...ex, sets: [...ex.sets].map((s) => ({ ...s, position: positionById.get(s.id) ?? s.position })).sort((a, c) => a.position - c.position) }
          : ex
      ),
    }));
    m.reorderSets(supabase, orderedSets).then(({ error }) => {
      if (error) fail(error);
    });
  }

  async function handleAddSet(dayId: string, blockId: string, blockExerciseId: string) {
    const day = week.days.find((d) => d.id === dayId);
    const block = day?.blocks.find((b) => b.id === blockId);
    const exercise = block?.exercises.find((ex) => ex.id === blockExerciseId);
    if (!exercise) return;
    const lastSet = exercise.sets[exercise.sets.length - 1];
    const prescriptionType = lastSet?.prescription_type ?? defaultPrescriptionType(exercise.exercise_category);
    const { set, error } = await m.addSetRow(supabase, {
      blockExerciseId: exercise.id,
      position: nextPosition(exercise.sets),
      category: exercise.exercise_category,
      prescriptionType,
      copyFrom: lastSet,
    });
    if (error || !set) {
      fail(error ?? "Couldn't add set.");
      return;
    }
    updateBlock(week.id, dayId, blockId, (b) => ({
      ...b,
      exercises: b.exercises.map((ex) => (ex.id === blockExerciseId ? { ...ex, sets: [...ex.sets, set] } : ex)),
    }));
  }

  async function performCategoryChange(dayId: string, blockId: string, blockExerciseId: string, category: ExerciseCategory) {
    const { set, error } = await m.switchExerciseCategory(supabase, { blockExerciseId, category });
    if (error || !set) {
      fail(error ?? "Couldn't switch exercise category.");
      return;
    }
    updateBlock(week.id, dayId, blockId, (b) => ({
      ...b,
      exercises: b.exercises.map((ex) => (ex.id === blockExerciseId ? { ...ex, exercise_category: category, sets: [set] } : ex)),
    }));
  }

  function handleCategoryChange(dayId: string, blockId: string, blockExerciseId: string, category: ExerciseCategory) {
    const day = week.days.find((d) => d.id === dayId);
    const exercise = day?.blocks.find((b) => b.id === blockId)?.exercises.find((ex) => ex.id === blockExerciseId);
    if (!exercise || exercise.exercise_category === category) return;

    // Switching wipes the existing prescription rows — a strength "3x8 @
    // weight" has no equivalent as a distance/duration, so confirm if
    // there's anything a user would actually lose.
    const hasData = exercise.sets.some(
      (s) =>
        s.weight_value != null ||
        s.percent_1rm_value != null ||
        s.distance_meters != null ||
        s.duration_seconds != null ||
        (s.reps && s.reps.length > 0)
    );
    if (!hasData) {
      performCategoryChange(dayId, blockId, blockExerciseId, category);
      return;
    }
    setPendingConfirm({
      title: "Switch exercise type?",
      description: `Switch to ${category}? This clears the prescription data already entered for this exercise.`,
      confirmLabel: "Switch",
      onConfirm: async () => {
        await performCategoryChange(dayId, blockId, blockExerciseId, category);
        setPendingConfirm(null);
      },
    });
  }

  /** Applies to every existing row on the exercise at once — one exercise,
   * one prescription type, matching "every Strength exercise must have a
   * required field: Prescription Type" rather than letting rows drift
   * apart. Non-destructive: existing field values are left as-is (see
   * updatePrescriptionType's own comment). */
  async function handlePrescriptionTypeChange(dayId: string, blockId: string, blockExerciseId: string, prescriptionType: PrescriptionType) {
    updateBlock(week.id, dayId, blockId, (b) => ({
      ...b,
      exercises: b.exercises.map((ex) =>
        ex.id === blockExerciseId ? { ...ex, sets: ex.sets.map((s) => ({ ...s, prescription_type: prescriptionType })) } : ex
      ),
    }));
    const { error } = await m.updatePrescriptionType(supabase, { blockExerciseId, prescriptionType });
    if (error) fail(error);
  }

  function handleSetChange(dayId: string, blockId: string, blockExerciseId: string, setId: string, patch: Partial<SetRow>) {
    updateBlock(week.id, dayId, blockId, (b) => ({
      ...b,
      exercises: b.exercises.map((ex) =>
        ex.id === blockExerciseId ? { ...ex, sets: ex.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)) } : ex
      ),
    }));
    m.updateSetRow(supabase, setId, patch).then(({ error }) => {
      if (error) fail(error);
    });
  }

  function handleDeleteSet(dayId: string, blockId: string, blockExerciseId: string, setId: string) {
    updateBlock(week.id, dayId, blockId, (b) => ({
      ...b,
      exercises: b.exercises.map((ex) =>
        ex.id === blockExerciseId ? { ...ex, sets: ex.sets.filter((s) => s.id !== setId) } : ex
      ),
    }));
    m.deleteSetRow(supabase, setId).then(({ error }) => {
      if (error) fail(error);
    });
  }

  return (
    <div className="mx-auto flex max-w-[100rem] flex-col gap-6 px-4 py-8 sm:px-6 lg:py-12">
      {saveError && (
        <div className="flex items-start gap-3 rounded-lg border border-danger/30 bg-danger/10 p-4">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
          <p className="flex-1 text-sm text-foreground">{saveError}</p>
          <button
            type="button"
            onClick={() => setSaveError(null)}
            aria-label="Dismiss"
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-1 flex-col gap-2">
          <input
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={commitName}
            aria-label="Program name"
            className="w-full rounded-md border border-transparent bg-transparent text-2xl font-semibold tracking-tight text-foreground transition-colors hover:border-border focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary sm:text-3xl"
          />
          <SegmentedControl
            aria-label="Discipline"
            options={DISCIPLINE_OPTIONS}
            value={program.discipline}
            onChange={handleDisciplineChange}
            className="w-fit"
          />
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <SegmentedControl aria-label="Editing mode" options={BUILDER_MODE_OPTIONS} value={mode} onChange={setMode} className="w-fit" />
          <div className="flex items-center gap-2 self-start sm:self-end">
          <Link
            href={`/programs/${program.id}`}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3.5 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Done editing
          </Link>
          <Button variant="outline" size="sm" onClick={handleDeleteProgram} disabled={deleting}>
            <Trash2 className="size-4" />
            Delete program
          </Button>
          </div>
        </div>
      </div>

      {/* overflow-x-auto with no explicit overflow-y computes overflow-y to
          auto too (CSS Overflow spec's "one axis visible, one not" rule) —
          overflow-y-visible keeps vertical wheel scroll bubbling to the
          page instead of dying over this row. */}
      <ScrollFadeX className="flex items-center gap-2 overflow-x-auto overflow-y-visible pb-1">
        {program.weeks.map((w) => (
          <div key={w.id} className="group relative shrink-0">
            <button
              type="button"
              onClick={() => setSelectedWeekId(w.id)}
              className={cn(
                "rounded-lg border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                w.id === selectedWeekId
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-surface text-muted-foreground hover:text-foreground"
              )}
            >
              {w.label || `Week ${w.position}`}
            </button>
            {program.weeks.length > 1 && (
              <button
                type="button"
                onClick={() => handleDeleteWeek(w.id)}
                aria-label={`Delete ${w.label || `Week ${w.position}`}`}
                className="absolute -right-1.5 -top-1.5 hidden size-4 items-center justify-center rounded-full bg-danger text-white group-hover:flex"
              >
                <X className="size-3" />
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={() => setAddWeekOpen(true)}
          className="flex shrink-0 items-center gap-1 rounded-lg border border-dashed border-border-strong px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Plus className="size-4" />
          Add week
        </button>
      </ScrollFadeX>

      {/*
        On mobile, days stack in one column (default flex-col). On desktop
        they run in a single horizontal row that scrolls sideways instead
        of wrapping to a second line — wrapping pushed later days below
        the fold, which defeats the point of having a whole week visible
        without navigating between days. A few days fit without scrolling;
        a 6-7 day week scrolls sideways, still on one screen.
      */}
      {/* Same overflow-y-visible fix as the week-tabs row above — this is
          the row that actually caused the bug in practice, since it's the
          one people hover over while editing exercises. */}
      <ScrollFadeX className="flex flex-col gap-4 lg:flex-row lg:flex-nowrap lg:items-start lg:overflow-x-auto lg:overflow-y-visible lg:pb-2">
        {mode === "preview"
          ? week.days.map((day) => (
              <div key={day.id} className="flex w-full shrink-0 flex-col gap-3 rounded-2xl border border-border bg-surface p-4 lg:w-96">
                <h2 className={cn("text-base font-semibold text-foreground", day.is_rest_day && "text-muted-foreground")}>
                  {day.label || `Day ${day.position}`}
                </h2>
                <AthletePreviewDay day={day} />
              </div>
            ))
          : week.days.map((day) => (
              <DayColumn
                key={day.id}
                day={day}
                otherDays={week.days
                  .filter((d) => d.id !== day.id)
                  .map((d) => ({ id: d.id, label: d.label, position: d.position }))}
                mode={mode}
                library={library}
                onCreateCustomExercise={handleCreateCustomExercise}
                onUpdateDay={(patch) => handleUpdateDay(day.id, patch)}
                onCopyTo={(targetDayId) => handleCopyDayTo(day, targetDayId)}
                onAddBlock={(role) => handleAddBlock(day.id, role)}
                onDeleteBlock={(blockId) => handleDeleteBlock(day.id, blockId)}
                onReorderBlocks={(_role, orderedBlocks) => handleReorderBlocks(day.id, orderedBlocks)}
                onAddExerciseToBlock={(blockId) => handleAddExerciseToBlock(day.id, blockId)}
                addingExerciseBlockId={addingExerciseBlockId}
                onRemoveExerciseFromBlock={(blockId, blockExerciseId) =>
                  handleRemoveExerciseFromBlock(day.id, blockId, blockExerciseId)
                }
                onDuplicateExercise={(blockId, blockExerciseId) => handleDuplicateExercise(day.id, blockId, blockExerciseId)}
                onRoundsChange={(blockId, rounds) => handleRoundsChange(day.id, blockId, rounds)}
                onExerciseChange={(blockId, blockExerciseId, patch) =>
                  handleExerciseChange(day.id, blockId, blockExerciseId, patch)
                }
                onNoteChange={(blockId, blockExerciseId, notes) => handleNoteChange(day.id, blockId, blockExerciseId, notes)}
                onCategoryChange={(blockId, blockExerciseId, category) =>
                  handleCategoryChange(day.id, blockId, blockExerciseId, category)
                }
                onPrescriptionTypeChange={(blockId, blockExerciseId, prescriptionType) =>
                  handlePrescriptionTypeChange(day.id, blockId, blockExerciseId, prescriptionType)
                }
                onAddSet={(blockId, blockExerciseId) => handleAddSet(day.id, blockId, blockExerciseId)}
                onSetChange={(blockId, blockExerciseId, setId, patch) =>
                  handleSetChange(day.id, blockId, blockExerciseId, setId, patch)
                }
                onDeleteSet={(blockId, blockExerciseId, setId) => handleDeleteSet(day.id, blockId, blockExerciseId, setId)}
                onReorderSets={(blockId, blockExerciseId, orderedSets) => handleReorderSets(day.id, blockId, blockExerciseId, orderedSets)}
                exerciseTemplates={exerciseTemplates}
                dayTemplates={dayTemplates}
                onSaveAsTemplate={(blockId, blockExerciseId) => handleOpenSaveExerciseTemplate(day.id, blockId, blockExerciseId)}
                onInsertExerciseTemplate={(role, template) => handleInsertExerciseTemplate(day.id, role, template)}
                onSaveDayAsTemplate={() => handleOpenSaveDayTemplate(day.id)}
                onInsertDayTemplate={(template) => handleInsertDayTemplate(day.id, template)}
              />
            ))}
      </ScrollFadeX>

      <AddWeekDialog
        open={addWeekOpen}
        onClose={() => setAddWeekOpen(false)}
        weeks={program.weeks}
        onCreate={handleAddWeek}
      />

      <ConfirmDialog
        open={pendingConfirm !== null}
        onClose={() => setPendingConfirm(null)}
        onConfirm={() => pendingConfirm?.onConfirm()}
        title={pendingConfirm?.title ?? ""}
        description={pendingConfirm?.description ?? ""}
        confirmLabel={pendingConfirm?.confirmLabel}
      />

      {saveExerciseTemplateFor && (
        <SaveExerciseTemplateDialog
          open
          onClose={() => setSaveExerciseTemplateFor(null)}
          exercise={saveExerciseTemplateFor}
          currentUserId={program.owner_id}
          onSaved={(template) => setExerciseTemplates((prev) => [template, ...prev])}
        />
      )}

      {saveDayTemplateFor && (
        <SaveDayTemplateDialog
          open
          onClose={() => setSaveDayTemplateFor(null)}
          day={saveDayTemplateFor}
          currentUserId={program.owner_id}
          onSaved={(template) => setDayTemplates((prev) => [template, ...prev])}
        />
      )}
    </div>
  );
}
