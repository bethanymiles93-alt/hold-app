import { useCallback, useMemo, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";
import { AdaptiveCircleChip } from "@/components/AdaptiveCircleChip";
import { DropdownArrowBadge } from "@/components/DropdownArrowBadge";
import { getGroups, PENDING_CIRCLE_ID_PREFIX } from "@/services/circleService";
import type { CircleGroup } from "@/types/hold";

/** Re-exported for existing call sites — moved to circleService.ts, 2026-08-20, see there. */
export { PENDING_CIRCLE_ID_PREFIX };

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
  /**
   * Whether the Circle currently being created will deliver as one shared
   * group thread instead of individual/BCC-style messages (default false —
   * individual). See docs/09-decision-log.md, 2026-08-11.
   */
  sendAsGroupDraft: boolean;
  onToggleSendAsGroupDraft: (value: boolean) => void;
  /**
   * True once the person has moved from circle-selection into the text box
   * (the shared docked bar is open for the group message) — the ONLY
   * moment the row reorders (active Circles to the front) and un-selected
   * ones grey out. Before that point, selection can be freely adjusted
   * with no reordering or greying, however many taps it takes (2026-08-11
   * — corrects the earlier version, which reordered/greyed on every single
   * tap). See docs/09-decision-log.md.
   */
  isComposing: boolean;
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
  onCancelNaming,
  sendAsGroupDraft,
  onToggleSendAsGroupDraft,
  isComposing
}: GroupPickerProps) {
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [groups, setGroups] = useState<CircleGroup[]>([]);
  // Snapshot of whatever was selected right before "All" was tapped —
  // restored exactly on the deselect tap, rather than clearing to empty.
  // Local to this component: purely a UI memory of one specific gesture,
  // not state anything else in the app needs to know about.
  const [preAllSelection, setPreAllSelection] = useState<string[] | null>(null);
  // Frozen the moment composing starts — the row's display order and
  // grey-out both key off this snapshot, not the live selection, so
  // further edits to the message don't cause the row to keep jumping
  // around. Released back to null once composing ends. See
  // docs/09-decision-log.md, 2026-08-11.
  const [composingActiveIds, setComposingActiveIds] = useState<string[] | null>(null);

  if (isComposing && composingActiveIds === null) {
    setComposingActiveIds(selectedGroupIds);
  } else if (!isComposing && composingActiveIds !== null) {
    setComposingActiveIds(null);
  }

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

  // Reorder + grey-out only ever apply once composing has actually started
  // (isComposing, frozen into composingActiveIds above) — never on a bare
  // selection tap. Before that point the row keeps its natural order and
  // full-opacity look regardless of how selection changes. (2026-08-11,
  // corrects the earlier version which reordered live on every tap.)
  const displayGroups = useMemo(() => {
    if (composingActiveIds === null) return groups;

    const activeIds = new Set(composingActiveIds);
    const active = groups.filter((group) => activeIds.has(group.id));
    const rest = groups.filter((group) => !activeIds.has(group.id));
    return [...active, ...rest];
  }, [groups, composingActiveIds]);

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
          {isNamingActive ? (
            <>
              <Text style={styles.newCircleCaption}>New Circle</Text>
              <View style={styles.sendAsGroupRow}>
                <Text style={styles.sendAsGroupLabel}>Send as group</Text>
                <Switch
                  accessibilityLabel="Send as one shared group message instead of individually"
                  value={sendAsGroupDraft}
                  onValueChange={onToggleSendAsGroupDraft}
                  trackColor={{ true: colors.primary, false: colors.border }}
                />
              </View>
            </>
          ) : null}
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
            const isGreyedOut = composingActiveIds !== null && !composingActiveIds.includes(group.id);

            return (
              <View key={group.id} style={[styles.circleUnit, isGreyedOut && styles.circleUnitGreyed]}>
                <AdaptiveCircleChip
                  label={group.name}
                  isSelected={isSelected}
                  hasSentThisSession={hasSentThisSession}
                  labelBold={group.isCloseCircle}
                  provisional={group.id.startsWith(PENDING_CIRCLE_ID_PREFIX)}
                  onPress={() => void onToggle(group)}
                  accessibilityLabel={
                    sentLook
                      ? `${group.name}, already sent. Tap to send another message.`
                      : group.id.startsWith(PENDING_CIRCLE_ID_PREFIX)
                        ? `${group.name}, a temporary Circle`
                        : group.name
                  }
                />
                {/* Independent of selection — opens/closes this one Circle's
                    member list, closing any other Circle's list that was
                    open (see onToggleExpanded in the parent screen).
                    Positioned inside the chip's own right edge so it never
                    reads as ambiguous about which circle it belongs to.
                    Core (Close) never gets this arrow at all, in-flow, no
                    exceptions — a deliberate capability restriction, not a
                    default-hidden state: Core should always be messaged,
                    with no in-the-moment choice to exclude it while
                    unwell. Stays fully editable in Manage Circles. See
                    docs/09-decision-log.md, 2026-08-29. */}
                {!group.isCloseCircle ? (
                  <DropdownArrowBadge
                    expanded={isExpanded}
                    checked={sentLook}
                    onPress={() => onToggleExpanded(group.id)}
                    accessibilityLabel={
                      sentLook
                        ? `${group.name}, already sent. ${isExpanded ? "Hide" : "Show"} recipients.`
                        : `${group.name}, ${isExpanded ? "hide" : "show"} recipients`
                    }
                    style={styles.arrowButton}
                  />
                ) : null}
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
    // "Individual" is the default and unlabelled (matches how most
    // Circles will stay) — only the "group" state needs a visible toggle.
    // Deliberately narrow, matching the pinned "+" column's own width, so
    // it doesn't force the pinned area wider than the chip itself.
    sendAsGroupRow: {
      alignItems: "center",
      gap: 2
    },
    sendAsGroupLabel: {
      color: colors.textMuted,
      fontSize: 11,
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
    // Reorder + grey-out only while composing (see composingActiveIds) —
    // a plain opacity reduction, not a separate colour treatment, so it
    // reads as "temporarily out of focus" rather than any other chip state
    // (selected/sent) it might be confused with.
    circleUnitGreyed: {
      opacity: 0.4
    },
    // Positioned toward the BOTTOM of the circle, not vertically centred —
    // centred (the original placement) put it directly over the centred
    // label text for any name long enough to need the space (2026-08-11
    // fix). That same fix rejected growing the diameter further, on-device
    // testing later showed repositioning alone didn't hold (still
    // overlapped the circle's true edge and the label text) — reopened,
    // diameter grown a fifth time, and this offset increased alongside it
    // (see STANDARD_CHIP_DIAMETER's own comment in AdaptiveCircleChip.tsx
    // for the full reasoning, including why the offset had to move too,
    // not just the diameter). 2026-08-29, item 8.
    arrowButton: {
      position: "absolute",
      right: 10,
      bottom: 12,
      alignItems: "center",
      justifyContent: "center"
    },
    prompt: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 21
    }
  });
}
