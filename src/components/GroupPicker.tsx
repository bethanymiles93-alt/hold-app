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
   * Which Circles' cards are pinned open via their own arrow (independent
   * of send-selection) — see the circle/arrow split below.
   */
  expandedCircleIds?: string[];
  onToggleExpanded?: (circleId: string) => void;
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
 * Pure Circle picker — selection only. Per-person detail (include/exclude,
 * remove, personalise) lives permanently in the merged Going Quiet screen's
 * own per-Circle cards now, not behind a second expand-on-demand mechanism
 * here, so there's exactly one place that interaction happens.
 *
 * Each named Circle is two independent tap targets, not one (2026-08-11):
 * the circle itself (send-selection — audience add/remove for a Circle
 * never sent this session, reselect-to-resend for one that has been) and a
 * separate small arrow beside it (pins the card open/closed independently,
 * without affecting send-selection at all). Tapping one never changes the
 * other's appearance or state.
 */
export function GroupPicker({
  selectedGroupIds,
  onToggle,
  sentCircleIds = [],
  reselectedCircleIds = [],
  onToggleReselected,
  expandedCircleIds = [],
  onToggleExpanded,
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
            const inAudience = selectedGroupIds.includes(group.id);
            const hasSentThisSession = sentCircleIds.includes(group.id);
            const isReselected = reselectedCircleIds.includes(group.id);
            const sentLook = hasSentThisSession && !isReselected;
            const selectedForSending = hasSentThisSession ? isReselected : inAudience;
            const arrowExpanded = expandedCircleIds.includes(group.id);

            return (
              <View key={group.id} style={styles.circleUnit}>
                <AdaptiveCircleChip
                  label={sentLook ? `✓ ${group.name}` : group.name}
                  isSelected={selectedForSending}
                  hasSentThisSession={hasSentThisSession}
                  labelBold={group.isCloseCircle}
                  onPress={() =>
                    hasSentThisSession ? onToggleReselected?.(group.id) : void onToggle(group)
                  }
                  accessibilityLabel={
                    sentLook ? `${group.name}, already sent. Tap to send another message.` : group.name
                  }
                />
                {/* Positioned inside the chip's own right edge, not floating
                    outside it (2026-08-11 correction — on-device, an
                    outside-the-circle arrow read as ambiguous about which
                    circle it belonged to). Absolute within circleUnit, which
                    wraps tightly to the chip's own rendered size, so this
                    works for both the fixed-diameter circle shape and the
                    grow-to-fit pill shape without knowing which one a given
                    label produced. Still an independent Pressable — a small
                    scrim badge behind the glyph keeps it visually distinct
                    from the label text it now sits on top of. */}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${group.name}, ${arrowExpanded ? "hide" : "show"} recipients`}
                  accessibilityState={{ expanded: arrowExpanded }}
                  hitSlop={8}
                  onPress={() => onToggleExpanded?.(group.id)}
                  style={styles.arrowButton}
                >
                  {({ pressed }) => (
                    <View style={[styles.arrowBadge, pressed && styles.arrowPressed]}>
                      <Text style={styles.arrowGlyph}>{arrowExpanded ? "▲" : "▼"}</Text>
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
    // reference this whole sizing pass has been modelled on. Fixed width
    // matching the chip itself so the caption, when it appears, doesn't
    // widen the pinned column.
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
    // Wraps tightly to the chip's own rendered size (no gap/row layout
    // needed any more — the arrow is positioned inside it, not beside it).
    circleUnit: {
      position: "relative",
      alignSelf: "flex-start"
    },
    // A separate tap target overlaid on the chip's own right edge — never
    // merged into the chip's shape or measured-text fit, which knows
    // nothing about this element. top/bottom: 0 gives it the chip's full
    // height as its hit area; hitSlop widens the narrower horizontal
    // dimension to stay at/above the accessible tap-target floor without
    // visually widening the badge itself.
    arrowButton: {
      position: "absolute",
      right: 6,
      top: 0,
      bottom: 0,
      alignItems: "center",
      justifyContent: "center"
    },
    // A small scrim behind the glyph — visual separation from the label
    // text it now sits on top of, without needing to know which of the
    // chip's several fill states (default/selected/sent) is underneath it.
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
