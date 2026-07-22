"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DistanceUnit } from "@/lib/calculators/running-pace";

interface PaceInputProps {
  label: string;
  minutes: string;
  seconds: string;
  unit: DistanceUnit;
  onChange: (parts: { minutes: string; seconds: string }) => void;
  idPrefix: string;
}

/** M:SS pace entry per km or mile — paces are always well under an hour. */
export function PaceInput({ label, minutes, seconds, unit, onChange, idPrefix }: PaceInputProps) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={`${idPrefix}-m`}>{label}</Label>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Input
            id={`${idPrefix}-m`}
            inputMode="numeric"
            placeholder="0"
            value={minutes}
            onChange={(e) => onChange({ minutes: e.target.value, seconds })}
            className="pr-8 text-center"
            aria-label={`${label} - minutes`}
          />
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            m
          </span>
        </div>
        <span className="text-muted-foreground">:</span>
        <div className="relative flex-1">
          <Input
            id={`${idPrefix}-s`}
            inputMode="numeric"
            placeholder="0"
            value={seconds}
            onChange={(e) => onChange({ minutes, seconds: e.target.value })}
            className="pr-8 text-center"
            aria-label={`${label} - seconds`}
          />
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            s
          </span>
        </div>
        <span className="shrink-0 text-sm text-muted-foreground">/{unit}</span>
      </div>
    </div>
  );
}

export function pacePartsToSeconds(minutes: string, seconds: string): number {
  const m = Number(minutes) || 0;
  const s = Number(seconds) || 0;
  return m * 60 + s;
}

export function secondsToPaceParts(totalSeconds: number): { minutes: string; seconds: string } {
  const total = Math.round(totalSeconds);
  return { minutes: String(Math.floor(total / 60)), seconds: String(total % 60) };
}
