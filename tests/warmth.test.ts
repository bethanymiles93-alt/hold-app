import { describe, expect, it } from "vitest";
import { applyWarmth } from "../src/utils/warmth";

describe("applyWarmth", () => {
  it("returns the input unchanged at offset 0", () => {
    expect(applyWarmth("#F4F0E8", 0, false)).toBe("#F4F0E8");
  });

  it("shifts toward the light warm anchor on a positive offset", () => {
    const result = applyWarmth("#F4F0E8", 1, false);
    expect(result).not.toBe("#F4F0E8");
    // Warm anchor (#EDE0C0) has less blue than the original — a positive
    // offset should pull the blue channel down.
    const originalBlue = parseInt("E8", 16);
    const resultBlue = parseInt(result.slice(5, 7), 16);
    expect(resultBlue).toBeLessThan(originalBlue);
  });

  it("shifts toward the light cool anchor on a negative offset", () => {
    const result = applyWarmth("#F4F0E8", -1, false);
    expect(result).not.toBe("#F4F0E8");
    // Cool anchor (#D8E2ED) has more blue than the original — a negative
    // offset should pull the blue channel up.
    const originalBlue = parseInt("E8", 16);
    const resultBlue = parseInt(result.slice(5, 7), 16);
    expect(resultBlue).toBeGreaterThan(originalBlue);
  });

  it("uses the dark anchor pair when isDark is true", () => {
    const lightResult = applyWarmth("#1B1F1C", 1, false);
    const darkResult = applyWarmth("#1B1F1C", 1, true);
    expect(lightResult).not.toBe(darkResult);
  });

  it("clamps offsets beyond [-1, 1] to the same result as the extreme", () => {
    expect(applyWarmth("#F4F0E8", 5, false)).toBe(applyWarmth("#F4F0E8", 1, false));
    expect(applyWarmth("#F4F0E8", -5, false)).toBe(applyWarmth("#F4F0E8", -1, false));
  });

  it("a smaller offset blends less strongly than a larger one, same direction", () => {
    const small = applyWarmth("#F4F0E8", 0.25, false);
    const large = applyWarmth("#F4F0E8", 1, false);
    const originalBlue = parseInt("E8", 16);
    const smallBlue = parseInt(small.slice(5, 7), 16);
    const largeBlue = parseInt(large.slice(5, 7), 16);
    expect(largeBlue).toBeLessThan(smallBlue);
    expect(smallBlue).toBeLessThan(originalBlue);
  });
});
