import { useColorScheme } from "react-native";
import { palettes, spacing, radius, type ThemeVariant } from "@/constants/theme";

export function useAppTheme(variant: ThemeVariant) {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";

  const colors =
    variant === "quiet"
      ? isDark
        ? palettes.darkQuiet
        : palettes.lightQuiet
      : isDark
        ? palettes.darkNormal
        : palettes.lightNormal;

  return { colors, spacing, radius, isDark } as const;
}
