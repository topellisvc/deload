"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface TimeInputProps {
  label: string;
  hours: string;
  minutes: string;
  seconds: string;
  onChange: (parts: { hours: string; minutes: string; seconds: string }) => void;
  idPrefix: string;
}

/** Three-field H/M/S time entry — far more usable than parsing a colon string. */
export function TimeInput({ label, hours, minutes, seconds, onChange, idPrefix }: TimeInputProps) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={`${idPrefix}-h`}>{label}</Label>
      <div className="grid grid-cols-3 gap-2">
        <div className="relative">
          <Input
            id={`${idPrefix}-h`}
            inputMode="numeric"
            placeholder="0"
            value={hours}
            onChange={(e) => onChange({ hours: e.target.value, minutes, seconds })}
            className="pr-8 text-center"
            aria-label={`${label} - hours`}
          />
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            h
          </span>
        </div>
        <div className="relative">
          <Input
            id={`${idPrefix}-m`}
            inputMode="numeric"
            placeholder="0"
            value={minutes}
            onChange={(e) => onChange({ hours, minutes: e.target.value, seconds })}
            className="pr-8 text-center"
            aria-label={`${label} - minutes`}
          />
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            m
          </span>
        </div>
        <div className="relative">
          <Input
            id={`${idPrefix}-s`}
            inputMode="numeric"
            placeholder="0"
            value={seconds}
            onChange={(e) => onChange({ hours, minutes, seconds: e.target.value })}
            className="pr-8 text-center"
            aria-label={`${label} - seconds`}
          />
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            s
          </span>
        </div>
      </div>
    </div>
  );
}

export function timePartsToSeconds(hours: string, minutes: string, seconds: string): number {
  const h = Number(hours) || 0;
  const m = Number(minutes) || 0;
  const s = Number(seconds) || 0;
  return h * 3600 + m * 60 + s;
}

export function secondsToTimeParts(totalSeconds: number): { hours: string; minutes: string; seconds: string } {
  const total = Math.round(totalSeconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return { hours: String(hours), minutes: String(minutes), seconds: String(seconds) };
}
