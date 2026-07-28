"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { updateExercise } from "@/lib/exercises/mutations";
import type { ExerciseDetail } from "@/lib/exercises/types";
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
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";

/**
 * The "core" editing surface for "Edit Exercises" (spec) — classification
 * and description, the fields a coach correcting/refining their own
 * exercise (or an admin correcting any exercise) is most likely to need.
 * Coaching cues, common mistakes, and progression/regression/variation
 * links are seed/admin-curated content for now rather than inline-editable
 * here — a reasonable "core only" scope cut, same spirit as 0035's
 * metadata extension point.
 */
export function EditExerciseDialog({ exercise, onClose }: { exercise: ExerciseDetail; onClose: () => void }) {
  const [name, setName] = useState(exercise.name);
  const [category, setCategory] = useState(exercise.category);
  const [primaryMuscleGroup, setPrimaryMuscleGroup] = useState(exercise.primary_muscle_group);
  const [equipment, setEquipment] = useState(exercise.equipment);
  const [difficulty, setDifficulty] = useState(exercise.difficulty);
  const [description, setDescription] = useState(exercise.description ?? "");
  const [tags, setTags] = useState(exercise.tags.join(", "));
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const { showToast } = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const supabase = createClient();
    const { error } = await updateExercise(supabase, exercise.id, {
      name,
      category,
      primaryMuscleGroup,
      equipment,
      difficulty,
      description: description.trim() || null,
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    });
    setSubmitting(false);
    if (error) {
      showToast(error, "error");
      return;
    }
    showToast("Exercise updated.");
    router.refresh();
    onClose();
  }

  return (
    <Dialog open onClose={onClose} title="Edit exercise" description="Changes apply everywhere this exercise is referenced.">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="edit-exercise-name">Name</Label>
          <Input id="edit-exercise-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-exercise-category">Category</Label>
            <Select id="edit-exercise-category" value={category} onChange={(e) => setCategory(e.target.value as typeof category)}>
              {EXERCISE_LIBRARY_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {EXERCISE_LIBRARY_CATEGORY_LABELS[c]}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-exercise-difficulty">Difficulty</Label>
            <Select id="edit-exercise-difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value as typeof difficulty)}>
              {EXERCISE_DIFFICULTIES.map((d) => (
                <option key={d} value={d}>
                  {EXERCISE_DIFFICULTY_LABELS[d]}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-exercise-muscle">Primary muscle group</Label>
            <Select id="edit-exercise-muscle" value={primaryMuscleGroup} onChange={(e) => setPrimaryMuscleGroup(e.target.value as typeof primaryMuscleGroup)}>
              {MUSCLE_GROUPS.map((m) => (
                <option key={m} value={m}>
                  {MUSCLE_GROUP_LABELS[m]}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-exercise-equipment">Equipment</Label>
            <Select id="edit-exercise-equipment" value={equipment} onChange={(e) => setEquipment(e.target.value as typeof equipment)}>
              {EXERCISE_EQUIPMENT.map((eq) => (
                <option key={eq} value={eq}>
                  {EXERCISE_EQUIPMENT_LABELS[eq]}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="edit-exercise-description">Description</Label>
          <Textarea id="edit-exercise-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="edit-exercise-tags">Tags (comma-separated)</Label>
          <Input id="edit-exercise-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="strength, accessory, unilateral" />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
