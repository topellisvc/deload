import { describe, expect, it } from "vitest";
import {
  STANDARD_DISTANCES,
  computeDistanceKm,
  computePaceSecondsPerKm,
  computeTimeSeconds,
  convertDistance,
  formatDuration,
  formatPace,
  generateSplits,
  predictRaceTimes,
} from "./running-pace";

describe("convertDistance", () => {
  it("converts km to miles and back", () => {
    expect(convertDistance(10, "km", "mi")).toBeCloseTo(6.21371, 4);
    expect(convertDistance(convertDistance(10, "km", "mi"), "mi", "km")).toBeCloseTo(10, 5);
  });
});

describe("computePaceSecondsPerKm / computeTimeSeconds / computeDistanceKm", () => {
  it("round-trips distance -> pace -> time -> distance consistently", () => {
    const distanceKm = 10;
    const timeSeconds = 3000; // 50:00 for 10K -> 5:00/km
    const pace = computePaceSecondsPerKm(distanceKm, timeSeconds);
    expect(pace).toBeCloseTo(300, 5);

    const recoveredTime = computeTimeSeconds(distanceKm, pace);
    expect(recoveredTime).toBeCloseTo(timeSeconds, 5);

    const recoveredDistance = computeDistanceKm(timeSeconds, pace);
    expect(recoveredDistance).toBeCloseTo(distanceKm, 5);
  });

  it("rejects non-positive or non-finite inputs", () => {
    expect(() => computePaceSecondsPerKm(0, 100)).toThrow(RangeError);
    expect(() => computePaceSecondsPerKm(10, 0)).toThrow(RangeError);
    expect(() => computeTimeSeconds(-5, 300)).toThrow(RangeError);
    expect(() => computeDistanceKm(100, -1)).toThrow(RangeError);
  });
});

describe("generateSplits", () => {
  it("generates one row per whole km with no partial segment for an exact distance", () => {
    // 5km at 5:00/km = 25:00 total
    const splits = generateSplits(5, 25 * 60, "km");
    expect(splits).toHaveLength(5);
    expect(splits[0]!.cumulativeSeconds).toBeCloseTo(300, 5);
    expect(splits[4]!.cumulativeSeconds).toBeCloseTo(1500, 5);
    expect(splits[4]!.distance).toBe(5);
  });

  it("adds a final partial segment for a non-whole distance", () => {
    // 5.3km total
    const splits = generateSplits(5.3, 5.3 * 300, "km");
    expect(splits).toHaveLength(6);
    expect(splits[5]!.distance).toBeCloseTo(5.3, 5);
    expect(splits[5]!.cumulativeSeconds).toBeCloseTo(5.3 * 300, 3);
  });

  it("converts correctly when generating mile splits from a km distance", () => {
    // 10km ~= 6.2137 miles
    const splits = generateSplits(10, 3000, "mi");
    expect(splits).toHaveLength(7); // 6 whole miles + partial
    expect(splits[5]!.marker).toBe(6);
    const last = splits[splits.length - 1]!;
    expect(last.cumulativeSeconds).toBeCloseTo(3000, 3);
  });
});

describe("predictRaceTimes", () => {
  it("predicts the same time for the known distance itself (ratio = 1)", () => {
    const predictions = predictRaceTimes(5, 1200); // 5K in 20:00
    const fiveK = predictions.find((p) => p.distance.id === "5k")!;
    expect(fiveK.predictedSeconds).toBeCloseTo(1200, 3);
    expect(fiveK.isReliable).toBe(true);
  });

  it("predicts a slower per-km pace for longer distances (Riegel fatigue factor)", () => {
    const predictions = predictRaceTimes(5, 1200); // 5K in 20:00 -> 4:00/km
    const marathon = predictions.find((p) => p.distance.id === "marathon")!;
    expect(marathon.predictedPaceSecondsPerKm).toBeGreaterThan(240);
  });

  it("flags very large extrapolations as unreliable", () => {
    // Predicting a marathon from a mile time is a huge extrapolation.
    const predictions = predictRaceTimes(1.609344, 240); // mile in 4:00
    const marathon = predictions.find((p) => p.distance.id === "marathon")!;
    expect(marathon.isReliable).toBe(false);
  });

  it("marks nearby distances as reliable", () => {
    const predictions = predictRaceTimes(10, 2400); // 10K in 40:00
    const fiveK = predictions.find((p) => p.distance.id === "5k")!;
    expect(fiveK.isReliable).toBe(true);
  });

  it("returns one prediction per standard distance", () => {
    const predictions = predictRaceTimes(5, 1200);
    expect(predictions).toHaveLength(STANDARD_DISTANCES.length);
  });

  it("rejects invalid inputs", () => {
    expect(() => predictRaceTimes(0, 1200)).toThrow(RangeError);
    expect(() => predictRaceTimes(5, -1)).toThrow(RangeError);
  });
});

describe("formatDuration", () => {
  it("formats sub-hour durations as M:SS", () => {
    expect(formatDuration(125)).toBe("2:05");
  });

  it("formats hour-plus durations as H:MM:SS", () => {
    expect(formatDuration(3725)).toBe("1:02:05");
  });
});

describe("formatPace", () => {
  it("formats seconds-per-unit as M:SS", () => {
    expect(formatPace(305)).toBe("5:05");
    expect(formatPace(59)).toBe("0:59");
  });
});
