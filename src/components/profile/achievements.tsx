import { ACHIEVEMENTS } from "@/lib/profile/achievements";
import type { AchievementInput } from "@/lib/profile/achievements";
import { cn } from "@/lib/utils";

interface AchievementsProps {
  input: AchievementInput;
}

/** Every card is derived live from `input` (session/program counts,
 * account age) — see lib/profile/achievements.ts. Locked ones just render
 * greyed out rather than being hidden, so there's always something to
 * work toward. */
export function Achievements({ input }: AchievementsProps) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-6">
      <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-muted-foreground">Achievements</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {ACHIEVEMENTS.map((achievement) => {
          const Icon = achievement.icon;
          const unlocked = achievement.check(input);
          return (
            <div
              key={achievement.id}
              title={achievement.description}
              className={cn(
                "flex flex-col items-center gap-2 rounded-xl border p-4 text-center",
                unlocked ? "border-primary/30 bg-primary/5" : "border-border bg-muted opacity-50"
              )}
            >
              <Icon className={cn("size-5", unlocked ? "text-primary" : "text-muted-foreground")} />
              <span className="text-xs font-medium text-foreground">{achievement.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
