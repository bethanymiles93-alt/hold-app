import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";
import { SecondaryButton } from "@/components/SecondaryButton";

interface RemovalPromptSuggestionProps {
  personName: string;
  circleName: string;
  onRemove: () => void;
  onDecline: () => void;
}

/**
 * Gentle, easily-declinable follow-on to the excluded-person frozen-audience
 * fix (2026-08-30) — someone excluded from this period's Going Quiet send is
 * only ever excluded for that one round by default (`buildAudienceCircles`'
 * own confirmed, on-record scoping: the permanent Circle is never touched
 * just by excluding someone this round). This surfaces the separate,
 * optional question of whether the exclusion should actually become
 * permanent, one person at a time, low-pressure — not a nag or an
 * outstanding to-do, matching `MemoryNoteSuggestion`'s own established
 * "calm suggestion card" convention rather than a blocking Alert. Declining
 * or ignoring changes nothing: the permanent Circle stays untouched either
 * way, and this same person is included again by default next time. See
 * docs/09-decision-log.md.
 */
export function RemovalPromptSuggestion({ personName, circleName, onRemove, onDecline }: RemovalPromptSuggestionProps) {
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <Text style={styles.text}>{`Remove ${personName} from ${circleName} going forward?`}</Text>
      <View style={styles.actions}>
        <SecondaryButton label="Remove" onPress={onRemove} />
        <Pressable accessibilityRole="button" onPress={onDecline}>
          <Text style={styles.declineText}>No</Text>
        </Pressable>
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      gap: theme.spacing.xs,
      padding: theme.spacing.md,
      borderRadius: theme.radius.md,
      backgroundColor: colors.surfaceStrong
    },
    text: {
      color: colors.text,
      fontSize: 15,
      lineHeight: 21
    },
    actions: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
      marginTop: theme.spacing.xs
    },
    declineText: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: "600"
    }
  });
}
