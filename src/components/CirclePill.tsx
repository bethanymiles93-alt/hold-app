import { useMemo } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";

interface CirclePillProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** Close Circle's stronger/primary fill, per the app's Circle-picker convention. */
  isPrimary?: boolean;
  accessibilityRole?: "checkbox" | "button";
}

/**
 * The one Circle-pill treatment used everywhere a Circle can be picked —
 * compact sage/green fill (stronger for Close Circle, softer otherwise),
 * dark border on selection rather than a colour swap. Shared rather than
 * redefined per screen so sizing/colour drift (e.g. an oversized pill from
 * a screen's own ad-hoc styles) isn't possible.
 */
export function CirclePill({
  label,
  selected,
  onPress,
  isPrimary = false,
  accessibilityRole = "checkbox"
}: CirclePillProps) {
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Pressable
      accessibilityRole={accessibilityRole}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={[styles.pill, isPrimary ? styles.pillPrimary : styles.pillSecondary, selected && styles.pillSelected]}
    >
      <Text style={[styles.pillText, isPrimary ? styles.pillTextPrimary : styles.pillTextSecondary]}>
        {label}
      </Text>
    </Pressable>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    pill: {
      minHeight: 38,
      borderRadius: theme.radius.pill,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: theme.spacing.md
    },
    pillPrimary: {
      backgroundColor: colors.primary
    },
    pillSecondary: {
      backgroundColor: colors.surfaceStrong
    },
    pillSelected: {
      borderWidth: 2,
      borderColor: colors.text
    },
    pillText: {
      fontSize: 14,
      fontWeight: "600"
    },
    pillTextPrimary: {
      color: colors.onPrimary
    },
    pillTextSecondary: {
      color: colors.primary
    }
  });
}
