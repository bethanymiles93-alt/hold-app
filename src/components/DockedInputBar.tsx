import { useEffect } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Keyboard, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useDockedAiAmend } from "@/hooks/useDockedAiAmend";
import { DictationMicButton } from "@/components/DictationMicButton";
import { mixColors } from "@/utils/colorMix";
import type { AiDraftContext, AiSurface } from "@/services/aiProxyClient";

// Reasoned approximations of the stock iOS keyboard's own backdrop colour —
// not sampled from a real device (there's no way to read the live keyboard's
// actual pixel colour from app code). Used only to blend the area outside
// the text pill toward "roughly what a system keyboard looks like" rather
// than the app's own background — confirm on-device whether this reads as
// continuous with the real keyboard, since it's an approximation, not a
// measurement. See docs/09-decision-log.md, 2026-08-11.
const KEYBOARD_BACKDROP_LIGHT = "#D1D3D6";
const KEYBOARD_BACKDROP_DARK = "#2C2C2E";

interface DockedInputBarProps {
  value: string;
  onChangeText: (text: string) => void;
  /** Commits and closes the bar — the field this bar is currently bound to has already been saving live via onChangeText, so this is just "I'm done," not a separate save step. */
  onDone: () => void;
  /**
   * Fires on keyboard-hide or tap-outside dismissal — anything that closes
   * the bar WITHOUT an explicit paper-plane tap. Defaults to `onDone` if not
   * given, matching every field's prior "just close" behaviour. A field that
   * needs dismiss-without-committing (new-Circle naming, where tapping
   * outside shouldn't create a Circle from a half-typed name) passes its own.
   * See docs/09-decision-log.md, 2026-08-11 — removes the old, separate
   * Add/Cancel buttons in favour of one generic mechanism every screen gets
   * for free.
   */
  onDismiss?: () => void;
  placeholder?: string;
  accessibilityLabel: string;
  /**
   * Present only for message-shaped content — omit for short label fields
   * (a Circle name, an account nickname), where AI-amend and dictation add
   * more friction than value. See docs/09-decision-log.md, 2026-08-10.
   */
  aiAmend?: { surface: AiSurface; context?: AiDraftContext; initialPrompt?: string };
  /**
   * Shown as their own row directly above the main input line, only while
   * the field is empty — tapping one submits immediately rather than typing
   * it out. Currently only Going Quiet's new-Circle name uses this. Plain
   * text words, not circles/chips (2026-08-11 correction — see decision
   * log: circle-shaped suggestion chips read as competing with the actual
   * Circle chips they're meant to help create).
   */
  suggestions?: { label: string; onPress: () => void }[];
}

/**
 * The single, app-wide place free text is typed or edited — replaces every
 * screen's own in-page TextInput. Docked directly above the keyboard via
 * react-native-keyboard-controller's KeyboardStickyView (RN's own
 * InputAccessoryView doesn't render under this app's New Architecture
 * setup — see Screen.tsx). A screen renders exactly one of these, bound to
 * whichever field is currently "active" (see DockedFieldPreview) — the bar
 * itself is stateless about *what* it's editing, just how.
 *
 * Also where the Hold+-gated AI-assist trigger now lives, superseding the
 * old standalone AmendWithAI panel that sat inline below each message box
 * (2026-08-10 — see decision log for the explicit supersession).
 *
 * Shape (2026-08-11): one continuous rounded pill holds the text input plus
 * its mic and send icons at the far right end, Instagram-style — not three
 * separate elements in a row. Only the AI-amend toggle (a distinct,
 * occasional action, not part of composing) stays outside the pill. Colour
 * is two-tier: inside the pill uses the existing chip-green blend with the
 * theme's own text colour (dark in light mode, light in dark mode — never a
 * fixed white, which would fail contrast against this pale a fill); outside
 * the pill blends toward an approximated keyboard-grey instead, so the whole
 * bar reads as one continuous surface with the keyboard beneath it.
 */
