"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createExercise } from "@/lib/exercises/mutations";
import {
  EXERCISE_DIFFICULTIES,
  EXERCISE_DIFFICULTY_LABELS,
  EXERCISE_EQUIPMENT,
  EXERCISE_EQUIPMENT_LABELS,
  EXERCISE_LIBRARY_CATEGORIES,
  EXERCISE_LIBRARY_CATEGORY_LABELS,
  MUSCLE_GROUPS,
  MUSCLE_GROUP_LABELS,
} from "@/lib/exercises/constants";
import type { ExerciseDifficulty, ExerciseEquipment, ExerciseLibraryCategory, MuscleGroup } from "@/lib/exercises/types";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";

/** Admin's "Create Exercises" (spec) — a new global (owner_id null)
 * catalog entry, immediately usable from the Program Builder's picker
 * like any seeded one. */
export function CreateExerciseDialog({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<ExerciseLibraryCategory>("strength");
  const [primaryMuscleGroup, setPrimaryMuscleGroup] = useState<MuscleGroup>("full_body");
  const [equipment, setEquipment] = useState<ExerciseEquipment>("bodyweight");
  const [difficulty, setDifficulty] = useState<ExerciseDifficulty>("intermediate");
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const { showToast } = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    const supabase = createClient();
    const { exercise, error } = await createExercise(supabase, {
      name,
      category,
      primaryMuscleGroup,
      equipment,
      difficulty,
      ownerId: null,
    });
    setSubmitting(false);
    if (error || !exercise) {
      showToast(error ?? "Couldn't create that exercise.", "error");
      return;
    }
    showToast("Exercise created.");
    onClose();
    router.push(`/exercises/${exercise.id}`);
  }

  return (
    <Dialog open onClose={onClose} title="Create exercise" description="Adds a new global exercise to the shared library.">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="create-exercise-name">Name</Label>
          <Input id="create-exercise-name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="create-exercise-category">Category</Label>
            <Select id="create-exercise-category" value={category} onChange={(e) => setCategory(e.target.value as ExerciseLibraryCategory)}>
              {EXERCISE_LIBRARY_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {EXERCISE_LIBRARY_CATEGORY_LABELS[c]}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="create-exercise-difficulty">Difficulty</Label>
            <Select id="create-exercise-difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value as ExerciseDifficulty)}>
              {EXERCISE_DIFFICULTIES.map((d) => (
                <option key={d} value={d}>
                  {EXERCISE_DIFFICULTY_LABELS[d]}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="create-exercise-muscle">Primary muscle group</Label>
            <Select id="create-exercise-muscle" value={primaryMuscleGroup} onChange={(e) => setPrimaryMuscleGroup(e.target.value as MuscleGroup)}>
              {MUSCLE_GROUPS.map((m) => (
                <option key={m} value={m}>
                  {MUSCLE_GROUP_LABELS[m]}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="create-exercise-equipment">Equipment</Label>
            <Select id="create-exercise-equipment" value={equipment} onChange={(e) => setEquipment(e.target.value as ExerciseEquipment)}>
              {EXERCISE_EQUIPMENT.map((eq) => (
                <option key={eq} value={eq}>
                  {EXERCISE_EQUIPMENT_LABELS[eq]}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting || !name.trim()}>
            {submitting ? "Creating…" : "Create exercise"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
