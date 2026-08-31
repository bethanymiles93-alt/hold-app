import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";
import { getCircleLastSentMessage } from "@/services/circleLastSentMessageService";

interface CircleLastSentMessageProps {
  circleId: string;
  onInsert: (text: string) => void;
}

/**
 * Read-only preview of the last message actually sent to this Circle,
 * shown inside its own expanded dropdown — see
 * circleLastSentMessageService.ts. Never auto-inserted: a down-arrow is
 * the only way it reaches the compose box, same no-auto-insert rule
 * Template already follows, and for the same reason — a message that was
 * true when it was sent can go stale (a Circle told "not feeling well,
 * need time" three weeks ago may not still be accurate), so bringing it
 * back in has to be a conscious, editable choice, never something that
 * could go back out unedited and unintended. Insertion reuses the shared
 * highlighted-insertion mechanic (green on insert, reverts if edited),
 * via the caller's own `pendingInsert`-style wiring — no separate
 * toggle-revert button here, matching how MemoryNoteSuggestion and the
 * Conversations last-sent feature already reuse the same mechanic. See
 * docs/09-decision-log.md, 2026-08-31.
 */
export function CircleLastSentMessage({ circleId, onInsert }: CircleLastSentMessageProps) {
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getCircleLastSentMessage(circleId).then((value) => {
      if (!cancelled) setText(value);
    });
    return () => {
      cancelled = true;
    };
  }, [circleId]);

  if (!text) return null;

  return (
    <View style={styles.row}>
      <View style={styles.textBox}>
        <Text style={styles.label}>Last sent</Text>
        <Text style={styles.text} numberOfLines={3}>
          {text}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Insert last sent message"
        onPress={() => onInsert(text)}
        hitSlop={8}
        style={({ pressed }) => [styles.insertButton, pressed && styles.pressed]}
      >
        <Ionicons name="arrow-down-circle-outline" size={22} color={colors.link} />
      </Pressable>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      padding: theme.spacing.sm,
      borderRadius: theme.radius.md,
      backgroundColor: colors.surfaceStrong
    },
    textBox: {
      flex: 1,
      gap: 2
    },
    label: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "600"
    },
    text: {
      color: colors.text,
      fontSize: 14,
      lineHeight: 19
    },
    insertButton: {
      padding: theme.spacing.xs
    },
    pressed: {
      opacity: 0.6
    }
  });
}
