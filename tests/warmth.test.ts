import { describe, expect, it } from "vitest";
import { applyWarmth } from "../src/utils/warmth";

describe("applyWarmth", () => {
  it("always shifts toward the warm anchor, even at offset 0 (the new base)", () => {
    const result = applyWarmth("#F4F0E8", 0, false);
    expect(result).not.toBe("#F4F0E8");
    // Warm anchor (#EDE0C0) has less blue than the original — the
    // baseline blend alone should already pull the blue channel down.
    const originalBlue = parseInt("E8", 16);
    const resultBlue = parseInt(result.slice(5, 7), 16);
    expect(resultBlue).toBeLessThan(originalBlue);
  });

  it("shifts further warm still as offset increases beyond 0", () => {
    const base = applyWarmth("#F4F0E8", 0, false);
    const shifted = applyWarmth("#F4F0E8", 1, false);
    expect(shifted).not.toBe(base);
    const baseBlue = parseInt(base.slice(5, 7), 16);
    const shiftedBlue = parseInt(shifted.slice(5, 7), 16);
    expect(shiftedBlue).toBeLessThan(baseBlue);
  });

  it("uses the dark anchor pair when isDark is true", () => {
    const lightResult = applyWarmth("#1B1F1C", 1, false);
    const darkResult = applyWarmth("#1B1F1C", 1, true);
    expect(lightResult).not.toBe(darkResult);
  });

  it("clamps offsets beyond [0, 1] to the same result as the nearer extreme", () => {
    expect(applyWarmth("#F4F0E8", 5, false)).toBe(applyWarmth("#F4F0E8", 1, false));
    expect(applyWarmth("#F4F0E8", -5, false)).toBe(applyWarmth("#F4F0E8", 0, false));
  });

  it("a smaller offset blends less strongly than a larger one, same direction", () => {
    const small = applyWarmth("#F4F0E8", 0.25, false);
    const large = applyWarmth("#F4F0E8", 1, false);
    const baseBlue = parseInt(applyWarmth("#F4F0E8", 0, false).slice(5, 7), 16);
    const smallBlue = parseInt(small.slice(5, 7), 16);
    const largeBlue = parseInt(large.slice(5, 7), 16);
    expect(largeBlue).toBeLessThan(smallBlue);
    expect(smallBlue).toBeLessThan(baseBlue);
  });
});
