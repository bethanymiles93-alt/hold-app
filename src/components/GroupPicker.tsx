import { useCallback, useMemo, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { palettes, theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";
import { AdaptiveCircleChip } from "@/components/AdaptiveCircleChip";
import { DropdownArrowBadge } from "@/components/DropdownArrowBadge";
import { getGroups, PENDING_CIRCLE_ID_PREFIX } from "@/services/circleService";
import type { CircleGroup } from "@/types/hold";

/**
 * Fixed, not theme-resolved — the coach-mark bubble deliberately doesn't
 * flip with dark mode the way colors.primary would (which is a light
 * green in dark mode, meant for on-dark accents/buttons, not as a
 * self-contained backdrop). A coach-mark is a distinct guidance layer
 * floating over the real UI, not a themed surface, so it stays Hold's own
 * dark green/white pair unconditionally — same convention as a fixed dark
 * tooltip regardless of the host app's own light/dark state. Alpha (CC,
 * ~80%) chosen so contrast against white text still clears WCAG's 4.5:1
 * even blended over a worst-case near-white backdrop (hand-verified:
 * ~5.3:1 at this alpha against pure white, comfortably above the
 * threshold) — the screen behind stays visibly readable through it while
 * text on the bubble itself stays unambiguous. See docs/09-decision-log.md,
 * 2026-08-30.
 */
const HINT_BUBBLE_COLOR = `${palettes.lightNormal.primary}CC`;
const HINT_TEXT_COLOR = palettes.lightNormal.onPrimary;

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
  /**
   * First-run-only exception to Core's own no-arrow-ever rule above —
   * confirmed directly, not a reopening of that rule: temporarily unlocks
   * Core's arrow for the very first Going Quiet visit, gated by the
   * caller on both a persisted "seen" flag and Core actually being empty.
   * Tapping it in this state calls `onCoreOnboardingAdd` (opens the
   * contact picker directly, same as anywhere else Core gets populated)
   * rather than the normal `onToggleExpanded` — an empty Circle has
   * nothing to reveal a member list for. See docs/09-decision-log.md,
   * 2026-08-30.
   */
  showCoreOnboardingHint?: boolean;
  onCoreOnboardingAdd?: () => void;
  onDismissCoreOnboardingHint?: () => void;
  /**
   * Second, sequential coach-mark — only ever shown once Core's own hint
   * above is done (dismissed or completed), pointing at "+ New Circle"
   * instead. Unlike Core's hint, it doesn't intercept the "+" chip's own
   * press behaviour (that already does the right thing — opens naming);
   * tapping it just also fires the dismiss, same one-shot "seen" flag
   * pattern. See docs/09-decision-log.md, 2026-08-30.
   */
  showNewCircleOnboardingHint?: boolean;
  onDismissNewCircleOnboardingHint?: () => void;
  /**
   * "Adjust" mode (owned by the parent screen — a plain bold-on-tap toggle,
   * no dedicated UI here) — non-Core dropdown arrows only render while this
   * is on, generalising Core's own always-locked rule to every Circle:
   * membership shouldn't be one accidental tap away mid-flow, it takes a
   * deliberate mode switch first. "+ New Circle" is unaffected either way —
   * creating a Circle was never gated by this. Core's own first-run hint
   * (showCoreOnboardingHint) is independent of Adjust entirely — it's a
   * separate, one-shot exception that doesn't need Adjust on to appear. See
   * docs/09-decision-log.md, 2026-08-30.
   */
  adjustMode?: boolean;
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
  isComposing,
  showCoreOnboardingHint = false,
  onCoreOnboardingAdd,
  onDismissCoreOnboardingHint,
  showNewCircleOnboardingHint = false,
  onDismissNewCircleOnboardingHint,
  adjustMode = false
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
    const fetched = await getGroups();
    // An empty Circle is hidden from this selectable list entirely — same
    // logic as any empty suggested/starter circle (e.g. the pre-seeded
    // Friends circle before it has its first contact) — except Core
    // (Close), which always shows even empty, since it can't be deleted
    // and needs a visible way to be populated in the first place. See
    // docs/09-decision-log.md, 2026-08-30.
    setGroups(fetched.filter((group) => group.isCloseCircle || group.contacts.length > 0));
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
            onPress={() => {
              if (showNewCircleOnboardingHint) onDismissNewCircleOnboardingHint?.();
              isNamingActive ? onCancelNaming() : onActivateNaming();
            }}
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
          {/* Gated to 2+ non-empty Circles (2026-08-30 fix, confirmed
              on-device — was `groups.length > 0`, which meant "All" showed
              with just Core alone present, since Core always survives the
              empty-Circle filter above). Matches the same rule already
              applied in Manage Circles: with only one Circle to act on,
              "All" is redundant with tapping that Circle's own chip
              directly. See docs/09-decision-log.md. */}
          {nonEmptyGroups.length >= 2 ? (
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
                    Core (Close) never gets this arrow in-flow, with one
                    narrow, first-run-only exception (showCoreOnboardingHint,
                    confirmed 2026-08-30) — every session after the first
                    one, this reverts to the unconditional lock: Core should
                    always be messaged, with no in-the-moment choice to
                    exclude it while unwell. Every OTHER Circle's own arrow
                    is now gated the same way behind "Adjust" (adjustMode,
                    2026-08-30) — off by default each session, so membership
                    isn't one accidental tap away mid-flow. Stays fully
                    editable in Manage Circles regardless of Adjust's state.
                    See docs/09-decision-log.md, 2026-08-29. */}
                {!group.isCloseCircle && adjustMode ? (
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
                ) : group.isCloseCircle && showCoreOnboardingHint ? (
                  <DropdownArrowBadge
                    expanded={false}
                    onPress={() => onCoreOnboardingAdd?.()}
                    accessibilityLabel="Add the people who matter most to Core"
                    style={styles.arrowButton}
                  />
                ) : group.isCloseCircle ? (
                  // Core's own arrow, every session after the first — unlike
                  // every other Circle's arrow, never gated behind Adjust,
                  // since it only ever opens a READ-ONLY view (see
                  // people.tsx's own expandedGroup rendering: Core renders
                  // a plain, untappable member line, never
                  // RecipientPersonalisation). Reassurance, not editing —
                  // seeing who's included without being able to change it
                  // here carries none of the "in-the-moment exclusion"
                  // risk Core's own lock exists to prevent, so it doesn't
                  // need the same guard. See docs/09-decision-log.md,
                  // 2026-08-31.
                  <DropdownArrowBadge
                    expanded={isExpanded}
                    onPress={() => onToggleExpanded(group.id)}
                    accessibilityLabel={`Core, ${isExpanded ? "hide" : "show"} who's included`}
                    style={styles.arrowButton}
                  />
                ) : null}
              </View>
            );
          })}
        </ScrollView>
      </View>

      {/*
       * Both coach-marks render OUTSIDE pinnedRow's own flex flow entirely
       * (2026-08-30, fixes a real on-device bug — see docs/09-decision-log.md)
       * — previously each was a normal flex row/column participant sharing
       * space with the pinnedRow's own flex:1 ScrollView, which is a known
       * Yoga trap: a flex:1 Text inside an otherwise shrink-to-fit bubble
       * has no real space to resolve against, so it collapsed toward zero
       * width (Core's message text disappeared entirely) or got starved to
       * a sliver (New Circle's text wrapped 2-3 letters at a time). Being
       * entangled in that same row also corrupted the row's own resolved
       * layout badly enough to break touch-targets for unrelated siblings
       * within it (the "+" chip not persisting a tap, Adjust's arrows not
       * rendering) — both confirmed on-device, not assumed collateral.
       * `position: "absolute"` removes both bubbles from that flex
       * computation altogether: each has its own fixed, self-determined
       * width and can never influence pinnedRow's own layout again.
       */}
      {showCoreOnboardingHint ? (
        <View style={styles.hintOverlay} pointerEvents="box-none">
          <View style={[styles.hintAnchor, styles.coreHintAnchor]} pointerEvents="box-none">
            <View style={styles.hintPointer} />
            <View style={styles.hintBubble}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Dismiss"
                onPress={() => onDismissCoreOnboardingHint?.()}
                hitSlop={8}
                style={styles.hintDismiss}
              >
                <Text style={styles.hintDismissText}>Skip</Text>
              </Pressable>
              <Text style={styles.hintText}>Add the people who matter most here.</Text>
            </View>
          </View>
        </View>
      ) : null}

      {showNewCircleOnboardingHint ? (
        <View style={styles.hintOverlay} pointerEvents="box-none">
          <View style={[styles.hintAnchor, styles.newCircleHintAnchor]} pointerEvents="box-none">
            <View style={styles.hintPointer} />
            <View style={styles.hintBubble}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Dismiss"
                onPress={() => onDismissNewCircleOnboardingHint?.()}
                hitSlop={8}
                style={styles.hintDismiss}
              >
                <Text style={styles.hintDismissText}>Skip</Text>
              </Pressable>
              <Text style={styles.hintText}>The people close behind them can go here too.</Text>
            </View>
          </View>
        </View>
      ) : null}

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
    // Explicit position: "relative" (React Native's own default, but named
    // here deliberately) — the positioning root the coach-mark overlay
    // below anchors against.
    container: {
      gap: theme.spacing.md,
      position: "relative"
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
    },
    // Coach-mark overlay (2026-08-30 rebuild — see the JSX comment above
    // where these render). hintOverlay spans the whole component but is
    // pointerEvents="box-none", so it never itself intercepts a touch —
    // only hintBubble/hintDismiss (each with their own small, real bounds)
    // do. hintAnchor positions are approximate, reasoned from
    // STANDARD_CHIP_DIAMETER and the pinned "+" column's own width rather
    // than measured on a real device — flagged, not assumed exact, same as
    // this file's other on-device-unverified constants.
    hintOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0
    },
    hintAnchor: {
      position: "absolute"
    },
    coreHintAnchor: {
      top: 116,
      left: 120
    },
    newCircleHintAnchor: {
      top: 116,
      left: 0
    },
    hintPointer: {
      width: 12,
      height: 12,
      backgroundColor: HINT_BUBBLE_COLOR,
      transform: [{ rotate: "45deg" }],
      marginBottom: -6,
      marginLeft: theme.spacing.lg
    },
    // Fixed width, not maxWidth — a flex:1 Text inside a merely
    // maxWidth-capped, otherwise shrink-to-fit bubble is exactly what
    // broke this the first time (no real space to resolve flex:1
    // against). A definite width means hintText can wrap normally with no
    // flex needed at all.
    hintBubble: {
      position: "relative",
      width: 240,
      borderRadius: theme.radius.md,
      paddingTop: theme.spacing.lg + 12,
      paddingBottom: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      backgroundColor: HINT_BUBBLE_COLOR
    },
    // Top-right — the dominant coach-mark dismiss convention, and clear of
    // the message text below it (paddingTop above reserves that room),
    // rather than sharing a row with wrapping text.
    hintDismiss: {
      position: "absolute",
      top: theme.spacing.xs,
      right: theme.spacing.xs,
      paddingVertical: 4,
      paddingHorizontal: 6
    },
    // No opacity reduction here (unlike the old version) — "Skip" is text
    // too, per the confirmed contrast requirement, so it stays at full
    // strength rather than risking the verified margin for a small
    // secondary-emphasis effect; fontWeight alone differentiates it from
    // the message text.
    hintDismissText: {
      color: HINT_TEXT_COLOR,
      fontSize: 13,
      fontWeight: "700"
    },
    hintText: {
      color: HINT_TEXT_COLOR,
      fontSize: 14,
      lineHeight: 20
    }
  });
}
