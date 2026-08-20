import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";
import { getSuggestedPhrases } from "@/services/suggestedPhrasesService";

interface DockedFieldPreviewProps {
  value: string;
  placeholder: string;
  onPress: () => void;
  /** True while this field's text currently lives in the docked bar below. */
  isActive: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  /**
   * Sentence-suggestion pills above this preview box — a DIFFERENT
   * component from DockedInputBar and does NOT inherit its own pill row
   * automatically, per direct instruction to add this explicitly rather
   * than assume it's covered. Tapping a pill calls `onInsertPill` only —
   * it does NOT also activate the docked bar (corrected 2026-08-13: it
   * originally did, which meant every pill tap here wrongly popped the
   * keyboard up). This is a plain insertion at this layer, not
   * green-tracked: DockedInputBar (where the green-highlight/revert-on-
   * edit mechanic actually lives) isn't mounted at all while this box is
   * inactive. The inserted text can be reviewed afterward by scrolling
   * this box, same as anything typed directly. Once the bar is
   * separately opened, its own pill row offers full green-tracked
   * insertion for anything tapped from there on. Omit to render no pill
   * row (e.g. a non-message-shaped field). See docs/09-decision-log.md,
   * 2026-08-13.
   */
  onInsertPill?: (text: string) => void;
  /**
   * Context-specific pills shown alongside (not instead of) the person's
   * own general suggested phrases — e.g. the apology wording for messaging
   * someone added via Reconnect's own "+", never the default. Purely
   * additive at render time, not written into suggestedPhrasesService's
   * own user-editable store — different lifecycle, this list is computed
   * fresh by the caller from current context, not something to add/remove
   * from Library's Templates tab. See docs/09-decision-log.md, 2026-08-20.
   */
  extraPhrases?: string[];
  /**
   * Renders the whole value green + bold — the un-edited-template look,
   * matching DockedInputBar's own green-highlight/revert-on-edit block
   * treatment (2026-08-20, closes a real gap: this box's own Template
   * button called setMessage directly, bypassing that mechanic entirely,
   * so a freshly-inserted template rendered as plain black text here even
   * though the identical insertion via Box B renders green). A caller
   * passes this as true exactly when the current value is still,
   * byte-for-byte, the untouched template — typically the same boolean
   * already driving a "✓ Saved" indicator nearby, not new state to
   * invent. Whole-value only, not block-scoped like Box B's own ranges —
   * correct for the common case (an empty box + one Template tap) without
   * this box needing its own full range-tracking. Pairs colour with a
   * weight change (bold), not colour alone, per the app's colour-
   * blindness-safe rule. See docs/09-decision-log.md.
   */
  highlightAll?: boolean;
}

/**
 * The on-page trigger for DockedInputBar — every field that used to be its
 * own in-page TextInput is now one of these: tap anywhere on the box to
 * open the docked bar, empty or not. Once there's a value, the box also
 * scrolls internally (capped ~5 lines) so existing content can be reviewed
 * without opening the bar — `nestedScrollEnabled` on the inner ScrollView
 * is what makes that scroll cooperate with the page's own outer scroll
 * (Screen.tsx) rather than a "make the whole box non-tappable" workaround
 * (tried 2026-08-13, reverted 2026-08-14 — it didn't actually fix the
 * scroll either, and made the box untappable in the process, since real
 * usage has a value from almost the first render onward). Same
 * interaction whether starting fresh or editing something existing,
 * everywhere in the app. See docs/09-decision-log.md, 2026-08-10 and
 * 2026-08-14.
 */
