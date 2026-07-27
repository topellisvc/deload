import { describe, it, expect } from "vitest";
import { calculateReadingTimeMinutes } from "./reading-time";

describe("calculateReadingTimeMinutes", () => {
  it("returns 1 minute for an empty or very short body", () => {
    expect(calculateReadingTimeMinutes("")).toBe(1);
    expect(calculateReadingTimeMinutes("Just a few words here.")).toBe(1);
  });

  it("scales roughly linearly with word count", () => {
    const words = Array(450).fill("word").join(" "); // 2x the 225 wpm baseline
    expect(calculateReadingTimeMinutes(words)).toBe(2);
  });

  it("strips markdown syntax so it isn't counted as words", () => {
    const markdown = "# Heading\n\n- one\n- two\n- three\n\n> a quote\n\n| a | b |\n|---|---|\n| 1 | 2 |";
    const plainEquivalent = "Heading one two three a quote a b 1 2";
    expect(calculateReadingTimeMinutes(markdown)).toBe(calculateReadingTimeMinutes(plainEquivalent));
  });

  it("counts link text but not the URL, and strips images entirely", () => {
    const withLink = calculateReadingTimeMinutes("Check out [this great resource](https://example.com/very/long/path) today.");
    const linkTextOnly = calculateReadingTimeMinutes("Check out this great resource today.");
    expect(withLink).toBe(linkTextOnly);

    const withImage = calculateReadingTimeMinutes("Some text ![alt text](https://example.com/image.png) more text.");
    expect(withImage).toBe(calculateReadingTimeMinutes("Some text  more text."));
  });
});
