import { NotebookPen } from "lucide-react";

/**
 * Future-ready placeholder — no notes table/schema exists yet (spec calls
 * this out explicitly as "Notes (future ready)"). Given the same card
 * shape as every other athlete-detail section so a real notes list/editor
 * can be dropped in later without restructuring the page around it.
 */
export function NotesSection() {
  return (
    <div className="rounded-2xl border border-border bg-surface p-6">
      <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-muted-foreground">Notes</h2>
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <NotebookPen className="size-5 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Private coaching notes aren&apos;t available yet — coming soon.</p>
      </div>
    </div>
  );
}
