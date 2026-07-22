/**
 * Running pace, splits, and race-time prediction.
 *
 * Three quantities — distance, time, and pace — are related by a single
 * identity (time = distance x pace), so given any two, the third is fixed.
 * All internal math works in kilometers and seconds; unit conversion for
 * display happens at the edges.
 *
 * Race time prediction uses Riegel's formula (Riegel, 1977, "Athletic
 * Records and Human Endurance"): T2 = T1 x (D2/D1)^1.06. It's a widely used
 * approximation, not a law of physiology — it assumes broadly similar
 * training and fitness across both distances, and gets less reliable the
 * further apart the two distances are (predicting a marathon from a 5K
 * time is a much bigger extrapolation than predicting a 10K from a 5K).
 * We disclose that rather than presenting every predicted time as equally
 * trustworthy.
 */

export type DistanceUnit = "km" | "mi";

const MI_TO_KM = 1.609344;

export function convertDistance(value: number, from: DistanceUnit, to: DistanceUnit): number {
  if (from === to) return value;
  return from === "km" ? value / MI_TO_KM : value * MI_TO_KM;
}

export interface StandardDistance {
  id: string;
  label: string;
  km: number;
}

export const STANDARD_DISTANCES: readonly StandardDistance[] = [
  { id: "mile", label: "1 mile", km: 1.609344 },
  { id: "5k", label: "5K", km: 5 },
  { id: "10k", label: "10K", km: 10 },
  { id: "half", label: "Half marathon", km: 21.0975 },
  { id: "marathon", label: "Marathon", km: 42.195 },
] as const;

/** Riegel's fatigue-factor exponent — the standard, widely cited value. */
const RIEGEL_EXPONENT = 1.06;

/** How far apart (as a distance ratio) a prediction is considered reliable vs. a rough extrapolation. */
const RELIABLE_RATIO_MAX = 3;

export function computePaceSecondsPerKm(distanceKm: number, timeSeconds: number): number {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0)
    throw new RangeError("distanceKm must be a positive, finite number");
  if (!Number.isFinite(timeSeconds) || timeSeconds <= 0)
    throw new RangeError("timeSeconds must be a positive, finite number");
  return timeSeconds / distanceKm;
}

export function computeTimeSeconds(distanceKm: number, paceSecondsPerKm: number): number {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0)
    throw new RangeError("distanceKm must be a positive, finite number");
  if (!Number.isFinite(paceSecondsPerKm) || paceSecondsPerKm <= 0)
    throw new RangeError("paceSecondsPerKm must be a positive, finite number");
  return distanceKm * paceSecondsPerKm;
}

export function computeDistanceKm(timeSeconds: number, paceSecondsPerKm: number): number {
  if (!Number.isFinite(timeSeconds) || timeSeconds <= 0)
    throw new RangeError("timeSeconds must be a positive, finite number");
  if (!Number.isFinite(paceSecondsPerKm) || paceSecondsPerKm <= 0)
    throw new RangeError("paceSecondsPerKm must be a positive, finite number");
  return timeSeconds / paceSecondsPerKm;
}

export interface SplitRow {
  /** 1-indexed marker number (km or mile 1, 2, 3...). */
  marker: number;
  /** Distance covered at this marker, in the split unit — equal to `marker` except possibly the final partial segment. */
  distance: number;
  /** Cumulative elapsed time in seconds at this marker. */
  cumulativeSeconds: number;
}

/**
 * Even-pace split markers at every whole km or mile, plus a final partial
 * segment if the total distance isn't a whole number of split units.
 */
export function generateSplits(
  distanceKm: number,
  timeSeconds: number,
  splitUnit: DistanceUnit
): SplitRow[] {
  const paceSecondsPerKm = computePaceSecondsPerKm(distanceKm, timeSeconds);
  const totalInSplitUnit = convertDistance(distanceKm, "km", splitUnit);
  const paceSecondsPerSplitUnit =
    splitUnit === "km" ? paceSecondsPerKm : paceSecondsPerKm * MI_TO_KM;

  const rows: SplitRow[] = [];
  const wholeMarkers = Math.floor(totalInSplitUnit + 1e-9);

  for (let marker = 1; marker <= wholeMarkers; marker++) {
    rows.push({
      marker,
      distance: marker,
      cumulativeSeconds: marker * paceSecondsPerSplitUnit,
    });
  }

  const remainder = totalInSplitUnit - wholeMarkers;
  if (remainder > 1e-6) {
    rows.push({
      marker: wholeMarkers + 1,
      distance: totalInSplitUnit,
      cumulativeSeconds: timeSeconds,
    });
  }

  return rows;
}

export interface RacePrediction {
  distance: StandardDistance;
  predictedSeconds: number;
  predictedPaceSecondsPerKm: number;
  /** False when the target distance is a large extrapolation from the known result. */
  isReliable: boolean;
}

/**
 * Predicts finish times at every standard distance from one known
 * (distance, time) result, using Riegel's formula. Includes the known
 * distance itself in the output (predicted = actual) so the UI can show
 * a consistent table.
 */
export function predictRaceTimes(knownDistanceKm: number, knownTimeSeconds: number): RacePrediction[] {
  if (!Number.isFinite(knownDistanceKm) || knownDistanceKm <= 0)
    throw new RangeError("knownDistanceKm must be a positive, finite number");
  if (!Number.isFinite(knownTimeSeconds) || knownTimeSeconds <= 0)
    throw new RangeError("knownTimeSeconds must be a positive, finite number");

  return STANDARD_DISTANCES.map((distance) => {
    const ratio = distance.km / knownDistanceKm;
    const predictedSeconds = knownTimeSeconds * Math.pow(ratio, RIEGEL_EXPONENT);
    const extrapolationRatio = Math.max(ratio, 1 / ratio);
    return {
      distance,
      predictedSeconds,
      predictedPaceSecondsPerKm: predictedSeconds / distance.km,
      isReliable: extrapolationRatio <= RELIABLE_RATIO_MAX,
    };
  });
}

/** Formats seconds as H:MM:SS or M:SS, trimming a leading zero hour. */
export function formatDuration(totalSeconds: number): string {
  const seconds = Math.round(totalSeconds);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** Formats a per-km or per-mile pace (seconds) as M:SS. */
export function formatPace(secondsPerUnit: number): string {
  const seconds = Math.round(secondsPerUnit);
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
