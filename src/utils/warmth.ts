import { mixColors } from "@/utils/colorMix";

/**
 * Warmth bar anchors — reasoned approximations, not sampled/measured (same
 * caveat as DockedInputBar.tsx's own KEYBOARD_BACKDROP constants). Chosen
 * to be close in *lightness* to each mode's own typical background, so a
 * warmth shift reads as a hue nudge, not a brightness change — verified by
 * hand (WCAG contrast against fixed text colours barely moves even at the
 * full ±1 extreme, see docs/09-decision-log.md, 2026-08-22) but not yet
 * confirmed on a real device or against every possible background these
 * blend into. Flagged, not assumed safe, per hold-book
 * 04-ux-content/04-navigation-architecture.md's own "WCAG contrast
 * compliance must be verified across the full warmth range" note.
 */
const WARM_ANCHOR_LIGHT = "#EDE0C0";
const COOL_ANCHOR_LIGHT = "#D8E2ED";
const WARM_ANCHOR_DARK = "#2A2318";
const COOL_ANCHOR_DARK = "#161C24";

/**
 * How strongly the warmth bar can shift a colour at its extremes — a
 * relative offset on top of the existing palette, never an independent
 * override, per the confirmed spec. Kept deliberately low: this is a
 * *nudge*, not a new colour scheme.
 */
const WARMTH_BLEND_CAP = 0.25;

/**
 * Nudges one palette colour warmer (positive offset) or cooler (negative),
 * relative to whatever colour it already is. `offset` is clamped to
 * [-1, 1]; `isDark` picks the matching light/dark anchor pair so a warmth
 * shift never blends a light-mode colour toward a dark anchor or vice
 * versa. Returns the input unchanged at offset 0.
 */
export function applyWarmth(hex: string, offset: number, isDark: boolean): string {
  const clamped = Math.max(-1, Math.min(1, offset));
  if (clamped === 0) return hex;

  const warmAnchor = isDark ? WARM_ANCHOR_DARK : WARM_ANCHOR_LIGHT;
  const coolAnchor = isDark ? COOL_ANCHOR_DARK : COOL_ANCHOR_LIGHT;
  const anchor = clamped > 0 ? warmAnchor : coolAnchor;
  const strength = Math.abs(clamped) * WARMTH_BLEND_CAP;

  return mixColors(hex, anchor, 1 - strength);
}
