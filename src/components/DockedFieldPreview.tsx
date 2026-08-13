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
   * than assume it's covered. Tapping a pill calls `onInsertPill`, then
   * this component's own `onPress` (activating the docked bar) — the
   * screen decides how to seed its own message state. This is a plain
   * insertion at this layer, not green-tracked: DockedInputBar (where the
   * green-highlight/revert-on-edit mechanic actually lives) isn't mounted
   * yet at the moment this is tapped, since the field isn't active until
   * `onPress` fires. Once the bar opens, its own pill row offers full
   * green-tracked insertion for anything tapped from there on. Omit to
   * render no pill row (e.g. a non-message-shaped field). See
   * docs/09-decision-log.md, 2026-08-13.
   */
  onInsertPill?: (text: string) => void;
}

/**
 * The on-page trigger for DockedInputBar — every field that used to be its
 * own in-page TextInput is now one of these: empty shows `placeholder`
 * (tap to start typing, which activates the docked bar), non-empty shows
 * the current value plus a small "Edit" affordance (tap to load it back
 * into the docked bar for editing) — the same interaction whether starting
 * fresh or editing something existing, everywhere in the app. See
 * docs/09-decision-log.md, 2026-08-10.
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
              onPress={() => {
                onInsertPill(phrase);
                onPress();
              }}
              style={({ pressed }) => [styles.phrasePill, pressed && styles.pressed]}
            >
              <Text style={styles.phrasePillText}>{phrase}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? (hasValue ? `Edit: ${value}` : placeholder)}
        onPress={onPress}
        style={[styles.box, isActive && styles.boxActive, style]}
      >
        {/* Caps at ~5 lines then scrolls internally (2026-08-13 fix) —
            previously had no height constraint at all, so long saved
            text just grew unbounded, pushing the rest of the screen
            (and the "Edit" affordance) out of easy reach with no way to
            scroll back to it. This is a genuinely simpler fix than
            DockedInputBar's own scroll problem: plain static text, no
            active editing, no green-highlight overlay to keep in sync —
            a normal ScrollView is sufficient, the person can freely
            drag-scroll it with a finger. */}
        <ScrollView style={styles.textScroll} nestedScrollEnabled>
          <Text style={hasValue ? styles.valueText : styles.placeholderText}>
            {hasValue ? value : placeholder}
          </Text>
        </ScrollView>
        {hasValue && !isActive ? <Text style={styles.editLabel}>Edit</Text> : null}
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
    phrasePill: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: theme.radius.pill,
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
