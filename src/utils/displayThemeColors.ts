import { mixColors } from "@/utils/colorMix";
import type { DisplayTheme } from "@/services/displaySettingsService";

/**
 * Real colours for Beach/Forest/Meadow (2026-08-31) — hold-book itself
 * flags these as needing "their own design pass" before being more than a
 * stored preference (04-navigation-architecture.md); this is a reasoned
 * first pass, not a tested visual identity, flagged the same way as this
 * file's own warmth.ts precedent. Follows that exact same established,
 * safe pattern rather than inventing a new one: background/surface fills
 * only, text/border/primary/accent colours untouched, so contrast
 * guarantees already verified for the base palette carry over unchanged —
 * a theme is a background tint, never an independent palette override.
 * Combined worst case (full warmth + full theme strength together, the
 * two layers that actually stack) hand-verified against the WCAG
 * formula 2026-08-31 — see warmth.ts's own docblock for the numbers;
 * tightest result 8.18:1, still comfortably clear of the 4.5:1 AA
 * floor.
 *
 * **Seasonal deliberately excluded, not just unfinished.** It's a
 * different KIND of feature from the other three (a fixed environment) —
 * it implies auto-rotating by time of year, which needs real date-based
 * logic this pass doesn't build, not just an anchor colour. Stays
 * disabled with its own "Coming later" tag rather than shipping a static
 * colour under a name that promises rotation.
 */
const THEME_ANCHORS: Record<Exclude<DisplayTheme, "default" | "seasonal">, { light: string; dark: string }> = {
  beach: { light: "#A9D6E5", dark: "#1C3A45" },
  forest: { light: "#4A6B4E", dark: "#16241A" },
  meadow: { light: "#D9E0A0", dark: "#2A3018" }
};

const THEME_BLEND_STRENGTH = 0.3;

/** Returns `hex` unchanged for "default" and "seasonal" — the caller doesn't need its own branch for "is this theme actually built." */
export function applyDisplayTheme(hex: string, theme: DisplayTheme, isDark: boolean): string {
  if (theme === "default" || theme === "seasonal") return hex;

  const anchor = isDark ? THEME_ANCHORS[theme].dark : THEME_ANCHORS[theme].light;
  return mixColors(hex, anchor, 1 - THEME_BLEND_STRENGTH);
}
