interface MacroBarProps {
  proteinKcal: number;
  fatKcal: number;
  carbKcal: number;
}

/** A single stacked bar showing the calorie share of each macro at a glance. */
export function MacroBar({ proteinKcal, fatKcal, carbKcal }: MacroBarProps) {
  const total = Math.max(proteinKcal + fatKcal + carbKcal, 1);
  const proteinPct = (proteinKcal / total) * 100;
  const fatPct = (fatKcal / total) * 100;
  const carbPct = (carbKcal / total) * 100;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-primary" style={{ width: `${proteinPct}%` }} />
        <div className="h-full bg-warning" style={{ width: `${fatPct}%` }} />
        <div className="h-full bg-success" style={{ width: `${carbPct}%` }} />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-primary" />
          Protein {Math.round(proteinPct)}%
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-warning" />
          Fat {Math.round(fatPct)}%
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-success" />
          Carbs {Math.round(carbPct)}%
        </span>
      </div>
    </div>
  );
}
