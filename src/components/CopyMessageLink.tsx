import { useMemo } from "react";
import { Alert, Pressable, StyleSheet, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";
import { copyToClipboard } from "@/services/clipboardService";

interface CopyMessageLinkProps {
  value: string;
}

/**
 * Generic fallback for distribution mechanisms Hold can't reach
 * programmatically — WhatsApp broadcast lists (confirmed: no public
 * API or deep-link format targets one, even a personal list the user
 * already built inside WhatsApp), or any other app's own list/group
 * mechanism. Copies the message so someone with their own broadcast
 * list can paste it there themselves. Always available, not
 * conditional on detecting a broadcast list — there's no way to know
 * one exists. Deliberately secondary/lower-weight than the primary
 * Send action it sits below on every screen that renders it — copy is
 * additive, never presented as the recommended default; the sequential
 * deep-link send stays the default behaviour everywhere. See
 * docs/09-decision-log.md, 2026-08-31.
 */
export function CopyMessageLink({ value }: CopyMessageLinkProps) {
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);
  const disabled = !value.trim();

  const copy = async () => {
    await copyToClipboard(value.trim());
    Alert.alert("Copied", "Paste it wherever you send it — a broadcast list, another app, anywhere else.");
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Copy message"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => void copy()}
      hitSlop={8}
      style={({ pressed }) => [styles.row, disabled && styles.rowDisabled, pressed && styles.pressed]}
    >
      <Ionicons name="copy-outline" size={13} color={colors.textMuted} />
      <Text style={styles.text}>Copy message</Text>
    </Pressable>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs / 2,
      alignSelf: "center",
      paddingVertical: theme.spacing.xs
    },
    rowDisabled: {
      opacity: 0.4
    },
    pressed: {
      opacity: 0.6
    },
    text: {
      fontSize: 12,
      color: colors.textMuted
    }
  });
}
