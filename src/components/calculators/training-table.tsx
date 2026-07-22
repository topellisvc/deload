import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { roundToIncrement, type TrainingTableRow, type TrainingZone, type WeightUnit } from "@/lib/calculators/one-rep-max";
import { cn } from "@/lib/utils";

interface TrainingTableProps {
  rows: TrainingTableRow[];
  unit: WeightUnit;
}

const ZONE_STYLES: Record<TrainingZone, string> = {
  "Max Strength": "bg-zone-strength/15 text-zone-strength",
  Strength: "bg-zone-strength/15 text-zone-strength",
  "Strength & Hypertrophy": "bg-zone-hypertrophy/15 text-zone-hypertrophy",
  Hypertrophy: "bg-zone-hypertrophy/15 text-zone-hypertrophy",
  "Muscular Endurance": "bg-zone-endurance/15 text-zone-endurance",
};

/**
 * Turns a single 1RM estimate into an actionable training reference: what
 * to load the bar with at every percentage, and the rep range and training
 * zone that percentage typically supports. This is the part that makes the
 * tool a decision aid rather than a party-trick number.
 */
export function TrainingTable({ rows, unit }: TrainingTableProps) {
  const increment = unit === "kg" ? 0.5 : 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Training percentages</CardTitle>
        <CardDescription>
          Suggested load and typical rep range at each percentage of your
          estimated max.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-t border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="px-6 py-3 font-medium">
                  %1RM
                </th>
                <th scope="col" className="px-6 py-3 font-medium">
                  Load
                </th>
                <th scope="col" className="px-6 py-3 font-medium">
                  Typical reps
                </th>
                <th scope="col" className="px-6 py-3 font-medium">
                  Training zone
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.percentage} className="border-t border-border">
                  <td className="px-6 py-3 font-mono tabular-nums text-foreground">
                    {row.percentage}%
                  </td>
                  <td className="px-6 py-3 font-mono tabular-nums text-foreground">
                    {roundToIncrement(row.weight, increment)} {unit}
                  </td>
                  <td className="px-6 py-3 text-muted-foreground">{row.repRange}</td>
                  <td className="px-6 py-3">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                        ZONE_STYLES[row.zone]
                      )}
                    >
                      {row.zone}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
