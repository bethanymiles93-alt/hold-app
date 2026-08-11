import { useCallback, useMemo, useState } from "react";
import { Link, useFocusEffect } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
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
   * Circle ids sent at least once this Going Quiet session. A sent Circle's
   * chip switches to the sent/checkmark look and its tap meaning changes
   * from "remove from audience" to "toggle reselected" (reopen its card for
   * a further/different send) — removing an already-sent Circle from the
   * audience doesn't undo the message, so that action stops making sense
   * once sending has actually happened.
   */
  sentCircleIds?: string[];
  /** Which sent Circles are currently reselected (card reopened) — meaningless for a Circle not yet sent. */
  reselectedCircleIds?: string[];
  onToggleReselected?: (circleId: string) => void;
  /**
   * The new-Circle name field is controlled by the parent screen, not owned
   * here — every screen shares exactly one DockedInputBar, so "which field
   * is currently active" has to live at the screen level. See
   * docs/09-decision-log.md, 2026-08-10.
   */
  newCircleName: string;
  isNamingActive: boolean;
  onActivateNaming: () => void;
  onCancelNaming: () => void;
  /**
   * Creates the pending Circle from whatever name is passed in (typed, or a
   * tapped suggestion) — owned by the parent screen since the docked bar's
   * suggestion chips (rendered above the keyboard, not inside GroupPicker's
   * own position in the scrollable content) need to trigger the exact same
   * submission. See docs/09-decision-log.md, 2026-08-11.
   */
  onSubmitName: (name: string) => Promise<void>;
}

/**
 * Pure Circle picker — selection only. Per-person detail (include/exclude,
 * remove, personalise) lives permanently in the merged Going Quiet screen's
 * own per-Circle cards now, not behind a second expand-on-demand mechanism
 * here, so there's exactly one place that interaction happens.
 */
export function GroupPicker({
  selectedGroupIds,
  onToggle,
  sentCircleIds = [],
  reselectedCircleIds = [],
  onToggleReselected,
  newCircleName,
  isNamingActive,
  onActivateNaming,
  onCancelNaming,
  onSubmitName
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

  // An empty Circle can never actually be sent to, so "All" only ever
  // gathers/releases the Circles that genuinely have someone in them —
  // otherwise a stray empty Circle (e.g. an unused Close Circle) would get
  // swept in and permanently block Send, which defeats the point of "All"
  // as a shortcut. Individually tapping an empty Circle's own pill still
  // works as before, surfacing the "doesn't have anyone in it yet" prompt.
  const nonEmptyGroups = groups.filter((group) => group.contacts.length > 0);
  const allSelected =
    nonEmptyGroups.length > 0 && nonEmptyGroups.every((group) => selectedGroupIds.includes(group.id));

  const toggleAll = async () => {
    // Skips any already-sent Circle — "All" is an audience shortcut, and
    // removing a sent Circle from the audience doesn't undo its message, so
    // it stays out of reach of this bulk action the same way a single tap
    // on its own chip now does.
    for (const group of nonEmptyGroups) {
      if (sentCircleIds.includes(group.id)) continue;
      if (allSelected === selectedGroupIds.includes(group.id)) {
        await onToggle(group);
      }
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.pinnedRow}>
        <AdaptiveCircleChip
          label="+"
          accessibilityLabel="New Circle"
          accessibilityRole="button"
          expanded={isNamingActive}
          outline
          isSelected={false}
          onPress={() => (isNamingActive ? onCancelNaming() : onActivateNaming())}
        />
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
            const inAudience = selectedGroupIds.includes(group.id);
            const hasSentThisSession = sentCircleIds.includes(group.id);
            const isReselected = reselectedCircleIds.includes(group.id);
            const sentLook = hasSentThisSession && !isReselected;
            const expanded = hasSentThisSession ? isReselected : inAudience;
            // A sent-and-collapsed chip shows the checkmark look instead —
            // no arrow, matching the sent-chip convention everywhere else
            // this pattern exists (Reconnect, Taking Time's update).
            const label = sentLook ? `✓ ${group.name}` : `${group.name} ${expanded ? "▲" : "▼"}`;

            return (
              <AdaptiveCircleChip
                key={group.id}
                label={label}
                isSelected={expanded}
                hasSentThisSession={hasSentThisSession}
                isPrimary={group.isCloseCircle}
                onPress={() =>
                  hasSentThisSession ? onToggleReselected?.(group.id) : void onToggle(group)
                }
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

      {isNamingActive ? (
        <View style={styles.newCircle}>
          <Text style={styles.label}>New Circle</Text>
          <View style={styles.newCircleActions}>
            <Pressable accessibilityRole="button" onPress={onCancelNaming} style={styles.cancelButton}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Create Circle"
              disabled={!newCircleName.trim()}
              onPress={() => void onSubmitName(newCircleName)}
              style={({ pressed }) => [
                styles.addButton,
                pressed && styles.addPressed,
                !newCircleName.trim() && styles.disabled
              ]}
            >
              <Text style={styles.addText}>Add</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <Link href="/settings/circle" asChild>
        <Pressable accessibilityRole="link" style={styles.manageLink}>
          <Text style={styles.manageLinkText}>Manage your Circles</Text>
        </Pressable>
      </Link>
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
      alignItems: "center",
      gap: theme.spacing.sm
    },
    pillScroll: {
      flex: 1
    },
    pillWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm
    },
    prompt: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 21
    },
    newCircle: {
      gap: theme.spacing.sm
    },
    label: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: "600"
    },
    newCircleActions: {
      flexDirection: "row",
      gap: theme.spacing.sm
    },
    cancelButton: {
      minHeight: 54,
      paddingHorizontal: theme.spacing.md,
      alignItems: "center",
      justifyContent: "center"
    },
    cancelText: {
      color: colors.textMuted,
      fontSize: 15,
      fontWeight: "600"
    },
    addButton: {
      minWidth: 72,
      minHeight: 54,
      borderRadius: theme.radius.md,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center"
    },
    addPressed: {
      backgroundColor: colors.primaryPressed
    },
    disabled: {
      opacity: 0.4
    },
    addText: {
      color: colors.onPrimary,
      fontSize: 16,
      fontWeight: "600"
    },
    manageLink: {
      minHeight: 44,
      justifyContent: "center"
    },
    manageLinkText: {
      color: colors.primary,
      fontSize: 15,
      fontWeight: "600"
    }
  });
}
