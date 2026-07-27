"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { upsertContributorApplication } from "@/lib/insights/mutations";
import type { InsightsContributorApplication } from "@/lib/insights/types";

interface ContributorApplicationFormProps {
  profileId: string;
  /** Prefilled from an existing application (editing/resubmitting) — null
   * for a first-time applicant, in which case only `defaultName` (the
   * profile's own display name, a reasonable starting guess) is used. */
  existing: InsightsContributorApplication | null;
  defaultName: string;
  onSaved: (contributor: InsightsContributorApplication) => void;
}

/**
 * One form serves applying, editing a pending application, and
 * resubmitting after a rejection — upsertContributorApplication (see its
 * doc comment) already collapses those into a single call, so the form
 * itself doesn't need to branch on which case it's in beyond what
 * placeholder/button copy to show.
 */
export function ContributorApplicationForm({ profileId, existing, defaultName, onSaved }: ContributorApplicationFormProps) {
  const [name, setName] = useState(existing?.name ?? defaultName);
  const [title, setTitle] = useState(existing?.title ?? "");
  const [organisation, setOrganisation] = useState(existing?.organisation ?? "");
  const [qualifications, setQualifications] = useState(existing?.qualifications ?? "");
  const [bio, setBio] = useState(existing?.bio ?? "");
  const [expertise, setExpertise] = useState(existing?.expertise.join(", ") ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const isResubmit = existing?.status === "rejected";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !title.trim() || !bio.trim()) {
      setError("Name, title, and bio are required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    setSaved(false);

    const supabase = createClient();
    const { contributor, error: saveError } = await upsertContributorApplication(supabase, profileId, {
      name: name.trim(),
      title: title.trim(),
      organisation: organisation.trim() || null,
      qualifications: qualifications.trim() || null,
      bio: bio.trim(),
      expertise: expertise
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean),
    });

    setSubmitting(false);
    if (saveError || !contributor) {
      setError(saveError ?? "Something went wrong. Try again.");
      return;
    }
    setSaved(true);
    onSaved(contributor);
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="contributor-name">Name</Label>
            <Input id="contributor-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jordan Lee" />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="contributor-title">Title</Label>
            <Input
              id="contributor-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Strength & Conditioning Coach, Sports Scientist, Physiotherapist"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="contributor-organisation">Organisation (optional)</Label>
              <Input id="contributor-organisation" value={organisation} onChange={(e) => setOrganisation(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="contributor-qualifications">Qualifications (optional)</Label>
              <Input
                id="contributor-qualifications"
                value={qualifications}
                onChange={(e) => setQualifications(e.target.value)}
                placeholder="e.g. MSc Sports Science, CSCS"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="contributor-expertise">Areas of expertise</Label>
            <Input
              id="contributor-expertise"
              value={expertise}
              onChange={(e) => setExpertise(e.target.value)}
              placeholder="Strength, Programming, Nutrition (comma-separated)"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="contributor-bio">Bio</Label>
            <Textarea
              id="contributor-bio"
              rows={4}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="A couple of sentences on your background and what you'll write about."
            />
          </div>

          {error && (
            <div className="flex gap-3 rounded-lg border border-danger/30 bg-danger/10 p-3">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
              <p className="text-sm text-foreground">{error}</p>
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={submitting}>
              {submitting ? "Submitting…" : isResubmit ? "Resubmit application" : existing ? "Save changes" : "Apply to contribute"}
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
