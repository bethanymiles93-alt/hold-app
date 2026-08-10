import { Ionicons } from "@expo/vector-icons";
import { Platform, Pressable, StyleSheet } from "react-native";
import type { ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";

interface CompactSendButtonProps {
  onPress: () => void;
  disabled?: boolean;
  /** Defaults to "Send" — override for a more specific announcement (e.g. "Send to Book Club"), since this is icon-only and carries no visible label of its own. */
  accessibilityLabel?: string;
}

/**
 * Icon-only Send for a REPEATED, per-item action — select a circle/person,
 * tap Send, repeat (Going Quiet, Reconnect, Taking Time's update,
 * Conversations' Quick message and Personalise). Distinct from
 * PrimaryButton, which is reserved for a one-time completion action ending
 * or advancing a whole flow — see docs/09-decision-log.md, 2026-08-10.
 *
 * Same 44pt (iOS) / 48pt (Android) accessible tap-target floor as
 * AdaptiveCircleChip, regardless of how compact the icon itself reads
 * visually. A standard paper-plane glyph (Ionicons "send"), not a custom
 * icon — legibility and instant recognition over novelty.
 */
const TAP_TARGET = Platform.OS === "android" ? 48 : 44;
const ICON_SIZE = 18;

export function CompactSendButton({
  onPress,
  disabled = false,
  accessibilityLabel = "Send"
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
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled
      ]}
    >
      <Ionicons name="send" size={ICON_SIZE} color={colors.onPrimary} />
    </Pressable>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    button: {
      width: TAP_TARGET,
      height: TAP_TARGET,
      borderRadius: TAP_TARGET / 2,
      backgroundColor: colors.primary,
      alignItems: "center",
      // Ionicons' "send" glyph isn't perfectly optically centred in its own
      // box (the paper plane leans right) — nudged to read as centred.
      justifyContent: "center",
      paddingLeft: 2
    },
    pressed: {
      backgroundColor: colors.primaryPressed
    },
    disabled: {
      opacity: 0.45
    }
  });
}
