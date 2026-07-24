"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { ProgramCard } from "@/components/programs/program-card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { createClient } from "@/lib/supabase/client";
import { removeAssignedProgram, setActiveProgram } from "@/lib/programs/mutations";
import type { ProgramSummary } from "@/lib/programs/types";

interface SharedProgramsSectionProps {
  programs: ProgramSummary[];
  /** The viewer's own id — every program passed in is one this coach
   * assigned to *this* viewer (see the filter at the /coaching page's call
   * site: owner_id === coach.coach_id), so the viewer is always the
   * athlete_id side, never the owner. Needed now that this section offers
   * the same set-active/remove actions ProgramCard already supports
   * elsewhere (programs-list.tsx, the program's own detail page) — it
   * used to hardcode all three to false, which meant an athlete could
   * manage a coach-assigned program from every surface except this one. */
  userId: string;
}

/**
 * Reuses ProgramCard as-is — it already highlights is_active with a badge
 * and border and already links out to /programs/[id], which is exactly
 * "highlight the active program" + "quick navigation to open a program"
 * for free. canSend stays false here: sending a copy edits/creates a
 * program, which only the owner (the coach) can do — this section is
 * always the *athlete's* view of programs a coach owns.
 */
export function SharedProgramsSection({ programs: initialPrograms, userId }: SharedProgramsSectionProps) {
  const router = useRouter();
  // Defensive, not just documentation: canSetActive/canDelete below assume
  // every card here belongs to the viewer as its athlete_id (never its
  // owner_id) — this guards that assumption instead of silently trusting
  // the caller's own filter.
  const [programs, setPrograms] = useState(initialPrograms.filter((p) => p.athlete_id === userId));
  const [settingActiveId, setSettingActiveId] = useState<string | null>(null);
  const [activeError, setActiveError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<ProgramSummary | null>(null);

  async function handleSetActive(programId: string) {
    const target = programs.find((p) => p.id === programId);
    if (!target) return;

    const previous = programs;
    setActiveError(null);
    setSettingActiveId(programId);
    setPrograms((current) =>
      current.map((p) =>
        p.id === programId ? { ...p, is_active: true } : p.athlete_id === target.athlete_id ? { ...p, is_active: false } : p
      )
    );

    const supabase = createClient();
    const { error } = await setActiveProgram(supabase, programId);
    setSettingActiveId(null);
    if (error) {
      setPrograms(previous);
      setActiveError(error);
      return;
    }
    // Same cache-staleness reasoning as ProgramsList/ProgramViewer's
    // handleSetActive — this RPC bypasses Server Actions, so the
    // dashboard and this program's own page need an explicit refresh.
    router.refresh();
  }

  async function handleRemove() {
    if (!confirmTarget) return;
    const programId = confirmTarget.id;

    const previous = programs;
    setRemoveError(null);
    setRemovingId(programId);
    setPrograms((current) => current.filter((p) => p.id !== programId));

    const supabase = createClient();
    const { error } = await removeAssignedProgram(supabase, programId);
    setRemovingId(null);
    setConfirmTarget(null);
    if (error) {
      setPrograms(previous);
      setRemoveError(error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-6">
      <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-muted-foreground">Shared programs</h2>

      {(activeError || removeError) && (
        <div className="mb-4 flex gap-3 rounded-lg border border-danger/30 bg-danger/10 p-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
          <p className="text-sm text-foreground">{activeError || removeError}</p>
        </div>
      )}

      {programs.length === 0 ? (
        <p className="text-sm text-muted-foreground">Your coach hasn&apos;t assigned you any programs yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {programs.map((program) => (
            <ProgramCard
              key={program.id}
              program={program}
              canSetActive={!program.removed_by_athlete_at}
              settingActive={settingActiveId === program.id}
              onSetActive={handleSetActive}
              canSend={false}
              sendingCopy={false}
              onSend={() => {}}
              canDelete={!program.removed_by_athlete_at}
              deleting={removingId === program.id}
              onDelete={(programId) => {
                const target = programs.find((p) => p.id === programId);
                if (target) setConfirmTarget(target);
              }}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={confirmTarget !== null}
        onClose={() => setConfirmTarget(null)}
        onConfirm={handleRemove}
        title="Remove program?"
        description={`Remove "${confirmTarget?.name}"? This only removes your own copy — it won't affect your coach's original.`}
        confirmLabel="Remove"
      />
    </div>
  );
}
