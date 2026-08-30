import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";

interface AiIdleNudgeProps {
  /**
   * Current text-box value — idle is measured against this changing, not
   * wall-clock time alone: typing resets the clock, and also clears an
   * earlier dismissal, so a fresh stall later in the same session can
   * surface the nudge again ("resurface on a future occasion," not a
   * one-time "don't show again").
   */
  value: string;
  /** Milliseconds of no change before the nudge appears. A reasoned default, not measured/tested — flag for tuning if 15s reads as too eager or too slow on-device. */
  idleMs?: number;
}

const DEFAULT_IDLE_MS = 15000;

/**
 * Free-tier AI-discovery nudge (2026-08-30) — reverses the earlier plan of
 * a persistent "AI" indicator shown next to every text box. Purely
 * time-based (idle on a text box), never content-based, and deliberately
 * shares no code, component, or state with `SafeguardingBanner` — that one
 * is content-triggered, non-dismissible, and exists for a completely
 * different (safety) reason; the two must never be confused with each
 * other in code or in what the person sees. A plain statement, not a
 * question, matching the app's existing statements-not-questions voice
 * rule. Dismiss is per-instance only (component state, not persisted) —
 * no "don't show again," and a fresh stall later can surface it again.
 * Low-friction, non-blocking: no forced navigation anywhere, tapping the
 * text itself does nothing beyond what dismissing already does. See
 * docs/09-decision-log.md.
 */
export function AiIdleNudge({ value, idleMs = DEFAULT_IDLE_MS }: AiIdleNudgeProps) {
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setDismissed(false);
    setVisible(false);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setVisible(true), idleMs);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [value, idleMs]);

  if (!visible || dismissed) return null;

  return (
    <View style={styles.container} accessibilityRole="text">
      <Text style={styles.text}>AI help is available with Hold+ if you'd like it.</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Dismiss" onPress={() => setDismissed(true)} hitSlop={8}>
        <Text style={styles.dismissText}>Dismiss</Text>
      </Pressable>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      paddingHorizontal: theme.spacing.sm,
      borderRadius: theme.radius.md,
      backgroundColor: colors.surface
    },
    text: {
      flex: 1,
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 18
    },
    dismissText: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: "600"
    }
  });
}
