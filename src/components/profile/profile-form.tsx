"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { createClient } from "@/lib/supabase/client";
import { updateProfile } from "@/lib/profile/mutations";
import type { Profile, ProfileLengthUnit, ProfileMassUnit } from "@/lib/supabase/types";

const HEIGHT_UNIT_OPTIONS = [
  { value: "cm" as const, label: "cm" },
  { value: "in" as const, label: "in" },
];

const WEIGHT_UNIT_OPTIONS = [
  { value: "kg" as const, label: "kg" },
  { value: "lb" as const, label: "lb" },
];

interface ProfileFormProps {
  profile: Profile;
}

/**
 * All fields save together on one explicit "Save" button rather than
 * per-field optimistic saves (the pattern used in the program builder) —
 * this is a handful of independent personal-info fields someone fills in
 * once and rarely touches again, not a live-editing surface, so a single
 * submit is simpler and avoids five separate network calls for one visit.
 */
export function ProfileForm({ profile }: ProfileFormProps) {
  const [displayName, setDisplayName] = useState(profile.display_name ?? "");
  const [heightValue, setHeightValue] = useState(profile.height_value?.toString() ?? "");
  const [heightUnit, setHeightUnit] = useState<ProfileLengthUnit>(profile.height_unit ?? "cm");
  const [weightValue, setWeightValue] = useState(profile.weight_value?.toString() ?? "");
  const [weightUnit, setWeightUnit] = useState<ProfileMassUnit>(profile.weight_unit ?? "kg");
  const [goal, setGoal] = useState(profile.goal ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    const parsedHeight = heightValue.trim() === "" ? null : Number(heightValue);
    const parsedWeight = weightValue.trim() === "" ? null : Number(weightValue);

    if (parsedHeight !== null && (!Number.isFinite(parsedHeight) || parsedHeight <= 0)) {
      setSaving(false);
      setError("Height doesn't look like a valid number.");
      return;
    }
    if (parsedWeight !== null && (!Number.isFinite(parsedWeight) || parsedWeight <= 0)) {
      setSaving(false);
      setError("Weight doesn't look like a valid number.");
      return;
    }

    const supabase = createClient();
    const { error: saveError } = await updateProfile(supabase, profile.id, {
      display_name: displayName.trim() || null,
      height_value: parsedHeight,
      height_unit: parsedHeight !== null ? heightUnit : null,
      weight_value: parsedWeight,
      weight_unit: parsedWeight !== null ? weightUnit : null,
      goal: goal.trim() || null,
    });

    setSaving(false);
    if (saveError) {
      setError(saveError);
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSave} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="display_name">Display name</Label>
            <Input
              id="display_name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="height_value">Height</Label>
              <div className="flex gap-2">
                <Input
                  id="height_value"
                  inputMode="decimal"
                  value={heightValue}
                  onChange={(e) => setHeightValue(e.target.value)}
                  placeholder={heightUnit === "cm" ? "178" : "70"}
                  className="flex-1"
                />
                <SegmentedControl
                  aria-label="Height unit"
                  options={HEIGHT_UNIT_OPTIONS}
                  value={heightUnit}
                  onChange={setHeightUnit}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="weight_value">Weight</Label>
              <div className="flex gap-2">
                <Input
                  id="weight_value"
                  inputMode="decimal"
                  value={weightValue}
                  onChange={(e) => setWeightValue(e.target.value)}
                  placeholder={weightUnit === "kg" ? "75" : "165"}
                  className="flex-1"
                />
                <SegmentedControl
                  aria-label="Weight unit"
                  options={WEIGHT_UNIT_OPTIONS}
                  value={weightUnit}
                  onChange={setWeightUnit}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="goal">Goal</Label>
            <Textarea
              id="goal"
              rows={3}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="e.g. Add 20kg to my squat, or run a sub-45-minute 10k"
            />
          </div>

          {error && (
            <div className="flex gap-3 rounded-lg border border-danger/30 bg-danger/10 p-4">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
              <p className="text-sm text-foreground">{error}</p>
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
            {saved && (
              <span className="flex items-center gap-1.5 text-sm text-success">
                <CheckCircle2 className="size-4" />
                Saved
              </span>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
