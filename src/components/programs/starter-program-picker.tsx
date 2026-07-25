"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dumbbell, Repeat, Footprints, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { createProgramFromTemplate } from "@/lib/programs/mutations";
import { STARTER_PROGRAM_TEMPLATES } from "@/lib/programs/starter-templates";
import type { ProgramDiscipline } from "@/lib/programs/types";

const DISCIPLINE_ICON: Record<ProgramDiscipline, typeof Dumbbell> = {
  resistance: Dumbbell,
  hybrid: Repeat,
  running: Footprints,
};

const DISCIPLINE_LABEL: Record<ProgramDiscipline, string> = {
  resistance: "Weights",
  hybrid: "Hybrid",
  running: "Running",
};

interface StarterProgramPickerProps {
  /**
   * "redirect": picking one navigates to /sign-in with the chosen slug
   * carried through as `?start=<slug>` on the redirect target — used on
   * the signed-out homepage, where there's no user yet to create a
   * program for. "create": picking one calls createProgramFromTemplate
   * immediately — used on the dashboard, where the visitor is already
   * signed in.
   */
  mode: "redirect" | "create";
  userId?: string;
}

/**
 * "Pick a starter program to get going" — same card grid in both places
 * it's shown (signed-out homepage, dashboard's empty state for a
 * signed-in athlete with no active program), only what a click actually
 * does differs (see mode above).
 */
export function StarterProgramPicker({ mode, userId }: StarterProgramPickerProps) {
  const router = useRouter();
  const [pendingSlug, setPendingSlug] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleStart(slug: string) {
    if (mode === "redirect") {
      router.push(`/sign-in?redirect_to=${encodeURIComponent(`/dashboard?start=${slug}`)}`);
      return;
    }
    if (!userId || pendingSlug) return;
    const template = STARTER_PROGRAM_TEMPLATES.find((t) => t.slug === slug);
    if (!template) return;

    setPendingSlug(slug);
    setError(null);
    const supabase = createClient();
    const { program, error: createError } = await createProgramFromTemplate(supabase, { template, userId });
    setPendingSlug(null);

    if (createError || !program) {
      setError(createError ?? "Couldn't create that program — try again.");
      return;
    }
    router.push(`/programs/${program.id}`);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {STARTER_PROGRAM_TEMPLATES.map((template) => {
          const Icon = DISCIPLINE_ICON[template.discipline];
          const isPending = pendingSlug === template.slug;
          return (
            <div key={template.slug} className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5">
              <div className="flex items-center gap-2">
                <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-5" />
                </div>
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {DISCIPLINE_LABEL[template.discipline]}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <h3 className="text-base font-semibold text-foreground">{template.name}</h3>
                <p className="text-sm text-muted-foreground">{template.description}</p>
              </div>
              <p className="text-xs text-muted-foreground">
                {template.totalWeeks} weeks · {template.daysPerWeek} days/week
              </p>
              <Button size="sm" className="mt-1 self-start" disabled={isPending} onClick={() => handleStart(template.slug)}>
                {isPending ? "Starting…" : "Start this program"}
              </Button>
            </div>
          );
        })}
      </div>
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-foreground">
          <AlertTriangle className="size-4 shrink-0 text-danger" />
          {error}
        </div>
      )}
    </div>
  );
}
