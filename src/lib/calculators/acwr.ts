/**
 * Acute:Chronic Workload Ratio (ACWR).
 *
 * A training-load monitoring method used in sports science to flag when
 * someone's recent training has spiked relative to what they're
 * conditioned for — a well-established (if debated, see below) predictor
 * of non-contact injury risk.
 *
 * Definitions used here (the classic "coupled", rolling-average model from
 * Hulin & Gabbett's original work — the version most widely taught and
 * still the most common in practice):
 *  - Acute load: total training load for the most recent week.
 *  - Chronic load: average weekly load across the most recent 4 weeks
 *    (inclusive of the current week).
 *  - ACWR: acute / chronic.
 *
 * Important limitation, stated plainly rather than buried: the ACWR
 * literature is genuinely contested. Because acute load is mathematically
 * part of chronic load in the coupled model used here, some of the
 * correlation between ACWR and injury is a statistical artifact of that
 * coupling rather than a pure physiological signal (see Impellizzeri et
 * al., 2020, for the fullest critique). Newer "uncoupled" and EWMA-based
 * models exist and partially address this, but the coupled rolling-average
 * model remains the most widely taught and used in practice, which is why
 * we start here. ACWR should inform training decisions, not dictate them.
 */

export const WEEKS_REQUIRED = 4;

export type AcwrZone = "Undertrained" | "Optimal" | "Caution" | "High risk";

export interface AcwrZoneInfo {
  zone: AcwrZone;
  /** Inclusive lower bound of the zone (ratio units), or null for unbounded. */
  min: number | null;
  /** Exclusive upper bound of the zone (ratio units), or null for unbounded. */
  max: number | null;
  description: string;
}

export const ACWR_ZONES: readonly AcwrZoneInfo[] = [
  {
    zone: "Undertrained",
    min: null,
    max: 0.8,
    description:
      "Recent load is well below what this person is conditioned for. Ramping back up too quickly from here can itself create a spike — increase gradually rather than jumping straight back to prior levels.",
  },
  {
    zone: "Optimal",
    min: 0.8,
    max: 1.3,
    description:
      "Recent load is well matched to this person's conditioning. This range is associated with the lowest relative injury risk in the research this method is based on.",
  },
  {
    zone: "Caution",
    min: 1.3,
    max: 1.5,
    description:
      "Recent load is climbing faster than the base it's built on. Not necessarily a problem for one week, but worth watching if it continues.",
  },
  {
    zone: "High risk",
    min: 1.5,
    max: null,
    description:
      "Recent load is substantially higher than this person's recent training history supports. This is the zone most associated with elevated injury risk — consider whether the spike was intentional and planned, or something to pull back from.",
  },
] as const;

export interface AcwrResult {
  acuteLoad: number;
  chronicLoad: number;
  ratio: number;
  zone: AcwrZone;
  zoneDescription: string;
}

/**
 * Compute ACWR from exactly 4 weekly load totals, oldest first, most
 * recent week last. "Load" can be any consistent weekly training-load
 * metric (session-RPE totals, TSS, distance, whatever the person already
 * tracks) — the ratio is unitless as long as the same metric is used for
 * every week.
 */
export function computeAcwr(weeklyLoads: number[]): AcwrResult {
  if (weeklyLoads.length !== WEEKS_REQUIRED) {
    throw new RangeError(`computeAcwr requires exactly ${WEEKS_REQUIRED} weekly load values`);
  }
  if (weeklyLoads.some((load) => !Number.isFinite(load) || load < 0)) {
    throw new RangeError("weekly loads must be non-negative, finite numbers");
  }

  const chronicLoad =
    weeklyLoads.reduce((sum, load) => sum + load, 0) / weeklyLoads.length;
  const acuteLoad = weeklyLoads[weeklyLoads.length - 1] as number;

  if (chronicLoad === 0) {
    throw new RangeError("chronic load cannot be zero — at least one week must have load > 0");
  }

  const ratio = acuteLoad / chronicLoad;
  const zoneInfo = ACWR_ZONES.find(
    (z) => (z.min === null || ratio >= z.min) && (z.max === null || ratio < z.max)
  );

  // Exhaustive by construction (zones cover the full number line), but
  // fall back defensively rather than assert.
  const resolvedZone = zoneInfo ?? ACWR_ZONES[ACWR_ZONES.length - 1]!;

  return {
    acuteLoad,
    chronicLoad,
    ratio,
    zone: resolvedZone.zone,
    zoneDescription: resolvedZone.description,
  };
}
