"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  Dumbbell,
  ListChecks,
  MessageSquareQuote,
  Pencil,
  Shuffle,
  Users,
} from "lucide-react";
import type { ExerciseDetail, ExerciseUsageStats, RelatedExercise } from "@/lib/exercises/types";
import { EXERCISE_EQUIPMENT_LABELS, EXERCISE_LIBRARY_CATEGORY_LABELS, MOVEMENT_PATTERN_LABELS, MUSCLE_GROUP_LABELS } from "@/lib/exercises/constants";
import { DifficultyBadge } from "@/components/exercises/difficulty-badge";
import { EditExerciseDialog } from "@/components/exercises/edit-exercise-dialog";
import { ArchiveExerciseButton } from "@/components/exercises/archive-exercise-button";
import { Button } from "@/components/ui/button";

/**
 * The Exercise Detail page — "should feel like a premium knowledge page
 * rather than a basic database entry" (spec). Renders as read-only content
 * with one edit affordance gated on ownership/admin (canEdit, computed
 * server-side in page.tsx from RLS-equivalent rules) rather than a full
 * always-visible CMS editor — matches the "core only" scope decision:
 * coaches/admins can correct/refine an exercise's classification and
 * description here; deeper content (cues, mistakes, relationships) is
 * seed/admin-curated for now.
 */
export function ExerciseDetailView({
  exercise,
  usage,
  canEdit,
  isAdmin,
}: {
  exercise: ExerciseDetail;
  usage: ExerciseUsageStats;
  canEdit: boolean;
  isAdmin: boolean;
}) {
  const [editOpen, setEditOpen] = useState(false);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-10">
      <Link href="/exercises" className="flex w-fit items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="size-3.5" />
        Exercise Library
      </Link>

      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-muted">
              <Dumbbell className="size-7 text-muted-foreground/50" />
            </div>
            <div className="flex flex-col gap-1.5">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">{exercise.name}</h1>
              <div className="flex flex-wrap items-center gap-1.5">
                <DifficultyBadge difficulty={exercise.difficulty} />
                <Chip>{EXERCISE_LIBRARY_CATEGORY_LABELS[exercise.category]}</Chip>
                <Chip>{EXERCISE_EQUIPMENT_LABELS[exercise.equipment]}</Chip>
                {exercise.movement_pattern && <Chip>{MOVEMENT_PATTERN_LABELS[exercise.movement_pattern]}</Chip>}
              </div>
            </div>
          </div>
          {canEdit && (
            <div className="flex shrink-0 items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                <Pencil className="size-3.5" />
                Edit
              </Button>
              {isAdmin && <ArchiveExerciseButton exerciseId={exercise.id} isArchived={exercise.is_archived} />}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span>
            <strong className="font-semibold text-foreground">Primary:</strong> {MUSCLE_GROUP_LABELS[exercise.primary_muscle_group]}
          </span>
          {exercise.secondary_muscle_groups.length > 0 && (
            <span>
              <strong className="font-semibold text-foreground">Secondary:</strong>{" "}
              {exercise.secondary_muscle_groups.map((m) => MUSCLE_GROUP_LABELS[m as keyof typeof MUSCLE_GROUP_LABELS] ?? m).join(", ")}
            </span>
          )}
        </div>

        {exercise.description && <p className="text-sm leading-relaxed text-foreground">{exercise.description}</p>}

        {exercise.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {exercise.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <UsageStatsRow usage={usage} />

      {(exercise.instructions_setup || exercise.instructions_execution || exercise.instructions_breathing || exercise.instructions_finishing) && (
        <Section icon={<ListChecks className="size-4" />} title="Instructions">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <InstructionBlock label="Setup" text={exercise.instructions_setup} />
            <InstructionBlock label="Execution" text={exercise.instructions_execution} />
            <InstructionBlock label="Breathing" text={exercise.instructions_breathing} />
            <InstructionBlock label="Finishing Position" text={exercise.instructions_finishing} />
          </div>
        </Section>
      )}

      {exercise.coachingCues.length > 0 && (
        <Section icon={<MessageSquareQuote className="size-4" />} title="Coaching Cues">
          <ul className="flex flex-col gap-2">
            {exercise.coachingCues.map((cue) => (
              <li key={cue.id} className="flex items-start gap-2 text-sm text-foreground">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                {cue.cue}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {exercise.commonMistakes.length > 0 && (
        <Section icon={<AlertTriangle className="size-4" />} title="Common Mistakes">
          <ul className="flex flex-col gap-3">
            {exercise.commonMistakes.map((mistake) => (
              <li key={mistake.id} className="flex flex-col gap-0.5 rounded-xl border border-danger/20 bg-danger/5 p-3">
                <span className="text-sm font-medium text-foreground">{mistake.mistake}</span>
                {mistake.correction && <span className="text-sm text-muted-foreground">Fix: {mistake.correction}</span>}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <RelatedSection title="Progressions" icon={<ArrowUpRight className="size-4" />} items={exercise.progressions} />
      <RelatedSection title="Regressions" icon={<ArrowUpRight className="size-4 rotate-180" />} items={exercise.regressions} />
      <RelatedSection title="Variations" icon={<Shuffle className="size-4" />} items={exercise.variations} />

      {editOpen && <EditExerciseDialog exercise={exercise} onClose={() => setEditOpen(false)} />}
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{children}</span>;
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-6">
      <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}

function InstructionBlock({ label, text }: { label: string; text: string | null }) {
  if (!text) return null;
  return (
    <div className="flex flex-col gap-1 rounded-xl bg-muted/50 p-3">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <p className="text-sm leading-relaxed text-foreground">{text}</p>
    </div>
  );
}

function UsageStatsRow({ usage }: { usage: ExerciseUsageStats }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <StatCard icon={<Activity className="size-4" />} label="Used in" value={`${usage.programCount} program${usage.programCount === 1 ? "" : "s"}`} />
      <StatCard icon={<ListChecks className="size-4" />} label="Completed" value={`${usage.completedCount} time${usage.completedCount === 1 ? "" : "s"}`} />
      <StatCard icon={<Users className="size-4" />} label="Used by" value={`${usage.coachCount} coach${usage.coachCount === 1 ? "" : "es"}`} />
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-2xl border border-border bg-surface p-4 text-center">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-sm font-semibold text-foreground">{value}</span>
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </div>
  );
}

function RelatedSection({ title, icon, items }: { title: string; icon: React.ReactNode; items: RelatedExercise[] }) {
  if (items.length === 0) return null;
  return (
    <Section icon={icon} title={title}>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <Link
            key={item.id}
            href={`/exercises/${item.id}`}
            className="flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:border-border-strong hover:bg-surface-hover"
          >
            {item.name}
            <DifficultyBadge difficulty={item.difficulty} />
          </Link>
        ))}
      </div>
    </Section>
  );
}
