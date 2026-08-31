import { useMemo } from "react";
import { useColorScheme } from "react-native";
import { palettes, spacing, radius, type ThemeVariant } from "@/constants/theme";
import { useDisplaySettings } from "@/context/DisplaySettingsContext";
import { applyWarmth } from "@/utils/warmth";
import { applyDisplayTheme } from "@/utils/displayThemeColors";

export function useAppTheme(variant: ThemeVariant) {
  const systemScheme = useColorScheme();
  const { colorSchemeOverride, warmthOffset, displayTheme } = useDisplaySettings();

  const isDark = colorSchemeOverride === "system" ? systemScheme === "dark" : colorSchemeOverride === "dark";

  const basePalette =
    variant === "quiet"
      ? isDark
        ? palettes.darkQuiet
        : palettes.lightQuiet
      : isDark
        ? palettes.darkNormal
        : palettes.lightNormal;

  // Warmth and display theme both only ever nudge the background surfaces
  // — text/border/primary/accent colours are left untouched so contrast
  // ratios computed against them (see warmth.ts/displayThemeColors.ts)
  // stay valid regardless of either setting. Warmth is always applied
  // first (2026-08-30, its own baseline blend is unconditional), then
  // display theme composes on top of that result (2026-08-31) — both are
  // no-ops (return the input unchanged) at their own defaults, so this
  // degrades to the plain base palette exactly as before when neither is
  // set.
  const colors = useMemo(() => {
    const warmed = {
      background: applyWarmth(basePalette.background, warmthOffset, isDark),
      surface: applyWarmth(basePalette.surface, warmthOffset, isDark),
      surfaceStrong: applyWarmth(basePalette.surfaceStrong, warmthOffset, isDark)
    };

    return {
      ...basePalette,
      background: applyDisplayTheme(warmed.background, displayTheme, isDark),
      surface: applyDisplayTheme(warmed.surface, displayTheme, isDark),
      surfaceStrong: applyDisplayTheme(warmed.surfaceStrong, displayTheme, isDark)
    };
  }, [basePalette, warmthOffset, displayTheme, isDark]);

  return { colors, spacing, radius, isDark } as const;
}
