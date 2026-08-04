import { Users } from "lucide-react";

/**
 * The right panel's default content — nothing selected yet. Only ever
 * visible at lg+ (AthletesShell hides the detail column entirely on mobile
 * until an athlete is actually picked, showing the roster full-width
 * there instead), so this doesn't need its own mobile layout.
 */
export default function AthletesIndexPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border p-10 text-center">
      <Users className="size-6 text-muted-foreground" />
      <p className="text-sm font-medium text-foreground">Select an athlete</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        Choose someone from the list to see their programs, progress, and messages.
      </p>
    </div>
  );
}