export function DockedFieldPreview({
  value,
  placeholder,
  onPress,
  isActive,
  accessibilityLabel,
  style,
  onInsertPill,
  extraPhrases = [],
  highlightAll = false
}: DockedFieldPreviewProps) {
  const { colors } = useAppTheme("normal");
  const styles = createStyles(colors);
  const hasValue = value.trim().length > 0;
  const [savedPhrases, setSavedPhrases] = useState<string[]>([]);
  // Tap-vs-scroll disambiguation done by hand (2026-08-21) — a Pressable
  // wrapping this box's own ScrollView was tried twice (nestedScrollEnabled,
  // then a "the responder system should let the ScrollView win" theory),
  // both confirmed on-device to still block scrolling. Rather than a third
  // attempt at the same two-responder structure, the ScrollView is now the
  // only thing claiming touches at all: a drag sets this ref, and onTouchEnd
  // only calls onPress if no drag happened. onAccessibilityTap keeps
  // VoiceOver/TalkBack activation working independently of this, since that
  // fires as a distinct system gesture, not a regular touch. See
  // docs/09-decision-log.md.
  const didScrollRef = useRef(false);

  useEffect(() => {
    if (!onInsertPill) return;
    void getSuggestedPhrases().then(setSavedPhrases);
  }, [onInsertPill]);

  const phrases = [...extraPhrases, ...savedPhrases];

  return (
    <View>
      {onInsertPill && phrases.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.phraseRow}>
          {phrases.map((phrase) => (
            <Pressable
              key={phrase}
              accessibilityRole="button"
              accessibilityLabel={phrase}
              // Inserts only — does NOT also call onPress() to open the
              // docked bar (2026-08-13 fix: it used to, which meant
              // tapping a pill here wrongly popped the keyboard up every
              // time). The person can now review the inserted text by
              // scrolling this box, same as if they'd typed it — opening
              // the bar stays an explicit, separate action (tapping the
              // box/Edit), not a side effect of using a pill.
              onPress={() => onInsertPill(phrase)}
              style={({ pressed }) => [styles.phrasePill, pressed && styles.pressed]}
            >
              <Text style={styles.phrasePillText}>{phrase}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      {/* Whole box opens the bar on tap, empty or not (2026-08-14, reverts
          the 2026-08-13 "Edit"-link-only change for hasValue) — same
          interaction whether starting fresh or editing something existing,
          everywhere in the app. See docs/09-decision-log.md, 2026-08-10 and
          2026-08-14. */}
      {hasValue ? (
        // A Pressable wrapping this ScrollView was tried twice
        // (nestedScrollEnabled; then a "the ScrollView should win the
        // responder" theory) — both confirmed on-device to still block
        // scrolling. The ScrollView is now the only thing claiming
        // touches: a drag sets didScrollRef, onTouchEnd only opens the
        // bar if no drag happened. `accessible`/`onAccessibilityTap` on
        // this same View keep VoiceOver/TalkBack activation working
        // independently — that fires as a distinct system gesture, not a
        // regular touch, so it isn't affected by the manual tap/scroll
        // split. See docs/09-decision-log.md, 2026-08-21.
        <View
          accessible
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel ?? `Edit: ${value}`}
          accessibilityState={{ disabled: isActive }}
          onAccessibilityTap={isActive ? undefined : onPress}
          style={[styles.box, isActive && styles.boxActive, style]}
        >
          <ScrollView
            style={styles.textScroll}
            nestedScrollEnabled
            onScrollBeginDrag={() => {
              didScrollRef.current = true;
            }}
            onTouchEnd={() => {
              if (!didScrollRef.current && !isActive) onPress();
              didScrollRef.current = false;
            }}
          >
            <Text style={[styles.valueText, highlightAll && styles.valueTextHighlighted]}>{value}</Text>
          </ScrollView>
        </View>
      ) : (
        // No scroll to conflict with here — a plain Pressable is safe and
        // gets normal, un-worked-around accessibility semantics for free.
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel ?? placeholder}
          disabled={isActive}
          onPress={onPress}
          style={[styles.box, isActive && styles.boxActive, style]}
        >
          <Text style={styles.placeholderText}>{placeholder}</Text>
        </Pressable>
      )}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    box: {
      minHeight: 60,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: theme.radius.md,
      padding: theme.spacing.md,
      backgroundColor: colors.surface,
      gap: theme.spacing.xs
    },
    boxActive: {
      borderColor: colors.primary
    },
    // 5 lines at valueText's own 25pt line-height, then scrolls.
    textScroll: {
      maxHeight: 125
    },
    valueText: {
      color: colors.text,
      fontSize: 17,
      lineHeight: 25
    },
    // Colour + weight together, not colour alone — matches Box B's own
    // green-highlight/revert-on-edit block treatment.
    valueTextHighlighted: {
      color: colors.primary,
      fontWeight: "700"
    },
    placeholderText: {
      color: colors.textMuted,
      fontSize: 17,
      lineHeight: 25
    },
    phraseRow: {
      flexDirection: "row",
      gap: theme.spacing.xs,
      paddingBottom: theme.spacing.xs
    },
    // Tight around the text, matching the app's true-circle/pill sizing
    // discipline elsewhere (AdaptiveCircleChip) — no excess padding
    // stretching these into ovals/bars.
    // theme.radius.sm (gentle, matching the docked bar's own corner
    // rounding), not theme.radius.pill (999, full stadium) — 2026-08-13
    // fix: the full pill radius was visibly clipping content inside
    // these specifically. Scoped to sentence-suggestion pills only, not
    // AdaptiveCircleChip's Circle-selection pills/chips elsewhere, which
    // are deliberately unaffected. See docs/09-decision-log.md.
    phrasePill: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: theme.radius.sm,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 4
    },
    // fontSize 17 — the app-wide established body/accessible text size,
    // matching this component's own valueText/placeholderText, not the
    // smaller 14 used for chip labels elsewhere. See docs/09-decision-log.md.
    phrasePillText: {
      color: colors.text,
      fontSize: 17,
      fontWeight: "600"
    },
    pressed: {
      opacity: 0.7
    }
  });
}
