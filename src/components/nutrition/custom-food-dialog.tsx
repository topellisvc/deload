"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { createCustomFood } from "@/lib/nutrition/mutations";
import type { Food } from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/client";

interface CustomFoodDialogProps {
  open: boolean;
  onClose: () => void;
  ownerId: string;
  /** Pre-fills the name from whatever the coach had already typed into
   * FoodSearchField before hitting "Add as custom food" — see that
   * component's onAddCustomFood prop. */
  initialName?: string;
  onCreated: (food: Food) => void;
}

/**
 * "Import foods that aren't in the database" (Ellis's explicit ask) — a
 * coach fills in the per-100g macros directly rather than this trying to
 * look anything up. Mirrors SaveDayTemplateDialog's shape (own Dialog,
 * own createClient(), own submitting/error state), just with more fields
 * since lib/nutrition/mutations.ts's createCustomFood needs calories/
 * protein/carbs/fat at minimum — a plain name (like ExerciseSearchField's
 * custom_name fallback) isn't enough to compute macros against.
 */
export function CustomFoodDialog({ open, onClose, ownerId, initialName, onCreated }: CustomFoodDialogProps) {
  const [name, setName] = useState(initialName ?? "");
  const [brand, setBrand] = useState("");
  const [calories, setCalories] = useState("");
  const [proteinG, setProteinG] = useState("");
  const [carbsG, setCarbsG] = useState("");
  const [fatG, setFatG] = useState("");
  const [servingG, setServingG] = useState("");
  const [servingLabel, setServingLabel] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) setName(initialName ?? "");
  }, [open, initialName]);

  function parsePositive(text: string): number | null {
    const trimmed = text.trim();
    if (trimmed === "") return 0;
    const n = Number(trimmed);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Give the food a name.");
      return;
    }
    const parsedCalories = parsePositive(calories);
    const parsedProtein = parsePositive(proteinG);
    const parsedCarbs = parsePositive(carbsG);
    const parsedFat = parsePositive(fatG);
    if (parsedCalories === null || parsedProtein === null || parsedCarbs === null || parsedFat === null) {
      setError("Macro values need to be positive numbers.");
      return;
    }
    const parsedServingG = servingG.trim() === "" ? null : Number(servingG);
    if (parsedServingG !== null && !Number.isFinite(parsedServingG)) {
      setError("Serving size needs to be a number.");
      return;
    }

    setSubmitting(true);
    setError(null);
    const supabase = createClient();
    const { food, error: saveError } = await createCustomFood(supabase, {
      ownerId,
      name: name.trim(),
      brand: brand.trim() || null,
      calories: parsedCalories,
      protein_g: parsedProtein,
      carbs_g: parsedCarbs,
      fat_g: parsedFat,
      default_serving_g: parsedServingG,
      default_serving_label: servingLabel.trim() || null,
    });
    setSubmitting(false);

    if (saveError || !food) {
      setError(saveError ?? "Something went wrong saving this food.");
      return;
    }
    onCreated(food);
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add a custom food"
      description="Macros are per 100g, same as every other food here — quantity when you add it to a meal scales from this."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 flex flex-col gap-2">
            <Label htmlFor="custom-food-name">Name</Label>
            <Input id="custom-food-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="e.g. Mom's protein pancakes" />
          </div>
          <div className="col-span-2 flex flex-col gap-2">
            <Label htmlFor="custom-food-brand">Brand (optional)</Label>
            <Input id="custom-food-brand" value={brand} onChange={(e) => setBrand(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="custom-food-calories">Calories / 100g</Label>
            <Input id="custom-food-calories" inputMode="decimal" value={calories} onChange={(e) => setCalories(e.target.value)} placeholder="0" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="custom-food-protein">Protein (g) / 100g</Label>
            <Input id="custom-food-protein" inputMode="decimal" value={proteinG} onChange={(e) => setProteinG(e.target.value)} placeholder="0" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="custom-food-carbs">Carbs (g) / 100g</Label>
            <Input id="custom-food-carbs" inputMode="decimal" value={carbsG} onChange={(e) => setCarbsG(e.target.value)} placeholder="0" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="custom-food-fat">Fat (g) / 100g</Label>
            <Input id="custom-food-fat" inputMode="decimal" value={fatG} onChange={(e) => setFatG(e.target.value)} placeholder="0" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="custom-food-serving-g">Default serving (g, optional)</Label>
            <Input id="custom-food-serving-g" inputMode="decimal" value={servingG} onChange={(e) => setServingG(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="custom-food-serving-label">Serving label (optional)</Label>
            <Input id="custom-food-serving-label" value={servingLabel} onChange={(e) => setServingLabel(e.target.value)} placeholder="e.g. 1 scoop" />
          </div>
        </div>

        {error && (
          <div className="flex gap-3 rounded-lg border border-danger/30 bg-danger/10 p-3">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
            <p className="text-sm text-foreground">{error}</p>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : "Add food"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
