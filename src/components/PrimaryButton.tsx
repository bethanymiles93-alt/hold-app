import { useMemo } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  accessibilityHint?: string;
}

/**
 * The app's one-time completion action — ends or advances a whole flow
 * (e.g. "Begin Taking Time," Reconnect's final "Done"), used once per visit,
 * never a repeated per-item action. Deliberately no icon: this is the app's
 * one restful, non-achievement moment, and an icon here (filled circle,
 * moon, etc.) would collide with symbols already meaningful elsewhere
 * (Circle iconography, the moon-cycle overlay) and add action-energy a
 * completion screen is meant not to have. See CompactSendButton for the
 * repeated/per-item counterpart (Going Quiet, Reconnect, Taking Time's
 * update, Conversations) — a different, smaller shape entirely, not a
 * smaller version of this one. See docs/09-decision-log.md, 2026-08-10.
 */
export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  accessibilityHint
}: PrimaryButtonProps) {
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={accessibilityHint}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled
      ]}
    >
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    button: {
      minHeight: 56,
      // Full pill, not theme.radius.md's rounded-rectangle — matches every
      // other "strong"/filled element in the app (Close Circle's chip, sent
      // chips, every pill-shaped selectable), which all use theme.radius.pill.
      // The rounded-rectangle language was the one inconsistency reading as
      // dated against everything else. No new radius value: reusing
      // theme.radius.pill, already established.
      borderRadius: theme.radius.pill,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: theme.spacing.lg,
      // Real side margins rather than spanning edge-to-edge of its
      // (already-padded) container — a completion button should read as an
      // object placed on the screen, not a bar filling it.
      marginHorizontal: theme.spacing.lg
    },
    pressed: {
      backgroundColor: colors.primaryPressed
    },
    disabled: {
      opacity: 0.45
    },
    label: {
      color: colors.onPrimary,
      fontSize: 19,
      fontWeight: "600"
    }
  });
}
