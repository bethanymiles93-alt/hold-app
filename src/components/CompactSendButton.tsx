import { Ionicons } from "@expo/vector-icons";
import { Platform, Pressable, StyleSheet, Text } from "react-native";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";

interface CompactSendButtonProps {
  onPress: () => void;
  disabled?: boolean;
  /** Defaults to "Send" — override for a more specific announcement (e.g. "Send to Book Club"), since icon-only mode carries no visible label of its own. */
  accessibilityLabel?: string;
  /**
   * Optional visible text shown beside the icon, e.g. "3 people" — turns
   * the button from a plain icon-only circle into a pill. Reserved for the
   * one call site (Quick message's per-Circle bulk Send) where the reach
   * count is useful, neutral, confirmatory information worth showing
   * on-screen, not just in accessibilityLabel — most call sites should
   * leave this unset and stay icon-only, per the app's repeated/per-item
   * button pattern (see docs/09-decision-log.md, 2026-08-10).
   */
  label?: string;
}

/**
 * Icon-only (or icon+label, see `label`) Send for a REPEATED, per-item
 * action — select a circle/person, tap Send, repeat (Going Quiet,
 * Reconnect, Taking Time's update, Conversations' Quick message and
 * Personalise). Distinct from PrimaryButton, which is reserved for a
 * one-time completion action ending or advancing a whole flow.
 *
 * Same 44pt (iOS) / 48pt (Android) accessible tap-target floor as
 * AdaptiveCircleChip, regardless of how compact the icon itself reads
 * visually — this button is deliberately smaller than the Circle chips
 * (which grew to 64pt/68dp, 2026-08-10), not a scaled-down version of them.
 * A standard paper-plane glyph (Ionicons "send"), not a custom icon —
 * legibility and instant recognition over novelty.
 */
const TAP_TARGET = Platform.OS === "android" ? 48 : 44;
const ICON_SIZE = 18;

export function CompactSendButton({
  onPress,
  disabled = false,
  accessibilityLabel = "Send",
  label
}: CompactSendButtonProps) {
  const { colors } = useAppTheme("normal");
  const styles = createStyles(colors);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        label ? styles.buttonWithLabel : styles.buttonIconOnly,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled
      ]}
    >
      <Ionicons name="send" size={ICON_SIZE} color={colors.onPrimary} />
      {label ? (
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
      ) : null}
    </Pressable>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    button: {
      height: TAP_TARGET,
      borderRadius: TAP_TARGET / 2,
      backgroundColor: colors.primary,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center"
    },
    // Ionicons' "send" glyph isn't perfectly optically centred in its own
    // box (the paper plane leans right) — nudged to read as centred. Only
    // needed for the plain circle; once there's a label beside it, the row
    // layout already centres both naturally.
    buttonIconOnly: {
      width: TAP_TARGET,
      paddingLeft: 2
    },
    buttonWithLabel: {
      minWidth: TAP_TARGET,
      paddingHorizontal: theme.spacing.md,
      gap: theme.spacing.xs
    },
    pressed: {
      backgroundColor: colors.primaryPressed
    },
    disabled: {
      opacity: 0.45
    },
    label: {
      color: colors.onPrimary,
      fontSize: 15,
      fontWeight: "600"
    }
  });
}
