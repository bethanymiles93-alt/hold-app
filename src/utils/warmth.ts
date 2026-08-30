import { mixColors } from "@/utils/colorMix";

/**
 * Warmth anchors — reasoned approximations, not sampled/measured (same
 * caveat as DockedInputBar.tsx's own KEYBOARD_BACKDROP constants). Chosen
 * to be close in *lightness* to each mode's own typical background, so a
 * warmth shift reads as a hue nudge, not a brightness change — verified by
 * hand (WCAG contrast against fixed text colours barely moves even at the
 * full extreme, see docs/09-decision-log.md, 2026-08-22) but not yet
 * confirmed on a real device or against every possible background these
 * blend into. Flagged, not assumed safe, per hold-book
 * 04-ux-content/04-navigation-architecture.md's own "WCAG contrast
 * compliance must be verified across the full warmth range" note.
 *
 * The cool anchor was removed entirely 2026-08-30 — per the original
 * warmth research basis, blue-shifted tones are the thing this feature
 * exists to move away from (supporting reduced light sensitivity/
 * photophobia), not a symmetric direction to also offer.
 */
const WARM_ANCHOR_LIGHT = "#EDE0C0";
const WARM_ANCHOR_DARK = "#2A2318";

/**
 * How strongly the old "Warm" option (offset 1 on the old -1..1 scale)
 * blended toward the warm anchor — now baked in as the permanent starting
 * point for every warmth-affected surface, not a selectable position any
 * more (2026-08-30 base-colour change): what used to display as "warm" is
 * now the actual base/default. See docs/09-decision-log.md.
 */
const BASE_WARM_STRENGTH = 0.25;

/**
 * How much further the warmth slider can blend beyond that new baseline,
 * at its own full extent (offset 1) — "existing warm/warm+ positions shift
 * to sit further along the same warm direction from the new baseline," per
 * the confirmed spec. A reasoned choice, not a measured one: kept modest,
 * matching this feature's own "a nudge, not a new colour scheme" framing.
 * Flagged for on-device confirmation like the anchors above.
 */
const SLIDER_BLEND_CAP = 0.35;

/**
 * Nudges one palette colour warmer, in two stages. First, unconditionally,
 * toward the new permanent baseline (formerly the "Warm" option); then
 * further warm still, by `offset` (0 = the new baseline itself, exactly
 * what used to render at the old offset of 1 — 1 = maximum). `offset` is
 * clamped to [0, 1] — no cool direction exists any more. `isDark` picks
 * the matching light/dark anchor so a warmth shift never blends a
 * light-mode colour toward the dark anchor or vice versa.
 */
export function applyWarmth(hex: string, offset: number, isDark: boolean): string {
  const clamped = Math.max(0, Math.min(1, offset));
  const anchor = isDark ? WARM_ANCHOR_DARK : WARM_ANCHOR_LIGHT;

  const baseline = mixColors(hex, anchor, 1 - BASE_WARM_STRENGTH);
  if (clamped === 0) return baseline;

  return mixColors(baseline, anchor, 1 - clamped * SLIDER_BLEND_CAP);
}
