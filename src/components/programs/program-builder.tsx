"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, Loader2, Plus, Timer, Trash2, X } from "lucide-react";
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
import { defaultCategoryForDiscipline, defaultPrescriptionType, exerciseMaxRecordType, parseExerciseIdFromRecordType } from "@/lib/programs/prescription-types";
import { DISCIPLINE_META } from "@/lib/programs/discipline-meta";
import * as m from "@/lib/programs/mutations";
import { getExerciseLibrary, addToExerciseLibrary } from "@/lib/programs/exercise-library";
import { searchExerciseLibraryForPicker } from "@/lib/exercises/queries";
import { createCustomExerciseFromPicker } from "@/lib/exercises/mutations";
import { getExerciseTemplates } from "@/lib/programs/exercise-templates";
import { getDayTemplates } from "@/lib/programs/day-templates";
import { getPersonalRecords } from "@/lib/profile/queries";
import { todayDateString } from "@/lib/dates";
import type { ExerciseSearchResult } from "@/lib/programs/exercise-search";
import type { PersonalRecord } from "@/lib/supabase/types";
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
import { useToast } from "@/components/ui/toast";
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
 *
 * Performance for large programs (20+ weeks, hundreds of exercises), what
 * was and wasn't done:
 * - Already true by construction, not new work: only the *selected* week's
 *   days ever mount (`week = program.weeks.find(...)`) — a 20-week program
 *   costs what a 1-week program costs to render; the week-tabs row is the
 *   only thing that scales with week count, and it's cheap (labels only).
 * - Done this pass: the per-day block-role filter/sort in day-column.tsx
 *   and the exercise-ordering used by its keyboard shortcuts are memoized
 *   (useMemo) so they don't re-run on every keystroke. `otherDays` (every
 *   day's "copy/move to…" picker options) used to be an O(days²)
 *   `.filter().map()` recomputed from scratch on *every* render of this
 *   whole component; it's now memoized keyed on a flattened
 *   id/label/position string (dayMetaKey below) rather than on
 *   `week.days` itself, since that array gets a new reference on every
 *   edit anywhere in the week (see updateDay/updateWeek) — keying on the
 *   array reference would have recomputed just as often as not memoizing.
 * - Not done: per-exercise/per-day React.memo. Every handler passed to
 *   DayColumn/ExerciseBlockCard/ExerciseCard is still a fresh inline
 *   closure created on every render of this component (e.g. `onCopyTo=
 *   {(targetDayId) => handleCopyDayTo(day, targetDayId)}`), so React.memo
 *   on those components wouldn't currently skip anything — editing one
 *   exercise still re-renders every visible day and exercise. Fixing that
 *   for real means restructuring these handlers to take ids as arguments
 *   instead of having them curried in per list item, and reading current
 *   state from a ref or the setState updater instead of closing over
 *   `program`/`week` — a real, larger refactor across most of this file's
 *   handlers, not attempted here to avoid rushing something this
 *   load-bearing this late. No virtualization either: a single day with
 *   hundreds of exercises in one column still mounts all of them.
 */
