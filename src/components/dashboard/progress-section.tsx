import type { LucideIcon } from "lucide-react";
import { Activity, Scale, Target, Trophy } from "lucide-react";
import type { DashboardStats } from "@/lib/dashboard/types";
import type { PersonalRecord, Profile } from "@/lib/supabase/types";

interface ProgressCard {
  label: string;
  value: string;
  icon: LucideIcon;
}

interface ProgressSectionProps {
  stats: DashboardStats;
  records: PersonalRecord[];
  profile: Profile;
}

/**
 * A modular grid of progress cards — reuses the same records (from
 * getPersonalRecords, already built for /profile) and stats this page
 * already fetched, no new tracking. Deliberately just a grid of cards for
 * now so a future chart (bodyweight over time, volume trend) can slot in
 * as one more card here without restructuring the section.
 */
export function ProgressSection({ stats, records, profile }: ProgressSectionProps) {
  const cards: ProgressCard[] = [{ label: "Sessions completed", value: String(stats.sessionCount), icon: Activity }];

  if (stats.completionPercent != null) {
    cards.push({ label: "Program completion", value: `${stats.completionPercent}%`, icon: Target });
  }

  cards.push({ label: "Personal records", value: String(records.length), icon: Trophy });

  if (profile.weight_value != null) {
    cards.push({
      label: "Current bodyweight",
      value: `${profile.weight_value}${profile.weight_unit ?? ""}`,
      icon: Scale,
    });
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-6">
      <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-muted-foreground">Progress</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="flex flex-col gap-1.5 rounded-lg border border-border bg-background p-3.5">
            <card.icon className="size-4 text-primary" />
            <span className="text-lg font-semibold tabular-nums text-foreground">{card.value}</span>
            <span className="text-xs text-muted-foreground">{card.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
