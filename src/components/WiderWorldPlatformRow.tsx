import { useMemo } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { AdaptiveCircleChip } from "@/components/AdaptiveCircleChip";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";
import { addCustomWiderWorldPlatform } from "@/services/widerWorldContextService";
import type { SelectableWiderWorldPlatform } from "@/services/widerWorldContextService";

interface WiderWorldPlatformRowProps {
  label: string;
  platforms: SelectableWiderWorldPlatform[];
  markedIds: Set<string>;
  onToggle: (platform: SelectableWiderWorldPlatform) => void;
  /** Called after a new custom platform is added to the shared pool, so the caller can refetch and immediately mark it. */
  onAddCustom: (platform: SelectableWiderWorldPlatform) => void;
  /** Marks every currently-visible platform at once. */
  onMarkAll: () => void;
}

/**
 * The inline compact platform row spec'd for Going Quiet/Reconnect (hold-book
 * 04-ux-content/01-core-journeys.md, "not built this pass, flagged not
 * forgotten") — "+"/"All" pinned first, matching the app-wide convention
 * already used for Circle-picker rows, reorder-on-mark (unmarked pills
 * stay at front, marked ones move to the end, since a checklist's own
 * "still needs attention" items are what should stay easiest to find, the
 * closest fit for a checklist to the picker's own "float to front on
 * compose" behaviour). Solid fill for "marked" (confirmed 2026-08-30,
 * matching Reconnect's pre-existing taken-down checklist and tonight's
 * outline-not-done/fill-done checkmark principle), never an outline ring.
 * "+" adds to the shared selectable pool only — same scope as the
 * Settings screen's own "+", not bound to any one Context (confirmed
 * 2026-08-30). See docs/09-decision-log.md.
 */
export function WiderWorldPlatformRow({
  label,
  platforms,
  markedIds,
  onToggle,
  onAddCustom,
  onMarkAll
}: WiderWorldPlatformRowProps) {
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);

  const ordered = useMemo(
    () => [...platforms].sort((a, b) => Number(markedIds.has(a.id)) - Number(markedIds.has(b.id))),
    [platforms, markedIds]
  );

  const addCustom = () => {
    Alert.prompt(
      "Add a platform",
      "e.g. Discord",
      async (name?: string) => {
        const trimmed = name?.trim();
        if (!trimmed) return;
        const custom = await addCustomWiderWorldPlatform(trimmed);
        const created = custom[custom.length - 1];
        if (created) onAddCustom({ id: created.id, name: created.name, kind: "custom" });
      },
      "plain-text"
    );
  };

  if (platforms.length === 0) return null;

  return (
    <View style={styles.block}>
      <Text style={styles.label}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        <Pressable accessibilityRole="button" accessibilityLabel="Add a platform" onPress={addCustom} style={styles.addPill}>
          <Text style={styles.addPillText}>+</Text>
        </Pressable>
        <AdaptiveCircleChip label="All" compact isSelected={false} onPress={onMarkAll} accessibilityLabel="Mark all as done" />
        {ordered.map((platform) => {
          const marked = markedIds.has(platform.id);
          return (
            <AdaptiveCircleChip
              key={platform.id}
              label={platform.name}
              compact
              isSelected={false}
              hasSentThisSession={marked}
              onPress={() => onToggle(platform)}
              accessibilityRole="checkbox"
              accessibilityLabel={
                marked ? `${platform.name}, marked. Tap to unmark.` : `${platform.name}, not marked. Tap to mark.`
              }
            />
          );
        })}
      </ScrollView>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    block: {
      gap: theme.spacing.sm
    },
    label: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: "600"
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm
    },
    addPill: {
      minWidth: 40,
      height: 40,
      borderRadius: 20,
      borderWidth: 1.5,
      borderColor: colors.primary,
      alignItems: "center",
      justifyContent: "center"
    },
    addPillText: {
      color: colors.primary,
      fontSize: 18,
      fontWeight: "600"
    }
  });
}
