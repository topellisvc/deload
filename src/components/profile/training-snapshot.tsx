import type { ReactNode } from "react";
import Link from "next/link";
import { STYLES } from "@/lib/training-style/recommend-style";
import type { ExperienceLevel, Profile } from "@/lib/supabase/types";

const EXPERIENCE_LABEL: Record<ExperienceLevel, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

interface SnapshotItem {
  label: string;
  value: ReactNode;
}

interface TrainingSnapshotProps {
  profile: Profile;
  currentProgram: { id: string; name: string } | null;
  currentCoachName: string | null;
  isCoach: boolean;
  activeClientCount: number | null;
}

/**
 * A quick-glance summary just below the header — only rows with real
 * data render, per the "only display information that exists" rule.
 * Everything here is either already on the profile row or passed down
 * from queries the page already ran for other sections (current program,
 * coach name, client count), so this component makes no queries of its
 * own.
 */
export function TrainingSnapshot({
  profile,
  currentProgram,
  currentCoachName,
  isCoach,
  activeClientCount,
}: TrainingSnapshotProps) {
  const items: SnapshotItem[] = [];

  if (profile.goal) items.push({ label: "Primary goal", value: profile.goal });

  const style = profile.training_style ? STYLES[profile.training_style as keyof typeof STYLES] : undefined;
  if (style) items.push({ label: "Training style", value: style.name });

  if (profile.experience_level) {
    items.push({ label: "Experience level", value: EXPERIENCE_LABEL[profile.experience_level] });
  }

  if (currentProgram) {
    items.push({
      label: "Current program",
      value: (
        <Link href={`/programs/${currentProgram.id}`} className="text-primary hover:underline">
          {currentProgram.name}
        </Link>
      ),
    });
  }

  if (currentCoachName) items.push({ label: "Current coach", value: currentCoachName });

  if (isCoach) items.push({ label: "Active clients", value: activeClientCount ?? 0 });

  return (
    <div className="rounded-2xl border border-border bg-surface p-6">
      <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-muted-foreground">Training snapshot</h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Fill in your goal and stats below to see them summarized here.
        </p>
      ) : (
        <dl className="flex flex-col divide-y divide-border">
          {items.map((item) => (
            <div key={item.label} className="flex items-center justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
              <dt className="text-sm text-muted-foreground">{item.label}</dt>
              <dd className="text-right text-sm font-medium text-foreground">{item.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
