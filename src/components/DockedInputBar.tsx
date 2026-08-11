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
 * Shape (2026-08-11, corrected same day): one continuous rounded pill holds
 * the text input plus all three of its icons — AI-amend (sparkle, kept as
 * the icon choice: the established cross-industry convention for
 * "AI-powered action"), mic, and send — Instagram-style, not separate
 * elements in a row; AI-amend moved in from outside the pill after an
 * on-device pass found it sitting apart from the other two. Colour is
 * two-tier and was corrected a second time the same day after an on-device
 * pass found the first attempt read as uniformly too dark: inside the pill,
 * a lighter blend anchored to `onPrimary`/`primary` (light mode leans
 * toward white, dark mode toward the vivid accent green) so the pill reads
 * as a clearly lighter accent against its surround, paired with the theme's
 * own text colour (never a fixed white); outside the pill, a blend leaning
 * further toward an approximated keyboard-grey. Neither is a literal,
 * sampled Instagram value — this session has no way to read real pixels
 * from the Instagram app — both are reasoned adjustments targeting specific
 * on-device complaints, flagged as such in the decision log.
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
          <View style={styles.pill}>
            {amend.available ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={amend.open ? "Close AI amend" : "Amend with AI"}
                accessibilityState={{ expanded: amend.open }}
                onPress={amend.toggle}
                hitSlop={8}
                style={({ pressed }) => [styles.pillIconButton, pressed && styles.pressed]}
              >
                <Ionicons
                  name={amend.open ? "sparkles" : "sparkles-outline"}
                  size={20}
                  color={amend.open ? colors.primary : colors.textMuted}
                />
              </Pressable>
            ) : null}

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
              hitSlop={8}
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
  // Inside the pill (2026-08-11, second correction — the prior pass's
  // surfaceStrong+border blend read as "too dark" on-device in dark mode,
  // where both source tokens are themselves fairly dark, leaving no visible
  // lightness contrast between the pill and its surroundings). Light mode:
  // surfaceStrong (already pale) blended further toward onPrimary (white,
  // an existing token, not invented) for a subtle near-white mint wash,
  // closer to how pale Instagram's own light-mode composer pill reads. Dark
  // mode: primary (the vivid accent green, not the dark tokens used
  // elsewhere) blended toward surfaceStrong, so the pill reads as a clearly
  // lighter, more saturated accent sitting on a darker surround — the
  // relationship Instagram's own dark-mode pill has to its background,
  // which the previous value inverted (pill and surround were nearly the
  // same darkness). Still not a literal Instagram colour match — this
  // session has no way to sample real pixels from the Instagram app; it's a
  // reasoned adjustment targeting the two specific on-device complaints
  // ("outside too dark," "pill too dark"), not a verified sample. See
  // docs/09-decision-log.md, 2026-08-11.
  const pillFill = isDark
    ? mixColors(colors.primary, colors.surfaceStrong, 0.35)
    : mixColors(colors.surfaceStrong, colors.onPrimary, 0.55);
  // Outside the pill (the bar's own backdrop + suggestion row): blended
  // toward the approximated keyboard grey, weighted slightly more toward it
  // than the prior pass (0.3 → 0.25 pill-fill weight) so the outer area
  // reads closer to a neutral keyboard-like grey and further from the
  // (now lighter, more saturated) pill fill above — reinforcing rather than
  // undoing the pill/surround contrast this correction is trying to
  // establish. Same "reasoned approximation, not sampled" caveat as above.
  const keyboardBackdrop = isDark ? KEYBOARD_BACKDROP_DARK : KEYBOARD_BACKDROP_LIGHT;
  const barFill = mixColors(pillFill, keyboardBackdrop, 0.25);

  return StyleSheet.create({
    safe: {
      backgroundColor: barFill,
      // No top border (2026-08-11 correction — the prior pass's "thicker,
      // darker-green border" read as a jarring, heavy line on-device).
      // Rounded top corners instead, to read as a soft merge with the
      // keyboard's own top edge rather than a hard-edged panel dropped on
      // top of it. Reduced from 24pt (theme.radius.lg) to 10pt
      // (theme.radius.sm) the same day, later — the larger radius read as
      // too aggressively curved on-device, and (combined with the icons
      // now sitting at the top of the pill just inside it) visually
      // clipped against the icons near the bar's own top corners. Still a
      // reasoned choice, not a measured value. See docs/09-decision-log.md.
      borderTopLeftRadius: theme.radius.sm,
      borderTopRightRadius: theme.radius.sm,
      paddingHorizontal: theme.spacing.sm,
      paddingTop: theme.spacing.sm,
      gap: theme.spacing.xs
    },
    row: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: theme.spacing.xs,
      paddingBottom: theme.spacing.sm
    },
    // One continuous rounded shape holding the text input and all three of
    // its icons (AI-amend, mic, send) — Instagram-style, not separate
    // elements in a row. borderRadius uses the pill token throughout; on a
    // multi-line-grown tall box this still reads as a fully-rounded
    // (stadium) shape at whatever height the text has grown to. Icons sit
    // at the TOP of the pill, following the curve of its rounded top edge
    // (2026-08-11 correction — they previously sat at the bottom, where the
    // outer two clipped/overlapped the pill's own rounded corner; extra
    // top padding here gives them clearance from that curve). See
    // docs/09-decision-log.md.
    pill: {
      flex: 1,
      flexDirection: "row",
      alignItems: "flex-start",
      minHeight: 44,
      maxHeight: 132,
      borderRadius: theme.radius.pill,
      backgroundColor: pillFill,
      paddingLeft: theme.spacing.md,
      paddingRight: theme.spacing.md,
      paddingTop: theme.spacing.sm,
      paddingBottom: theme.spacing.xs
    },
    input: {
      flex: 1,
      maxHeight: 108,
      minHeight: 32,
      paddingHorizontal: theme.spacing.xs,
      paddingVertical: theme.spacing.xs,
      // The theme's own text colour, not a fixed literal — near-black in
      // light mode, near-white in dark mode, matching whichever fill this
      // sits on in that mode. Recomputed against the corrected, lighter
      // pill fill above (2026-08-11): light-normal (pill ≈ #eaefeb, text
      // #242825) ≈ 12.8:1; dark-normal (pill ≈ #4b5e4e, text #edefe8) ≈
      // 6.0:1 — both still comfortably past WCAG AA's 4.5:1, though the
      // dark-mode margin is now smaller than the previous value's 9.2:1, a
      // direct, reported trade-off of deliberately lightening the pill for
      // the "too dark" fix above. Not verified on a live device — computed
      // from the theme's own defined hex values. See
      // docs/09-decision-log.md, 2026-08-11.
      color: colors.text,
      fontSize: 16,
      lineHeight: 21
    },
    // Sized to sit comfortably inside the pill alongside the mic/send
    // icons — visually more compact than the 44pt tap-target floor, so
    // hitSlop (set at each call site) restores an effectively ≥44pt hit
    // area without inflating the pill's own visual height.
    pillIconButton: {
      width: 28,
      height: 28,
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
