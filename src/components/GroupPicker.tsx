import { useCallback, useMemo, useState } from "react";
import { useFocusEffect } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";
import { AdaptiveCircleChip } from "@/components/AdaptiveCircleChip";
import { getGroups } from "@/services/circleService";
import type { CircleGroup } from "@/types/hold";

/**
 * Every pending (not-yet-real) Circle's id starts with this — Reconnect uses
 * it to find which of a Hold period's audienceCircles are still pending an
 * "add permanently?" answer, without needing a separate pending-circle list
 * of its own. See docs/09-decision-log.md, 2026-08-10.
 */
export const PENDING_CIRCLE_ID_PREFIX = "pending-";

interface GroupPickerProps {
  selectedGroupIds: string[];
  onToggle: (group: CircleGroup) => Promise<void>;
  /**
   * Circle ids sent at least once this Going Quiet session — drives the
   * chip's sent/checkmark fill only (AdaptiveCircleChip's own
   * hasSentThisSession treatment). Doesn't change what a tap does: sent
   * Circles are never locked (2026-08-11) — tapping one toggles it in/out
   * of the current selection exactly like any other Circle, matching Taking
   * Time's "Send an update" picker (app/return/update.tsx), which this now
   * mirrors. See docs/09-decision-log.md, 2026-08-11.
   */
  sentCircleIds?: string[];
  /**
   * Whether the new-Circle name field (owned entirely by the parent
   * screen's shared DockedInputBar — every screen has exactly one, so "which
   * field is active" lives at the screen level, not here) is currently open.
   * See docs/09-decision-log.md, 2026-08-10.
   */
  isNamingActive: boolean;
  onActivateNaming: () => void;
  /** Re-tapping "+" while already active closes the bar without creating anything — see docs/09-decision-log.md, 2026-08-11. */
  onCancelNaming: () => void;
}

/**
 * Pure Circle picker — selection only. Selecting any subset of Circles is
 * the one audience for the screen's single shared message (2026-08-11 —
 * supersedes the earlier per-Circle-card/reselect/expand-arrow machinery,
 * which existed to solve problems — an independently persisted draft per
 * Circle, a way to view a sent Circle's card without reselecting it — that
 * don't exist any more now every Circle-combination shares one message and
 * one Send action. See docs/09-decision-log.md, 2026-08-11.
 */
export function GroupPicker({
  selectedGroupIds,
  onToggle,
  sentCircleIds = [],
  isNamingActive,
  onActivateNaming,
  onCancelNaming
}: GroupPickerProps) {
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [groups, setGroups] = useState<CircleGroup[]>([]);

  const refresh = useCallback(async () => {
    setGroups(await getGroups());
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  // A pending new Circle is never in `groups` (nothing's been persisted yet),
  // so it can't accidentally trip this storage-backed "empty" check.
  const emptySelectedGroups = groups.filter(
    (group) => selectedGroupIds.includes(group.id) && group.contacts.length === 0
  );

  const allSelected = groups.length > 0 && groups.every((group) => selectedGroupIds.includes(group.id));

  const toggleAll = async () => {
    for (const group of groups) {
      if (allSelected === selectedGroupIds.includes(group.id)) {
        await onToggle(group);
      }
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.pinnedRow}>
        <View style={styles.newCircleStack}>
          <AdaptiveCircleChip
            label="+"
            accessibilityLabel="New Circle"
            accessibilityRole="button"
            expanded={isNamingActive}
            outline
            isSelected={isNamingActive}
            labelFontSize={28}
            onPress={() => (isNamingActive ? onCancelNaming() : onActivateNaming())}
          />
          {isNamingActive ? <Text style={styles.newCircleCaption}>New Circle</Text> : null}
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pillWrap}
          style={styles.pillScroll}
        >
          {groups.length > 0 ? (
            <AdaptiveCircleChip label="All" isSelected={allSelected} onPress={() => void toggleAll()} />
          ) : null}
          {groups.map((group) => {
            const isSelected = selectedGroupIds.includes(group.id);
            const hasSentThisSession = sentCircleIds.includes(group.id);
            const sentLook = hasSentThisSession && !isSelected;

            return (
              <AdaptiveCircleChip
                key={group.id}
                label={sentLook ? `✓ ${group.name}` : group.name}
                isSelected={isSelected}
                hasSentThisSession={hasSentThisSession}
                labelBold={group.isCloseCircle}
                onPress={() => void onToggle(group)}
                accessibilityLabel={
                  sentLook ? `${group.name}, already sent. Tap to send another message.` : group.name
                }
              />
            );
          })}
        </ScrollView>
      </View>

      {emptySelectedGroups.length > 0 ? (
        <Text style={styles.prompt}>
          {emptySelectedGroups.map((group) => group.name).join(", ")} doesn't have anyone in it
          yet. Add someone from Your Circles in Settings before continuing.
        </Text>
      ) : null}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      gap: theme.spacing.md
    },
    // Only the "+" (New Circle) button is fixed, outside the scroll — always
    // visible regardless of scroll position. "All" is the first item inside
    // the nested ScrollView now, alongside the named-Circle pills, since it's
    // only relevant before scrolling and doesn't need to persist once
    // someone's scrolled past it. The whole thing still reads as one
    // continuous line.
    pinnedRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: theme.spacing.sm
    },
    // "+" is a small vertical stack (circle, then its own caption once
    // active) rather than a bare circle — matches the story-circle
    // reference this whole sizing pass has been modelled on.
    newCircleStack: {
      alignItems: "center",
      gap: theme.spacing.xs
    },
    newCircleCaption: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "600",
      textAlign: "center"
    },
    pillScroll: {
      flex: 1
    },
    pillWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md
    },
    prompt: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 21
    }
  });
}
