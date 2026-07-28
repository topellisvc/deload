"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import type { Exercise } from "@/lib/exercises/types";
import { EXERCISE_LIBRARY_CATEGORY_LABELS } from "@/lib/exercises/constants";
import { Button } from "@/components/ui/button";
import { DifficultyBadge } from "@/components/exercises/difficulty-badge";
import { ArchiveExerciseButton } from "@/components/exercises/archive-exercise-button";
import { MergeExercisesPanel } from "@/components/exercises/merge-exercises-panel";
import { CreateExerciseDialog } from "@/components/exercises/create-exercise-dialog";

export function ExerciseAdminPanel({ initialExercises }: { initialExercises: Exercise[] }) {
  const [createOpen, setCreateOpen] = useState(false);
  const router = useRouter();
  // `initialExercises` is re-fetched fresh on every router.refresh() the
  // child actions below trigger (archive/restore/merge each call it) —
  // reading straight from props rather than mirroring into local state
  // keeps this table from ever going stale relative to what those actions
  // just did.
  const exercises = initialExercises;
  const activeCount = exercises.filter((e) => !e.is_archived).length;
  const archivedCount = exercises.length - activeCount;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <Link href="/exercises" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            ← Exercise Library
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Admin tools</h1>
          <p className="text-sm text-muted-foreground">
            {activeCount} active{archivedCount > 0 ? ` · ${archivedCount} archived` : ""}
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          Create exercise
        </Button>
      </div>

      <MergeExercisesPanel exercises={exercises} onMerged={() => router.refresh()} />

      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Source</th>
              <th className="px-4 py-3 font-medium">Difficulty</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {exercises.map((exercise) => (
              <tr key={exercise.id} className={exercise.is_archived ? "opacity-50" : undefined}>
                <td className="px-4 py-3">
                  <Link href={`/exercises/${exercise.id}`} className="font-medium text-foreground hover:text-primary hover:underline">
                    {exercise.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{EXERCISE_LIBRARY_CATEGORY_LABELS[exercise.category]}</td>
                <td className="px-4 py-3 text-muted-foreground">{exercise.owner_id ? "Coach-created" : "Global"}</td>
                <td className="px-4 py-3">
                  <DifficultyBadge difficulty={exercise.difficulty} />
                </td>
                <td className="px-4 py-3 text-muted-foreground">{exercise.is_archived ? "Archived" : "Active"}</td>
                <td className="px-4 py-3 text-right">
                  <ArchiveExerciseButton exerciseId={exercise.id} isArchived={exercise.is_archived} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {createOpen && <CreateExerciseDialog onClose={() => setCreateOpen(false)} />}
    </div>
  );
}
