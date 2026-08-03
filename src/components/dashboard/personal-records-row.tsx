import Link from "next/link";
import { Dumbbell } from "lucide-react";
import { RECORD_TYPES } from "@/lib/profile/personal-records";
import type { PersonalRecord } from "@/lib/supabase/types";

/**
 * A slim row of the 4 main-lift PRs (mockups Ellis shared) — bench/squat/
 * deadlift/overhead press specifically, via RECORD_TYPES' existing strength
 * entries, not every record in `records`. That's deliberate: `records`
 * (getPersonalRecords) also carries one `exercise:<id>`-keyed row per
 * exercise with a tested/known max (see prescription-types.ts's
 * exerciseMaxRecordType) — potentially dozens for an established program —
 * which has nowhere near enough room in a one-line row and no exercise name
 * attached to it without a second query. The full library of those already
 * has a real home: /profile's "Exercise max library" section. "View all
 * PRs" links there rather than duplicating it here.
 */
export function PersonalRecordsRow({ records }: { records: PersonalRecord[] }) {
  const mainLifts = RECORD_TYPES.filter((rt) => rt.category === "strength")
    .map((rt) => ({ def: rt, record: records.find((r) => r.record_type === rt.type) }))
    .filter((entry): entry is { def: (typeof RECORD_TYPES)[number]; record: PersonalRecord } => entry.record != null);

  return (
    <div className="rounded-2xl border border-border bg-surface p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Personal records</h2>
        <Link href="/profile" className="text-xs font-medium text-primary hover:underline">
          View all PRs
        </Link>
      </div>

      {mainLifts.length === 0 ? (
        <p className="text-sm text-muted-foreground">No main-lift maxes on record yet — log a testing-week set or enter one from the program builder.</p>
      ) : (
        <div className="flex flex-wrap gap-6">
          {mainLifts.map(({ def, record }) => (
            <div key={def.type} className="flex items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Dumbbell className="size-4" />
              </span>
              <div className="flex flex-col">
                <span className="text-sm font-semibold tabular-nums text-foreground">
                  {record.value_number}
                  {record.unit}
                </span>
                <span className="text-xs text-muted-foreground">{def.label}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
