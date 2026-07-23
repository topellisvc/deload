import { ProgramCard } from "@/components/programs/program-card";
import type { ProgramSummary } from "@/lib/programs/types";

/**
 * Reuses ProgramCard as-is — it already highlights is_active with a badge
 * and border and already links out to /programs/[id], which is exactly
 * "highlight the active program" + "quick navigation to open a program"
 * for free. canSetActive/canSend are both false here: those are
 * owner-only actions (see ProgramCard's own comment) and this section is
 * the *athlete's* view of programs a coach owns.
 */
export function SharedProgramsSection({ programs }: { programs: ProgramSummary[] }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-6">
      <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-muted-foreground">Shared programs</h2>
      {programs.length === 0 ? (
        <p className="text-sm text-muted-foreground">Your coach hasn&apos;t assigned you any programs yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {programs.map((program) => (
            <ProgramCard
              key={program.id}
              program={program}
              canSetActive={false}
              settingActive={false}
              onSetActive={() => {}}
              canSend={false}
              sendingCopy={false}
              onSend={() => {}}
              canDelete={false}
              deleting={false}
              onDelete={() => {}}
            />
          ))}
        </div>
      )}
    </div>
  );
}