export function ProgramBuilder({ initialProgram }: ProgramBuilderProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { showToast } = useToast();
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
  // Mirrors addingExerciseBlockId's rationale — "move to another day" is a
  // duplicate-then-remove round trip (see moveExerciseToDay's own comment),
  // so this disables the source select and shows "Moving…" for the one
  // exercise in flight rather than letting a second click during that
  // window fire a duplicate move.
  const [movingExerciseId, setMovingExerciseId] = useState<string | null>(null);
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
  // The athlete's merged personal_records + exercise_max_records
  // (getPersonalRecords already does this merge — see its own doc comment)
  // — fetched once by athlete_id (NOT owner_id: a coach building for
  // someone else needs THAT athlete's maxes, not their own), and turned
  // into a per-exercise "known max" lookup below. Powers ExerciseCard's
  // known-max control next to "Test max before": showing what's already on
  // record, and letting a coach who already knows a number enter it
  // directly instead of being forced through a testing week first.
  const [personalRecords, setPersonalRecords] = useState<PersonalRecord[]>([]);

  useEffect(() => setNameDraft(program.name), [program.name]);

  useEffect(() => {
    let cancelled = false;
    // Each .catch(() => {}) just leaves that one list empty on a failed
    // fetch rather than throwing an unhandled rejection — same reasoning
    // as the fix in auth-provider.tsx. The three lists are independent
    // (library/exercise-templates/day-templates each power a different,
    // optional picker), so one failing shouldn't affect the other two.
    getExerciseLibrary(supabase, program.owner_id)
      .then((entries) => {
        if (!cancelled) setLibrary(entries.map((e) => ({ id: null, name: e.name, category: e.category })));
      })
      .catch(() => {});
    getExerciseTemplates(supabase, program.owner_id)
      .then((templates) => {
        if (!cancelled) setExerciseTemplates(templates);
      })
      .catch(() => {});
    getDayTemplates(supabase, program.owner_id)
      .then((templates) => {
        if (!cancelled) setDayTemplates(templates);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [supabase, program.owner_id]);

  useEffect(() => {
    let cancelled = false;
    getPersonalRecords(supabase, program.athlete_id)
      .then((records) => {
        if (!cancelled) setPersonalRecords(records);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [supabase, program.athlete_id]);

  // Map<exerciseId, {valueKg, performedOn}> — the shared, single source of
  // truth every ExerciseCard for a given exercise reads its known-max
  // display from. Since this is keyed by exercise (not by block_exercise
  // row), entering a known max for one appearance of an exercise updates
  // every OTHER appearance's display automatically just by re-rendering
  // off this same map — no per-row propagation loop needed the way
  // test_max_before's checkbox required (see matchingBlockExerciseIds).
  const knownMaxByExerciseId = useMemo(() => {
    const map = new Map<string, { valueKg: number; performedOn: string }>();
    for (const record of personalRecords) {
      const exerciseId = parseExerciseIdFromRecordType(record.record_type);
      if (exerciseId) map.set(exerciseId, { valueKg: record.value_number, performedOn: record.achieved_on ?? "" });
    }
    return map;
  }, [personalRecords]);

  /** Saves a coach-entered known max (see saveKnownExerciseMax's own doc
   * comment for why this writes to the same table a logged test does).
   * Optimistically updates the shared knownMaxByExerciseId map — every
   * card showing this exercise reflects the new value immediately, this
   * program included, since resolvePercent1RMRecord (used at logging time,
   * not here) will read the same exercise_max_records row regardless of
   * which program it was entered from. */
  function handleSaveKnownMax(exerciseId: string, valueKg: number) {
    const recordType = exerciseMaxRecordType(exerciseId);
    const now = todayDateString();
    setPersonalRecords((prev) => [
      ...prev.filter((r) => r.record_type !== recordType),
      {
        id: `local-${exerciseId}-${now}`,
        user_id: program.athlete_id,
        record_type: recordType,
        value_number: valueKg,
        unit: "kg",
        achieved_on: now,
        created_at: now,
        updated_at: now,
      },
    ]);
    track(m.saveKnownExerciseMax(supabase, { athleteId: program.athlete_id, exerciseId, estimated1RMKg: valueKg, programId: program.id })).then(
      ({ error }) => {
        if (error) fail(error);
      }
    );
  }

  // Every program is created with a first week and never allowed to drop
  // below one (handleDeleteWeek blocks removing the last week), so this is
  // safe. Asserted non-null rather than narrowed by an `if` guard because
  // the handlers below are hoisted function declarations — control-flow
  // narrowing from a guard here wouldn't carry into their bodies, but the
  // variable's actual type does.
  const week = (program.weeks.find((w) => w.id === selectedWeekId) ?? program.weeks[0])!;

  // Performance: `week.days` gets a brand-new array reference on *every*
  // edit anywhere in the week (updateDay/updateWeek's immutable helpers
  // always `.map()` the days array, even when only one exercise deep inside
  // one day actually changed — see those helpers' own comments). Keying a
  // memo directly on `week.days` would therefore recompute on every single
  // keystroke, same as not memoizing at all. Keying on this flattened
  // "id:label:position" string instead means it only recomputes when a day
  // is actually added, removed, reordered, or relabeled — not when
  // something inside one changes — which is what actually matters for
  // otherDays (every other day's picker options). Otherwise this was a
  // `.filter().map()` re-run per day, per render (O(days²) every render)
  // for something that only changes when the day list itself changes.
  const dayMetaKey = week.days.map((d) => `${d.id}:${d.label ?? ""}:${d.position}`).join("|");
  const otherDaysByDayId = useMemo(() => {
    const meta = week.days.map((d) => ({ id: d.id, label: d.label, position: d.position }));
    const map = new Map<string, typeof meta>();
    for (const d of meta) map.set(d.id, meta.filter((m) => m.id !== d.id));
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dayMetaKey is the real dependency (see comment above); week.days itself would defeat the memo.
  }, [dayMetaKey]);

  function fail(message: string) {
    setSaveError(message);
  }

  // ---- autosave status ----
  // Every edit here applies to local state immediately and fires its
  // Supabase write in the background (see this component's own doc
  // comment) — nothing already surfaces that the write is actually
  // happening or has landed. `track` wraps each of those background
  // promises to drive a subtle "Saving…/All changes saved" indicator.
  // `pendingSavesRef` is a plain counter (not state) since only "is it
  // zero or not" needs to be reactive — every individual increment
  // shouldn't force a re-render.
  const pendingSavesRef = useRef(0);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  // Every in-flight background write, so anything that reads fresh state
  // back from the DB (syncTestingWeek's getProgramTree refresh, currently
  // the only caller — see handleSyncTestingWeek) can wait for outstanding
  // writes to actually land first. Without this, ticking "Test max before"
  // and then immediately clicking "Add testing week" could race: the
  // checkbox's PATCH is fired but not yet committed when syncTestingWeek's
  // own SELECT runs, so the refreshed tree silently reverts the checkbox
  // to its pre-write (false) value even though the testing week itself
  // was correctly built from the up-to-date optimistic local state.
  const pendingWritesRef = useRef<Set<Promise<unknown>>>(new Set());

  function track<T>(promise: Promise<T>): Promise<T> {
    pendingSavesRef.current += 1;
    setSaveStatus("saving");
    const tracked: Promise<T> = promise.finally(() => {
      pendingSavesRef.current -= 1;
      if (pendingSavesRef.current === 0) setSaveStatus("saved");
      pendingWritesRef.current.delete(tracked);
    });
    pendingWritesRef.current.add(tracked);
    return tracked;
  }

  /** Waits for every currently in-flight track()ed write to settle
   * (success or failure — a failed write shouldn't block the caller
   * forever, its error is already surfaced via `fail` by its own
   * `.then`). See pendingWritesRef's comment for why this exists. */
  async function flushPendingSaves(): Promise<void> {
    if (pendingWritesRef.current.size === 0) return;
    await Promise.allSettled([...pendingWritesRef.current]);
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
    const { error } = await track(m.updateProgram(supabase, program.id, { name: trimmed }));
    if (error) fail(error);
  }

  async function handleDisciplineChange(discipline: ProgramDiscipline) {
    setProgram((p) => ({ ...p, discipline }));
    const { error } = await track(m.updateProgram(supabase, program.id, { discipline }));
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
    const { week: newWeek, error } = await track(
      m.addWeek(supabase, {
        programId: program.id,
        position: nextPosition(program.weeks),
        dayTemplate,
        sourceWeek: params.sourceWeek,
        progressionPercent: params.progressionPercent,
      })
    );
    if (error || !newWeek) return error ?? "Something went wrong adding the week.";
    setProgram((p) => ({ ...p, weeks: [...p.weeks, newWeek] }));
    setSelectedWeekId(newWeek.id);
    return null;
  }

  // Whether the "Add testing week" button has anything to do — mirrors
  // syncTestingWeek's own scan (test_max_before = true, strength, a real
  // exercise_id, outside the testing week itself) so the button can
  // disable itself with an accurate hint instead of round-tripping to the
  // server just to learn there was nothing flagged.
  const testingWeek = program.weeks.find((w) => w.is_testing_week) ?? null;
  const hasFlaggedExercise = useMemo(
    () =>
      program.weeks.some(
        (w) =>
          w.id !== testingWeek?.id &&
          w.days.some((d) => d.blocks.some((b) => b.exercises.some((ex) => ex.test_max_before && ex.exercise_id && ex.exercise_category === "strength")))
      ),
    [program.weeks, testingWeek?.id]
  );
  const [syncingTestingWeek, setSyncingTestingWeek] = useState(false);

  async function handleSyncTestingWeek() {
    setSyncingTestingWeek(true);
    // Let any just-fired background write (most importantly a "Test max
    // before" checkbox flip) actually land before syncTestingWeek reads the
    // program back from the DB — see pendingWritesRef's comment.
    await flushPendingSaves();
    const { program: updated, error } = await track(m.syncTestingWeek(supabase, program));
    setSyncingTestingWeek(false);
    if (error || !updated) {
      fail(error ?? "Couldn't add the testing week.");
      return;
    }
    setProgram(updated);
    const newTestingWeek = updated.weeks.find((w) => w.is_testing_week);
    if (newTestingWeek) setSelectedWeekId(newTestingWeek.id);
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
        // Untick every real exercise this testing week's tests came from
        // FIRST — see untickTestMaxBefore's doc comment — then remove the
        // week itself from whatever `p.weeks` looks like at that point
        // (not a `remaining` snapshot taken before the untick, which would
        // otherwise silently discard it).
        if (target.is_testing_week) {
          untickTestMaxBefore(target.days.flatMap((d) => d.blocks.flatMap((b) => b.exercises.map((ex) => ex.exercise_id))));
        }
        setProgram((p) => ({ ...p, weeks: p.weeks.filter((w) => w.id !== weekId) }));
        if (selectedWeekId === weekId) {
          const remaining = program.weeks.filter((w) => w.id !== weekId);
          setSelectedWeekId(remaining[0]?.id ?? "");
        }
        setPendingConfirm(null);
        const { error } = await track(m.deleteWeek(supabase, weekId));
        if (error) fail(error);
      },
    });
  }

  // ---- days ----
  function handleUpdateDay(dayId: string, patch: { label?: string | null; is_rest_day?: boolean }) {
    updateDay(week.id, dayId, (d) => ({ ...d, ...patch }));
    track(m.updateDay(supabase, dayId, patch)).then(({ error }) => {
      if (error) fail(error);
    });
  }

  async function handleCopyDayTo(sourceDay: DayRow, targetDayId: string) {
    const targetDay = week.days.find((d) => d.id === targetDayId);
    if (!targetDay) return;
    const { blocks, error } = await track(
      m.copyDayContents(supabase, {
        sourceDay,
        targetDayId,
        targetDayBlocks: targetDay.blocks,
      })
    );
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
    const { blocks, error } = await track(
      m.insertDayTemplate(supabase, {
        targetDayId: dayId,
        targetDayBlocks: targetDay.blocks,
        template,
      })
    );
    if (error) {
      fail(error);
      return;
    }
    updateDay(week.id, dayId, (d) => ({ ...d, blocks: [...d.blocks, ...blocks] }));
  }

  async function handleDuplicateDay(dayId: string) {
    const sourceDay = week.days.find((d) => d.id === dayId);
    if (!sourceDay) return;
    const { day: newDay, error } = await track(
      m.duplicateDay(supabase, {
        sourceDay,
        weekId: week.id,
        position: nextPosition(week.days),
      })
    );
    if (error || !newDay) {
      fail(error ?? "Couldn't duplicate that day.");
      return;
    }
    updateWeek(week.id, (w) => ({ ...w, days: [...w.days, newDay] }));
  }

  /** A plain blank day — the "Add day" button next to the day columns,
   * same "append at the end" pattern as Add Week and Duplicate Day (just
   * with nothing cloned into it). */
  async function handleAddDay() {
    const { day: newDay, error } = await track(m.addDay(supabase, { weekId: week.id, position: nextPosition(week.days) }));
    if (error || !newDay) {
      fail(error ?? "Couldn't add a new day.");
      return;
    }
    updateWeek(week.id, (w) => ({ ...w, days: [...w.days, newDay] }));
  }

  function handleDeleteDay(dayId: string) {
    // A week is never allowed to drop below one day, mirroring
    // handleDeleteWeek's "can't drop below one week" guard — an empty
    // week isn't a state anything downstream (Preview mode, Training
    // Mode) is built to handle gracefully.
    if (week.days.length <= 1) return;
    const target = week.days.find((d) => d.id === dayId);
    if (!target) return;
    setPendingConfirm({
      title: "Delete day?",
      description: `Delete ${target.label || `Day ${target.position}`}? This can't be undone.`,
      confirmLabel: "Delete",
      onConfirm: async () => {
        if (week.is_testing_week) {
          untickTestMaxBefore(target.blocks.flatMap((b) => b.exercises.map((ex) => ex.exercise_id)));
        }
        updateWeek(week.id, (w) => ({ ...w, days: w.days.filter((d) => d.id !== dayId) }));
        setPendingConfirm(null);
        const { error } = await track(m.deleteDay(supabase, dayId));
        if (error) fail(error);
      },
    });
  }

  /** Composes duplicateExercise + removeExerciseFromBlock/deleteBlock (see
   * mutations.ts's moveExerciseToDay) rather than a real relational move —
   * this codebase has no DB transactions, so the mutation can partially
   * fail (exercise copied to the target day but the original couldn't be
   * removed). That case still returns the new block, just with a non-null
   * error, so the target day gets the copy either way and the source day is
   * only touched once removal actually succeeds. */
  async function handleMoveExerciseToDay(sourceDayId: string, blockId: string, blockExerciseId: string, targetDayId: string) {
    if (movingExerciseId === blockExerciseId) return;
    const sourceDay = week.days.find((d) => d.id === sourceDayId);
    const sourceBlock = sourceDay?.blocks.find((b) => b.id === blockId);
    const exercise = sourceBlock?.exercises.find((ex) => ex.id === blockExerciseId);
    const targetDay = week.days.find((d) => d.id === targetDayId);
    if (!sourceDay || !sourceBlock || !exercise || !targetDay) return;

    const sourceBlockHasOtherExercises = sourceBlock.exercises.length > 1;
    setMovingExerciseId(blockExerciseId);
    const { block, error } = await track(
      m.moveExerciseToDay(supabase, {
        targetDayId,
        targetPosition: nextPosition(targetDay.blocks.filter((b) => b.block_role === sourceBlock.block_role)),
        blockRole: sourceBlock.block_role,
        exercise,
        sourceBlockId: blockId,
        sourceBlockHasOtherExercises,
      })
    );
    setMovingExerciseId(null);
    if (!block) {
      fail(error ?? "Couldn't move that exercise.");
      return;
    }
    setProgram((p) => ({
      ...p,
      weeks: p.weeks.map((w) => {
        if (w.id !== week.id) return w;
        return {
          ...w,
          days: w.days.map((d) => {
            if (d.id === targetDayId) return { ...d, blocks: [...d.blocks, block] };
            if (d.id === sourceDayId && !error) {
              return {
                ...d,
                blocks: sourceBlockHasOtherExercises
                  ? d.blocks.map((b) => (b.id === blockId ? { ...b, exercises: b.exercises.filter((ex) => ex.id !== blockExerciseId) } : b))
                  : d.blocks.filter((b) => b.id !== blockId),
              };
            }
            return d;
          }),
        };
      }),
    }));
    if (error) fail(error);
  }

  // ---- blocks ----
  async function handleAddBlock(dayId: string, role: BlockRole = "main") {
    const day = week.days.find((d) => d.id === dayId);
    if (!day) return;
    const { block, error } = await track(
      m.addExerciseBlock(supabase, {
        dayId,
        position: nextPosition(day.blocks.filter((b) => b.block_role === role)),
        category: defaultCategoryForDiscipline(program.discipline),
        role,
      })
    );
    if (error || !block) {
      fail(error ?? "Couldn't add exercise.");
      return;
    }
    updateDay(week.id, dayId, (d) => ({ ...d, blocks: [...d.blocks, block] }));
  }

  async function handleInsertExerciseTemplate(dayId: string, role: BlockRole, template: ExerciseTemplateRow) {
    const day = week.days.find((d) => d.id === dayId);
    if (!day) return;
    const { block, error } = await track(
      m.addExerciseBlockFromTemplate(supabase, {
        dayId,
        position: nextPosition(day.blocks.filter((b) => b.block_role === role)),
        role,
        template,
      })
    );
    if (error || !block) {
      fail(error ?? "Couldn't insert that template.");
      return;
    }
    updateDay(week.id, dayId, (d) => ({ ...d, blocks: [...d.blocks, block] }));
  }

  function handleDeleteBlock(dayId: string, blockId: string) {
    if (week.is_testing_week) {
      const block = week.days.find((d) => d.id === dayId)?.blocks.find((b) => b.id === blockId);
      if (block) untickTestMaxBefore(block.exercises.map((ex) => ex.exercise_id));
    }
    updateDay(week.id, dayId, (d) => ({ ...d, blocks: d.blocks.filter((b) => b.id !== blockId) }));
    track(m.deleteBlock(supabase, blockId)).then(({ error }) => {
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
    const { exercise, error } = await track(
      m.addExerciseToBlock(supabase, {
        blockId,
        position: nextPosition(block.exercises),
        category,
      })
    );
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
      track(m.updateBlockType(supabase, blockId, "superset")).then(({ error: e }) => {
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
    if (week.is_testing_week) {
      const removed = block.exercises.find((ex) => ex.id === blockExerciseId);
      if (removed) untickTestMaxBefore([removed.exercise_id]);
    }
    const becomesUngrouped = block.exercises.length - 1 === 1;
    updateBlock(week.id, dayId, blockId, (b) => ({
      ...b,
      exercises: b.exercises.filter((ex) => ex.id !== blockExerciseId),
      block_type: becomesUngrouped ? "straight" : b.block_type,
    }));
    track(m.removeExerciseFromBlock(supabase, blockExerciseId)).then(({ error }) => {
      if (error) fail(error);
    });
    if (becomesUngrouped) {
      track(m.updateBlockType(supabase, blockId, "straight")).then(({ error }) => {
        if (error) fail(error);
      });
    }
  }

  function handleRoundsChange(dayId: string, blockId: string, rounds: number) {
    updateBlock(week.id, dayId, blockId, (b) => ({ ...b, rounds }));
    track(m.updateBlockRounds(supabase, blockId, rounds)).then(({ error }) => {
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
    track(m.updateBlockExercise(supabase, blockExerciseId, patch)).then(({ error }) => {
      if (error) fail(error);
    });
  }

  function handleNoteChange(dayId: string, blockId: string, blockExerciseId: string, notes: string | null) {
    updateBlock(week.id, dayId, blockId, (b) => ({
      ...b,
      exercises: b.exercises.map((ex) => (ex.id === blockExerciseId ? { ...ex, notes } : ex)),
    }));
    track(m.updateBlockExercise(supabase, blockExerciseId, { notes })).then(({ error }) => {
      if (error) fail(error);
    });
  }

  /** "Test max before" checkbox (migration 0054) — see syncTestingWeek's own
   * doc comment for what flipping this actually feeds into once the "Add
   * testing week" button below is pressed.
   *
   * The same exercise (e.g. Back Squat) commonly appears more than once
   * across a program — every day it's used, every week — and
   * syncTestingWeek already treats "flagged anywhere" as "test it once,"
   * deduping by exercise_id. Ticking the box on just one of those
   * appearances but leaving the others unchecked would look like a bug
   * (why is Back Squat ticked on Day 1 but not Day 3?), so this propagates
   * the new value to every block_exercise sharing the same exercise_id
   * across the whole program at once — not just the one row that was
   * actually clicked. The generated testing week's own copy of the
   * exercise (program_weeks.is_testing_week) is deliberately excluded:
   * that row's flag is never read by anything (syncTestingWeek already
   * skips its own week when scanning), so touching it would just be noise. */
  /** Every real (non-testing-week) block_exercise id sharing one of the
   * given exercise ids — computed from the current `program`, not from
   * inside a setState updater (which must stay pure). Shared by
   * handleTestMaxBeforeChange (propagating a tick to every appearance of
   * an exercise) and untickTestMaxBefore (the reverse, when a testing-week
   * day/exercise gets deleted — see its own doc comment below). */
  function matchingBlockExerciseIds(exerciseIds: (string | null)[]): string[] {
    const idSet = new Set(exerciseIds.filter((id): id is string => !!id));
    if (idSet.size === 0) return [];
    return program.weeks
      .filter((w) => !w.is_testing_week)
      .flatMap((w) => w.days)
      .flatMap((d) => d.blocks)
      .flatMap((b) => b.exercises)
      .filter((ex) => ex.exercise_id && idSet.has(ex.exercise_id))
      .map((ex) => ex.id);
  }

  /** "Test max before" checkbox (migration 0054) — see syncTestingWeek's own
   * doc comment for what flipping this actually feeds into once the "Add
   * testing week" button below is pressed.
   *
   * The same exercise (e.g. Back Squat) commonly appears more than once
   * across a program — every day it's used, every week — and
   * syncTestingWeek already treats "flagged anywhere" as "test it once,"
   * deduping by exercise_id. Ticking the box on just one of those
   * appearances but leaving the others unchecked would look like a bug
   * (why is Back Squat ticked on Day 1 but not Day 3?), so this propagates
   * the new value to every block_exercise sharing the same exercise_id
   * across the whole program at once — not just the one row that was
   * actually clicked. The generated testing week's own copy of the
   * exercise (program_weeks.is_testing_week) is deliberately excluded:
   * that row's flag is never read by anything (syncTestingWeek already
   * skips its own week when scanning), so touching it would just be noise. */
  function handleTestMaxBeforeChange(dayId: string, blockId: string, blockExerciseId: string, testMaxBefore: boolean) {
    const toggled = week.days.find((d) => d.id === dayId)?.blocks.find((b) => b.id === blockId)?.exercises.find((e) => e.id === blockExerciseId);
    const exerciseId = toggled?.exercise_id ?? null;

    if (!exerciseId) {
      // Shouldn't happen — the checkbox only renders for a linked exercise
      // — but fail safe to a single-row update rather than silently doing
      // nothing.
      updateBlock(week.id, dayId, blockId, (b) => ({
        ...b,
        exercises: b.exercises.map((ex) => (ex.id === blockExerciseId ? { ...ex, test_max_before: testMaxBefore } : ex)),
      }));
      track(m.updateBlockExercise(supabase, blockExerciseId, { test_max_before: testMaxBefore })).then(({ error }) => {
        if (error) fail(error);
      });
      return;
    }

    const matchingIds = matchingBlockExerciseIds([exerciseId]);

    setProgram((p) => ({
      ...p,
      weeks: p.weeks.map((w) =>
        w.is_testing_week
          ? w
          : {
              ...w,
              days: w.days.map((d) => ({
                ...d,
                blocks: d.blocks.map((b) => ({
                  ...b,
                  exercises: b.exercises.map((ex) => (ex.exercise_id === exerciseId ? { ...ex, test_max_before: testMaxBefore } : ex)),
                })),
              })),
            }
      ),
    }));

    // One batched statement rather than one PATCH per matching row — firing
    // N concurrent single-row updates here was enough concurrent write load
    // to trip the project's 8s statement_timeout (see
    // updateBlockExercisesTestMaxBefore's doc comment in mutations.ts).
    track(m.updateBlockExercisesTestMaxBefore(supabase, matchingIds, testMaxBefore)).then(({ error }) => {
      if (error) fail(error);
    });
  }

  /** The reverse of handleTestMaxBeforeChange's propagation: ticks
   * test_max_before back to false, everywhere, for every given exercise id.
   * Called whenever a day or exercise gets deleted FROM the testing week
   * itself (handleDeleteWeek/handleDeleteDay/handleDeleteBlock/
   * handleRemoveExerciseFromBlock, each gated on `week.is_testing_week` or
   * the deleted week's own flag).
   *
   * Without this, deleting a testing day/exercise looked like it worked —
   * the row disappeared — but the "Test max before" checkbox on the real
   * exercise(s) elsewhere in the program stayed ticked, since nothing ever
   * told them the test they were flagged for no longer exists. The next
   * "Sync testing week" click would then silently recreate exactly what
   * was just deleted (syncTestingWeek only ever looks at that flag — it
   * has no way to know a matching testing-week row used to exist and was
   * removed on purpose), which read as the deletion not having worked at
   * all. */
  function untickTestMaxBefore(exerciseIds: (string | null)[]) {
    const idSet = new Set(exerciseIds.filter((id): id is string => !!id));
    if (idSet.size === 0) return;
    const ids = matchingBlockExerciseIds([...idSet]);
    if (ids.length === 0) return;

    setProgram((p) => ({
      ...p,
      weeks: p.weeks.map((w) =>
        w.is_testing_week
          ? w
          : {
              ...w,
              days: w.days.map((d) => ({
                ...d,
                blocks: d.blocks.map((b) => ({
                  ...b,
                  exercises: b.exercises.map((ex) => (ex.exercise_id && idSet.has(ex.exercise_id) ? { ...ex, test_max_before: false } : ex)),
                })),
              })),
            }
      ),
    }));

    track(m.updateBlockExercisesTestMaxBefore(supabase, ids, false)).then(({ error }) => {
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

  /** DB-backed search over the shared Exercise Library (see
   * lib/exercises/queries.ts) — ExerciseSearchField's optional
   * `librarySearch` prop, threaded all the way down through DayColumn ->
   * ExerciseBlockCard -> ExerciseCard. */
  function handleLibrarySearch(query: string, category: ExerciseCategory) {
    return searchExerciseLibraryForPicker(supabase, { query, blockCategory: category });
  }

  /** The picker's "Create <name>" flow now creates a real, shared Exercise
   * Library row (spec: "Create New Exercise, which immediately adds it to
   * the library") instead of only a private legacy exercise_library entry
   * — the created exercise gets a real exercise_id other coaches can find
   * too. Falls back to handleCreateCustomExercise's plain custom_name path
   * (via ExerciseSearchField itself) if this returns null. */
  async function handleCreateInLibrary(name: string, category: ExerciseCategory) {
    const created = await createCustomExerciseFromPicker(supabase, { name, blockCategory: category, ownerId: program.owner_id });
    // New coach-owned exercises start "pending" (migration 0038) — visible
    // and usable right away by whoever just created it (it's added to
    // this program immediately after), but hidden from everyone else
    // until an admin approves it. Let them know so a hidden-until-approved
    // exercise doesn't look like a bug later.
    if (created) showToast(`"${created.name}" added — it's ready to use here, and will show up in the shared library once an admin reviews it.`);
    return created;
  }

  async function handleDuplicateExercise(dayId: string, blockId: string, blockExerciseId: string) {
    const day = week.days.find((d) => d.id === dayId);
    const sourceBlock = day?.blocks.find((b) => b.id === blockId);
    const exercise = sourceBlock?.exercises.find((ex) => ex.id === blockExerciseId);
    if (!day || !sourceBlock || !exercise) return;
    const { block, error } = await track(
      m.duplicateExercise(supabase, {
        dayId,
        position: nextPosition(day.blocks.filter((b) => b.block_role === sourceBlock.block_role)),
        exercise,
        blockRole: sourceBlock.block_role,
      })
    );
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
    track(m.reorderBlocks(supabase, orderedBlocks)).then(({ error }) => {
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
    track(m.reorderSets(supabase, orderedSets)).then(({ error }) => {
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
    const { set, error } = await track(
      m.addSetRow(supabase, {
        blockExerciseId: exercise.id,
        position: nextPosition(exercise.sets),
        category: exercise.exercise_category,
        prescriptionType,
        copyFrom: lastSet,
      })
    );
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
    const { set, error } = await track(m.switchExerciseCategory(supabase, { blockExerciseId, category }));
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
    const { error } = await track(m.updatePrescriptionType(supabase, { blockExerciseId, prescriptionType }));
    if (error) fail(error);
  }

  function handleSetChange(dayId: string, blockId: string, blockExerciseId: string, setId: string, patch: Partial<SetRow>) {
    updateBlock(week.id, dayId, blockId, (b) => ({
      ...b,
      exercises: b.exercises.map((ex) =>
        ex.id === blockExerciseId ? { ...ex, sets: ex.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)) } : ex
      ),
    }));
    track(m.updateSetRow(supabase, setId, patch)).then(({ error }) => {
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
    track(m.deleteSetRow(supabase, setId)).then(({ error }) => {
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
          <div className="flex items-center gap-3 self-start sm:self-end">
            {saveStatus !== "idle" && (
              <span
                role="status"
                className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
              >
                {saveStatus === "saving" ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Check className="size-3.5 text-primary" />
                    All changes saved
                  </>
                )}
              </span>
            )}
            <SegmentedControl aria-label="Editing mode" options={BUILDER_MODE_OPTIONS} value={mode} onChange={setMode} className="w-fit" />
          </div>
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
        <button
          type="button"
          onClick={handleSyncTestingWeek}
          disabled={!hasFlaggedExercise || syncingTestingWeek}
          title={hasFlaggedExercise ? undefined : 'Tick "Test max before" on an exercise first'}
          className="flex shrink-0 items-center gap-1 rounded-lg border border-dashed border-border-strong px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border-strong disabled:hover:text-muted-foreground"
        >
          {syncingTestingWeek ? <Loader2 className="size-4 animate-spin" /> : <Timer className="size-4" />}
          {testingWeek ? "Sync testing week" : "Add testing week"}
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
                otherDays={otherDaysByDayId.get(day.id) ?? []}
                mode={mode}
                library={library}
                onCreateCustomExercise={handleCreateCustomExercise}
                librarySearch={handleLibrarySearch}
                onCreateInLibrary={handleCreateInLibrary}
                onUpdateDay={(patch) => handleUpdateDay(day.id, patch)}
                onCopyTo={(targetDayId) => handleCopyDayTo(day, targetDayId)}
                onDuplicateDay={() => handleDuplicateDay(day.id)}
                onDeleteDay={week.days.length > 1 ? () => handleDeleteDay(day.id) : undefined}
                onAddBlock={(role) => handleAddBlock(day.id, role)}
                onDeleteBlock={(blockId) => handleDeleteBlock(day.id, blockId)}
                onReorderBlocks={(_role, orderedBlocks) => handleReorderBlocks(day.id, orderedBlocks)}
                onAddExerciseToBlock={(blockId) => handleAddExerciseToBlock(day.id, blockId)}
                addingExerciseBlockId={addingExerciseBlockId}
                onRemoveExerciseFromBlock={(blockId, blockExerciseId) =>
                  handleRemoveExerciseFromBlock(day.id, blockId, blockExerciseId)
                }
                onDuplicateExercise={(blockId, blockExerciseId) => handleDuplicateExercise(day.id, blockId, blockExerciseId)}
                onMoveExerciseToDay={(blockId, blockExerciseId, targetDayId) =>
                  handleMoveExerciseToDay(day.id, blockId, blockExerciseId, targetDayId)
                }
                movingExerciseId={movingExerciseId}
                onRoundsChange={(blockId, rounds) => handleRoundsChange(day.id, blockId, rounds)}
                onExerciseChange={(blockId, blockExerciseId, patch) =>
                  handleExerciseChange(day.id, blockId, blockExerciseId, patch)
                }
                onNoteChange={(blockId, blockExerciseId, notes) => handleNoteChange(day.id, blockId, blockExerciseId, notes)}
                onCategoryChange={(blockId, blockExerciseId, category) =>
                  handleCategoryChange(day.id, blockId, blockExerciseId, category)
                }
                onTestMaxBeforeChange={(blockId, blockExerciseId, testMaxBefore) =>
                  handleTestMaxBeforeChange(day.id, blockId, blockExerciseId, testMaxBefore)
                }
                knownMaxByExerciseId={knownMaxByExerciseId}
                onSaveKnownMax={handleSaveKnownMax}
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
        {mode !== "preview" && (
          <button
            type="button"
            onClick={handleAddDay}
            className="flex w-full shrink-0 items-center justify-center gap-1 rounded-2xl border border-dashed border-border-strong px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary lg:w-24"
          >
            <Plus className="size-4" />
            Add day
          </button>
        )}
      </ScrollFadeX>

      {/* Mobile-only duplicate of the "Add week" trigger above the week
          tabs. On a phone the day list stacks vertically and can run
          several screens long (up to 7 days), so reaching for "Add week"
          meant scrolling all the way back to the top — this puts the same
          action right after the last day instead. Desktop already shows
          the week tabs without scrolling past the days (they run in a
          horizontal row alongside the days, not above a long stack), so
          this only needs to exist below lg's breakpoint. */}
      <button
        type="button"
        onClick={() => setAddWeekOpen(true)}
        className="flex items-center justify-center gap-1 rounded-2xl border border-dashed border-border-strong px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary lg:hidden"
      >
        <Plus className="size-4" />
        Add week
      </button>
      <button
        type="button"
        onClick={handleSyncTestingWeek}
        disabled={!hasFlaggedExercise || syncingTestingWeek}
        className="flex items-center justify-center gap-1 rounded-2xl border border-dashed border-border-strong px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50 lg:hidden"
      >
        {syncingTestingWeek ? <Loader2 className="size-4 animate-spin" /> : <Timer className="size-4" />}
        {testingWeek ? "Sync testing week" : "Add testing week"}
      </button>

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
