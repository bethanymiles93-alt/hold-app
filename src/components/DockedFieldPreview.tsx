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
 * own in-page TextInput is now one of these: empty shows `placeholder`
 * (tap anywhere to start typing, which activates the docked bar); once
 * there's a value, the box itself scrolls internally (capped ~5 lines,
 * 2026-08-13) rather than activating on tap — only the explicit "Edit"
 * affordance opens the docked bar at that point, deliberately not the
 * whole box, since a Pressable wrapping a scrollable area (itself already
 * inside the page's own outer scroll) is a known RN gesture conflict that
 * silently prevented the inner scroll from ever working. Same interaction
 * whether starting fresh or editing something existing, everywhere in the
 * app. See docs/09-decision-log.md, 2026-08-10 and 2026-08-13.
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
      {hasValue ? (
        // Not a Pressable wrapping the ScrollView (2026-08-13 fix) — it
        // was, and that's why this never actually scrolled: a Pressable
        // (itself already sitting inside the page's own outer ScrollView)
        // wrapping a second, inner ScrollView is a well-known RN gesture
        // conflict, where the outer element claims the drag before the
        // inner one ever gets a chance to recognise it as a scroll. The
        // explicit "Edit" affordance below is now the only tap target
        // that opens the bar when there's already content — scrolling
        // the box itself no longer competes with that gesture at all.
        <View style={[styles.box, isActive && styles.boxActive, style]}>
          <ScrollView style={styles.textScroll}>
            <Text style={styles.valueText}>{value}</Text>
          </ScrollView>
          {!isActive ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={accessibilityLabel ?? `Edit: ${value}`}
              onPress={onPress}
              hitSlop={8}
            >
              <Text style={styles.editLabel}>Edit</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        // Empty state keeps the original whole-box Pressable — nothing to
        // scroll yet, so there's no gesture conflict to avoid here.
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel ?? placeholder}
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
    placeholderText: {
      color: colors.textMuted,
      fontSize: 17,
      lineHeight: 25
    },
    editLabel: {
      alignSelf: "flex-start",
      color: colors.link,
      fontSize: 13,
      fontWeight: "600"
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
