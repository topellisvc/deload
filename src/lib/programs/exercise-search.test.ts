import { describe, expect, it } from "vitest";
import { searchExercises, isNewExerciseName } from "./exercise-search";

describe("searchExercises", () => {
  it("lists a coach's own library entry ahead of the built-in suggestions", async () => {
    const results = await searchExercises("sled", "cardio", [
      { id: null, name: "Backwards Sled Drag", category: "cardio" },
    ]);
    expect(results[0]).toEqual({ id: null, name: "Backwards Sled Drag", category: "cardio" });
    // Built-in "Sled Push" also matches "sled" — both should be present.
    expect(results.map((r) => r.name)).toContain("Sled Push");
  });

  it("doesn't list a library entry twice just because a same-named built-in suggestion exists too", async () => {
    const results = await searchExercises("row", "cardio", [{ id: null, name: "Row Erg", category: "cardio" }]);
    expect(results.filter((r) => r.name === "Row Erg")).toHaveLength(1);
  });

  it("only merges library entries from the matching category", async () => {
    const results = await searchExercises("", "running", [{ id: null, name: "Assault Bike", category: "cardio" }]);
    expect(results.some((r) => r.name === "Assault Bike")).toBe(false);
  });
});

describe("isNewExerciseName", () => {
  it("is false for a name already saved in the coach's library, even though it isn't a built-in suggestion", () => {
    expect(isNewExerciseName("Backwards Sled Drag", "cardio", [{ id: null, name: "Backwards Sled Drag", category: "cardio" }])).toBe(
      false
    );
  });

  it("is true for a genuinely new name", () => {
    expect(isNewExerciseName("Backwards Sled Drag", "cardio", [])).toBe(true);
  });
});
