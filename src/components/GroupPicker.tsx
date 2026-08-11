import { useCallback, useMemo, useState } from "react";
import { useFocusEffect } from "expo-router";
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
  /** Replaces the whole selection atomically — used for "All". See docs/09-decision-log.md, 2026-08-11. */
  onSetSelection: (groups: CircleGroup[]) => void;
  /**
   * Circle ids sent at least once this Going Quiet session — drives the
   * chip's sent/checkmark fill only (AdaptiveCircleChip's own
   * hasSentThisSession treatment). Doesn't change what a tap does: sent
   * Circles are never locked — tapping one toggles it in/out of the current
   * selection exactly like any other Circle.
   */
  sentCircleIds?: string[];
  /**
   * Which one Circle's dropdown (member list) is currently open, if any —
   * a single value, not a set: only one Circle's member list may be open
   * on screen at a time (2026-08-11). Restored after being removed
   * entirely in the prior redesign — its actual purpose (viewing/editing a
   * Circle's own recipients on demand) turned out to still be needed, only
   * the old multi-expand/reselect machinery around it was genuinely
   * obsolete. See docs/09-decision-log.md, 2026-08-11.
   */
  expandedCircleId: string | null;
  onToggleExpanded: (circleId: string) => void;
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
 * Pure Circle picker — selection plus one on-demand member-list dropdown.
 * Selecting any subset of Circles is the audience for the screen's single
 * shared message; the dropdown arrow is a separate, independent action that
 * only reveals/hides that one Circle's recipient list — it never changes
 * selection, and selecting a Circle never auto-reveals its members (both
 * 2026-08-11).
 */
export function GroupPicker({
  selectedGroupIds,
  onToggle,
  onSetSelection,
  sentCircleIds = [],
  expandedCircleId,
  onToggleExpanded,
  isNamingActive,
  onActivateNaming,
  onCancelNaming
}: GroupPickerProps) {
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [groups, setGroups] = useState<CircleGroup[]>([]);
  // Snapshot of whatever was selected right before "All" was tapped —
  // restored exactly on the deselect tap, rather than clearing to empty.
  // Local to this component: purely a UI memory of one specific gesture,
  // not state anything else in the app needs to know about.
  const [preAllSelection, setPreAllSelection] = useState<string[] | null>(null);

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

  // Circles currently selected for the message being typed right now float
  // to the front, so the person can always see who they're messaging
  // without scrolling — recomputed live as selection changes. Everyone else
  // keeps their existing relative order behind them. (2026-08-11 — see
  // docs/09-decision-log.md.)
  const displayGroups = useMemo(() => {
    const active = groups.filter((group) => selectedGroupIds.includes(group.id));
    const rest = groups.filter((group) => !selectedGroupIds.includes(group.id));
    return [...active, ...rest];
  }, [groups, selectedGroupIds]);

  // "All" only ever gathers/releases Circles that genuinely have someone in
  // them — an empty Circle can never actually be sent to, so sweeping it in
  // would permanently block Send. Restored (2026-08-11) after being dropped
  // in the prior redesign's rewrite. Individually tapping an empty Circle's
  // own chip still works, surfacing the "doesn't have anyone in it yet" prompt.
  const nonEmptyGroups = groups.filter((group) => group.contacts.length > 0);
  const allSelected =
    nonEmptyGroups.length > 0 && nonEmptyGroups.every((group) => selectedGroupIds.includes(group.id));

  const toggleAll = () => {
    if (allSelected) {
      // Deselecting — restore exactly whatever was selected before "All"
      // was tapped, not clear to empty.
      const restoreIds = new Set(preAllSelection ?? []);
      onSetSelection(groups.filter((group) => restoreIds.has(group.id)));
      setPreAllSelection(null);
      return;
    }

    // Selecting — remember the current selection so it can be restored
    // later, then select every non-empty Circle, keeping (not dropping)
    // anything already individually selected that "All" itself wouldn't
    // have picked (an already-selected empty Circle, for instance).
    setPreAllSelection(selectedGroupIds);
    const targetIds = new Set([...nonEmptyGroups.map((group) => group.id), ...selectedGroupIds]);
    onSetSelection(groups.filter((group) => targetIds.has(group.id)));
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
            <AdaptiveCircleChip label="All" isSelected={allSelected} onPress={toggleAll} />
          ) : null}
          {displayGroups.map((group) => {
            const isSelected = selectedGroupIds.includes(group.id);
            const hasSentThisSession = sentCircleIds.includes(group.id);
            const sentLook = hasSentThisSession && !isSelected;
            const isExpanded = expandedCircleId === group.id;

            return (
              <View key={group.id} style={styles.circleUnit}>
                <AdaptiveCircleChip
                  label={sentLook ? `✓ ${group.name}` : group.name}
                  isSelected={isSelected}
                  hasSentThisSession={hasSentThisSession}
                  labelBold={group.isCloseCircle}
                  onPress={() => void onToggle(group)}
                  accessibilityLabel={
                    sentLook ? `${group.name}, already sent. Tap to send another message.` : group.name
                  }
                />
                {/* Independent of selection — opens/closes this one Circle's
                    member list, closing any other Circle's list that was
                    open (see onToggleExpanded in the parent screen).
                    Positioned inside the chip's own right edge so it never
                    reads as ambiguous about which circle it belongs to. */}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${group.name}, ${isExpanded ? "hide" : "show"} recipients`}
                  accessibilityState={{ expanded: isExpanded }}
                  hitSlop={8}
                  onPress={() => onToggleExpanded(group.id)}
                  style={styles.arrowButton}
                >
                  {({ pressed }) => (
                    <View style={[styles.arrowBadge, pressed && styles.arrowPressed]}>
                      <Text style={styles.arrowGlyph}>{isExpanded ? "▲" : "▼"}</Text>
                    </View>
                  )}
                </Pressable>
              </View>
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
    pinnedRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: theme.spacing.sm
    },
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
    // Wraps tightly to the chip's own rendered size — the arrow is
    // positioned inside it, not beside it.
    circleUnit: {
      position: "relative",
      alignSelf: "flex-start"
    },
    arrowButton: {
      position: "absolute",
      right: 6,
      top: 0,
      bottom: 0,
      alignItems: "center",
      justifyContent: "center"
    },
    arrowBadge: {
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(0, 0, 0, 0.12)"
    },
    arrowPressed: {
      opacity: 0.6
    },
    arrowGlyph: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: "600"
    },
    prompt: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 21
    }
  });
}