export function DockedInputBar({
  value,
  onChangeText,
  onDone,
  onDismiss,
  placeholder,
  accessibilityLabel,
  aiAmend,
  suggestions
}: DockedInputBarProps) {
  const { colors, isDark } = useAppTheme("normal");
  const styles = createStyles(colors, isDark);
  const amend = useDockedAiAmend(
    aiAmend?.surface,
    aiAmend?.context,
    value,
    onChangeText,
    aiAmend?.initialPrompt
  );

  const dismiss = onDismiss ?? onDone;

  // Tap-outside already dismisses the keyboard app-wide (Screen.tsx's own
  // TouchableWithoutFeedback) — this makes that same gesture also close the
  // docked bar itself, generically, for every field on every screen. Without
  // it, a field like new-Circle naming would need its own explicit Cancel
  // button to avoid trapping the user in a half-open bar. See
  // docs/09-decision-log.md, 2026-08-11.
  useEffect(() => {
    const subscription = Keyboard.addListener("keyboardDidHide", dismiss);
    return () => subscription.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dismiss]);

  const appendDictated = (text: string) => {
    onChangeText(value.trim() ? `${value.trim()} ${text}` : text);
  };

  return (
    <KeyboardStickyView>
      <SafeAreaView edges={["left", "right"]} style={styles.safe}>
        {amend.open ? (
          <View style={styles.amendRow}>
            <TextInput
              accessibilityLabel="Context for AI amend"
              onChangeText={amend.setPrompt}
              placeholder="Add context for AI, or leave blank"
              placeholderTextColor={colors.textMuted}
              style={styles.amendInput}
              value={amend.prompt}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={amend.status === "loading" ? "Generating" : "Generate with AI"}
              disabled={amend.status === "loading"}
              onPress={() => void amend.generate()}
              style={({ pressed }) => [
                styles.amendGo,
                amend.status === "loading" && styles.amendGoDisabled,
                pressed && styles.pressed
              ]}
            >
              <Ionicons name="sparkles" size={16} color={colors.onPrimary} />
            </Pressable>
          </View>
        ) : null}

        {amend.status === "error" ? (
          <Text style={styles.errorText}>Couldn't reach AI right now — try again.</Text>
        ) : null}

        {suggestions && suggestions.length > 0 && !value.trim() ? (
          <View style={styles.suggestionsRow}>
            {suggestions.map((suggestion, index) => (
              <View key={suggestion.label} style={styles.suggestionItem}>
                {index > 0 ? <View style={styles.suggestionDivider} /> : null}
                <Pressable
                  accessibilityRole="button"
                  onPress={suggestion.onPress}
                  hitSlop={8}
                  style={({ pressed }) => pressed && styles.pressed}
                >
                  <Text style={styles.suggestionText}>{suggestion.label}</Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.row}>
          {amend.available ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={amend.open ? "Close AI amend" : "Amend with AI"}
              accessibilityState={{ expanded: amend.open }}
              onPress={amend.toggle}
              style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
            >
              <Ionicons
                name={amend.open ? "sparkles" : "sparkles-outline"}
                size={20}
                color={amend.open ? colors.primary : colors.textMuted}
              />
            </Pressable>
          ) : null}

          <View style={styles.pill}>
            <TextInput
              accessibilityLabel={accessibilityLabel}
              autoFocus
              multiline
              onChangeText={onChangeText}
              placeholder={placeholder}
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              value={value}
            />

            <DictationMicButton onResult={appendDictated} />

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Done"
              onPress={onDone}
              style={({ pressed }) => [styles.doneButton, pressed && styles.pressed]}
            >
              <Ionicons name="send" size={20} color={colors.onPrimary} style={styles.doneIcon} />
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </KeyboardStickyView>
  );
}

function createStyles(colors: ThemeColors, isDark: boolean) {
  // Inside the pill: the existing chip-green blend (e.g. #c8d1c9 in light-
  // normal) — unchanged from the prior pass. See src/utils/colorMix.ts.
  const pillFill = mixColors(colors.surfaceStrong, colors.border, 0.6);
  // Outside the pill (the bar's own backdrop + suggestion row): blended
  // mostly toward the approximated keyboard grey rather than the app's own
  // background, so the whole bar reads as an extension of the keyboard
  // surface beneath it, only lightly tinted by the app's palette. See
  // docs/09-decision-log.md, 2026-08-11 (corrects the prior pass, which
  // blended toward the app's own border/background tokens only).
  const keyboardBackdrop = isDark ? KEYBOARD_BACKDROP_DARK : KEYBOARD_BACKDROP_LIGHT;
  const barFill = mixColors(pillFill, keyboardBackdrop, 0.3);

  return StyleSheet.create({
    safe: {
      backgroundColor: barFill,
      // No top border (2026-08-11 correction — the prior pass's "thicker,
      // darker-green border" read as a jarring, heavy line on-device).
      // Rounded top corners instead, to read as a soft merge with the
      // keyboard's own top edge rather than a hard-edged panel dropped on
      // top of it. 24pt (theme.radius.lg) is a reasoned, deliberate choice,
      // not a measured value — the real system keyboard's own corner
      // curvature (if any, by OS/version) can't be read from app code.
      // Confirm on-device whether this reads right.
      borderTopLeftRadius: theme.radius.lg,
      borderTopRightRadius: theme.radius.lg,
      paddingHorizontal: theme.spacing.sm,
      paddingTop: theme.spacing.sm,
      gap: theme.spacing.xs
    },
    row: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: theme.spacing.xs,
      paddingBottom: theme.spacing.sm
    },
    // One continuous rounded shape holding the text input and both its
    // icons — Instagram-style, not three separate siblings. borderRadius
    // uses the pill token throughout; on a multi-line-grown tall box this
    // still reads as a fully-rounded (stadium) shape at whatever height the
    // text has grown to, matching the reference.
    pill: {
      flex: 1,
      flexDirection: "row",
      alignItems: "flex-end",
      minHeight: 44,
      maxHeight: 132,
      borderRadius: theme.radius.pill,
      backgroundColor: pillFill,
      paddingLeft: theme.spacing.md,
      paddingRight: theme.spacing.xs,
      paddingVertical: theme.spacing.xs
    },
    input: {
      flex: 1,
      maxHeight: 108,
      minHeight: 32,
      paddingVertical: theme.spacing.xs,
      // The theme's own text colour, not a fixed literal — near-black in
      // light mode, near-white in dark mode, matching whichever fill this
      // sits on in that mode. Computed contrast (light-normal pill
      // #c8d1c9 + this text colour #242825): ratio ≈ 9.55:1, well past
      // WCAG AA's 4.5:1 (and AAA's 7:1). Dark-normal pill #3a4039 + text
      // #edefe8: ratio ≈ 9.19:1, same margin. Not verified on a live
      // device — computed from the theme's own defined hex values. See
      // docs/09-decision-log.md, 2026-08-11.
      color: colors.text,
      fontSize: 16,
      lineHeight: 21
    },
    iconButton: {
      width: 44,
      height: 44,
      alignItems: "center",
      justifyContent: "center"
    },
    doneButton: {
      width: 36,
      height: 36,
      borderRadius: theme.radius.pill,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center"
    },
    // Same optical-centring nudge as CompactSendButton's own paper-plane —
    // the glyph itself leans right, uncorrected.
    doneIcon: {
      marginLeft: 2
    },
    pressed: {
      opacity: 0.7
    },
    suggestionsRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      paddingBottom: theme.spacing.xs
    },
    suggestionItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm
    },
    // A thin vertical rule between words, not a chip/pill background of any
    // kind — plain text list, per 2026-08-11's correction.
    suggestionDivider: {
      width: StyleSheet.hairlineWidth,
      height: 18,
      backgroundColor: colors.border
    },
    suggestionText: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "600"
    },
    amendRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
      paddingTop: theme.spacing.xs
    },
    amendInput: {
      flex: 1,
      minHeight: 40,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: theme.radius.sm,
      paddingHorizontal: theme.spacing.sm,
      color: colors.text,
      fontSize: 14,
      backgroundColor: colors.background
    },
    amendGo: {
      width: 40,
      height: 40,
      borderRadius: theme.radius.pill,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center"
    },
    amendGoDisabled: {
      opacity: 0.5
    },
    errorText: {
      color: colors.error,
      fontSize: 13,
      paddingHorizontal: theme.spacing.xs
    }
  });
}
