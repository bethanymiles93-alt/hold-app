import { useEffect, useState } from "react";
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
  onInsertPill
}: DockedFieldPreviewProps) {
  const { colors } = useAppTheme("normal");
  const styles = createStyles(colors);
  const hasValue = value.trim().length > 0;
  const [phrases, setPhrases] = useState<string[]>([]);

  useEffect(() => {
    if (!onInsertPill) return;
    void getSuggestedPhrases().then(setPhrases);
  }, [onInsertPill]);

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
          the 2026-08-13 "Edit"-link-only change for hasValue) — that
          change traded a real regression (tapping the box did nothing,
          confirmed on-device: `message` is pre-filled from either a saved
          default or the intent-chip draft almost immediately in real use,
          so hasValue is true from nearly the first render onward, meaning
          the small "Edit" link became effectively the ONLY way in) for a
          theorised, never-confirmed scroll fix that on-device testing
          then found still didn't scroll either. Restores this component's
          own stated design goal: "same interaction whether starting fresh
          or editing something existing." `nestedScrollEnabled` on the
          inner ScrollView is the actual documented RN mechanism for a
          ScrollView nested inside another ScrollView (Screen.tsx's own
          outer one) — Android needs it explicitly, iOS doesn't. A
          Pressable wrapping a ScrollView doesn't block the ScrollView's
          own drag gesture in practice (RN's responder system lets the
          deeper, moving-vertically ScrollView claim it before Pressable's
          tap-on-release ever fires) — Screen.tsx's own
          TouchableWithoutFeedback-wraps-ScrollView already relies on the
          same negotiation and is confirmed working. See
          docs/09-decision-log.md, 2026-08-14. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? (hasValue ? `Edit: ${value}` : placeholder)}
        disabled={isActive}
        onPress={onPress}
        style={[styles.box, isActive && styles.boxActive, style]}
      >
        {hasValue ? (
          <ScrollView style={styles.textScroll} nestedScrollEnabled>
            <Text style={styles.valueText}>{value}</Text>
          </ScrollView>
        ) : (
          <Text style={styles.placeholderText}>{placeholder}</Text>
        )}
      </Pressable>
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
