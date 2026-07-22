import { BODY_FAT_CATEGORIES, type BiologicalSex } from "@/lib/calculators/body-fat";
import { cn } from "@/lib/utils";

interface BodyFatScaleProps {
  sex: BiologicalSex;
  bodyFatPercent: number;
}

// Bounds used only to size the visual scale — wide enough to comfortably
// contain the full category table for both sexes without the marker
// crowding either edge.
const SCALE_MIN = 0;
const SCALE_MAX = 40;

/** A horizontal scale showing where the estimate lands across categories. */
export function BodyFatScale({ sex, bodyFatPercent }: BodyFatScaleProps) {
  const categories = BODY_FAT_CATEGORIES[sex];
  const markerPct = Math.min(
    Math.max(((bodyFatPercent - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * 100, 0),
    100
  );

  return (
    <div className="flex flex-col gap-2 border-t border-border pt-4">
      <div className="relative h-3 w-full overflow-hidden rounded-full">
        <div className="flex h-full w-full">
          {categories.map((category) => {
            const lower = category.min ?? SCALE_MIN;
            const upper = category.max ?? SCALE_MAX;
            const widthPct = ((upper - lower) / (SCALE_MAX - SCALE_MIN)) * 100;
            return (
              <div
                key={category.label}
                style={{ width: `${widthPct}%` }}
                className={cn(
                  category.label === "Essential fat" && "bg-zone-endurance/40",
                  category.label === "Athletes" && "bg-success/60",
                  category.label === "Fitness" && "bg-success/30",
                  category.label === "Average" && "bg-warning/40",
                  category.label === "Obese" && "bg-danger/40"
                )}
              />
            );
          })}
        </div>
        <div
          className="absolute top-0 h-full w-1 -translate-x-1/2 bg-foreground"
          style={{ left: `${markerPct}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        {categories.map((category) => (
          <span key={category.label}>{category.label}</span>
        ))}
      </div>
    </div>
  );
}
