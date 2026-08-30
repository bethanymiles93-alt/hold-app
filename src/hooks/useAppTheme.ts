import { useMemo } from "react";
import { useColorScheme } from "react-native";
import { palettes, spacing, radius, type ThemeVariant } from "@/constants/theme";
import { useDisplaySettings } from "@/context/DisplaySettingsContext";
import { applyWarmth } from "@/utils/warmth";

export function useAppTheme(variant: ThemeVariant) {
  const systemScheme = useColorScheme();
  const { colorSchemeOverride, warmthOffset } = useDisplaySettings();

  const isDark = colorSchemeOverride === "system" ? systemScheme === "dark" : colorSchemeOverride === "dark";

  const basePalette =
    variant === "quiet"
      ? isDark
        ? palettes.darkQuiet
        : palettes.lightQuiet
      : isDark
        ? palettes.darkNormal
        : palettes.lightNormal;

  // Warmth only nudges the background surfaces — text/border/primary/accent
  // colours are left untouched so contrast ratios computed against them
  // (see src/utils/warmth.ts) stay valid regardless of warmthOffset. Always
  // applied now, even at warmthOffset 0 (2026-08-30) — applyWarmth's own
  // baseline blend is unconditional, since what used to be the selectable
  // "Warm" option is now the actual base colour, not a shift away from it.
  const colors = useMemo(
    () => ({
      ...basePalette,
      background: applyWarmth(basePalette.background, warmthOffset, isDark),
      surface: applyWarmth(basePalette.surface, warmthOffset, isDark),
      surfaceStrong: applyWarmth(basePalette.surfaceStrong, warmthOffset, isDark)
    }),
    [basePalette, warmthOffset, isDark]
  );

  return { colors, spacing, radius, isDark } as const;
}
