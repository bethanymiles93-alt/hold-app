import { useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type NativeSyntheticEvent,
  type TextLayoutEventData
} from "react-native";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";
import { stripEmoji } from "@/utils/stripEmoji";

interface AdaptiveCircleChipProps {
  label: string;
  isSelected: boolean;
  /** Whether a message has already been sent to this Circle/person this session — see the priority order below. */
  hasSentThisSession?: boolean;
  /**
   * A third, distinct fill — paler than the default sage — for "not yet
   * reached" alongside chips that ARE `hasSentThisSession` in the same row
   * (Reconnect's resumed-completion circle row: sent Circles green, a
   * Circle added to the audience afterward and not yet reached paler, at
   * the row's end). Lowest priority of the three — `isSelected` and
   * `hasSentThisSession` both still win over it. Distinct from the plain
   * default look used everywhere a send hasn't started yet at all, where
   * this is never set. See docs/09-decision-log.md, 2026-08-13.
   */
  notYetSent?: boolean;
  onPress: () => void;
  /** Bordered/transparent treatment instead of a filled circle/pill — e.g. the "+" New Circle button. */
  outline?: boolean;
  /** "text" renders a non-interactive pill (e.g. previewing an unselected Circle's members, where "exclude" has no meaning yet) — disabled, no press feedback, no checked/expanded state announced. */
  accessibilityRole?: "checkbox" | "button" | "text";
  /** Defaults to `label` — set when the visible text ("+") isn't what a screen reader should announce. */
  accessibilityLabel?: string;
  /** When set, accessibilityState reports {expanded} instead of {checked: isSelected} — for a toggle-a-panel button like "+ New Circle" rather than a toggle-a-selection chip. */
  expanded?: boolean;
  /**
   * Bumps the label's own font size beyond the standard 14pt — "+" uses
   * this to read as visually larger than the small separate dropdown-arrow
   * element beside a named chip, since it has no competing label text to
   * share the circle with. See docs/09-decision-log.md, 2026-08-11.
   */
  labelFontSize?: number;
  /**
   * Heavier font weight, without any colour/fill difference — Close's own
   * secondary visual cue now that it no longer gets a unique default fill
   * (see docs/09-decision-log.md, 2026-08-11: removing the colour-meaning
   * conflict between "this is Close" and "this has been sent").
   */
  labelBold?: boolean;
  /**
   * Content-hugging pill (fixed smaller height, padding sized to the
   * label, no true-circle-if-it-fits logic) instead of the standard
   * STANDARD_CHIP_DIAMETER sizing — for person-level recipient-pill rows
   * (Going Quiet/Reconnect/Library's own per-person rows), never the
   * top-level Circle-picker row, which keeps its true-circle sizing
   * language unchanged. See docs/09-decision-log.md, 2026-08-14.
   */
  compact?: boolean;
  /**
   * A provisional/temporary Circle — bundled ad-hoc from Going Quiet's
   * removed-people roster, not yet a considered, final grouping. Distinct
   * coloured border (colors.focus, not primary/error/link, so it can't be
   * confused with any other chip meaning) paired with the border itself
   * being a shape change from the standard filled look — colour is never
   * the only signal, per the app's colour-blindness-safe rule. See
   * docs/09-decision-log.md, 2026-08-20.
   */
  provisional?: boolean;
  /**
   * A Circle/person added mid-Reconnect via "+" — wasn't part of the
   * original Going Quiet audience, so they don't know time has passed.
   * Double-line border, deliberately distinct from `provisional`'s single
   * coloured border (a different situation: this isn't "not yet decided
   * on," it's "this specific person needs different wording"). See
   * docs/09-decision-log.md, 2026-08-20.
   */
  newlyAdded?: boolean;
  /**
   * A neutral, always-on border (`colors.border`, not any state-meaning
   * colour) — for chips rendered overlapping inside `LinkedCircleCluster`,
   * where two adjacent same-fill chips with no state-driven border
   * (neither selected/sent/provisional) had no visible seam between them
   * at all, reading as one fused pill rather than two overlapping circles.
   * Lower priority than every state-driven border above — this only fills
   * the gap when nothing else is already drawing one. See
   * docs/09-decision-log.md, 2026-08-29.
   */
  clusterSeam?: boolean;
}

/**
 * One fixed height for every chip in the row. Increased a fourth time
 * (2026-08-11, confirmed intentional, final number given directly) from
 * 72pt/76dp to **90pt (iOS) / 95dp (Android)**, a +25% jump — Circles are
 * core to how the app is used, and the previous size left essentially no
 * margin for the longest common arrow-chip label. The dropdown arrow is no
 * longer part of this measurement at all as of the same pass (see
 * `expanded`/arrow split in GroupPicker.tsx) — it's now a separate element
 * beside the chip, not appended into the label text — so this diameter only
 * needs to fit the Circle name itself, not name+arrow.
 */
const STANDARD_CHIP_DIAMETER = Platform.OS === "android" ? 95 : 90;
// Kept tight so short labels can still plausibly become circles — this is
// NOT the same value as a pill's own rendered padding (below), decoupled
// on purpose: the circle-fit check needs to stay strict, but a pill's
// actual horizontal padding should read as roomy as the original
// CirclePill's did (paddingHorizontal: theme.spacing.md).
const CIRCLE_FIT_PADDING = theme.spacing.sm;
const PILL_HORIZONTAL_PADDING = theme.spacing.md;

/**
 * The one Circle-chip treatment used everywhere a Circle can be picked.
 *
 * Shape: every chip is STANDARD_CHIP_DIAMETER tall. A true circle at
 * exactly that diameter if the label's measured text fits inside it
 * (minus CIRCLE_FIT_PADDING on both sides); otherwise a pill at the same
 * fixed height, width growing to fit the text plus PILL_HORIZONTAL_PADDING
 * — the same circle, stretched wider, never a separately-sized shape.
 * Measured via onTextLayout on the real, always-rendered Text (reports the
 * glyph run's own width directly, unaffected by container sizing), which
 * naturally re-fires on any relayout including a live Dynamic Type change.
 *
 * State: two independent flags, not one. `isSelected` — part of the
 * current compose action. `hasSentThisSession` — already sent to this
 * session, independent of current selection. Priority, in order:
 * isSelected (ring + normal fill, regardless of hasSentThisSession) →
 * hasSentThisSession (softened/desaturated fill, no ring) → default fill.
 * This is what makes "reselect an already-sent chip, then deselect without
 * sending" correctly land back on the sent look rather than default —
 * hasSentThisSession is never touched by a selection toggle, only by an
 * actual send.
 *
 * Press feedback: a uniform opacity dim on every chip, applied here once
 * rather than patched per call site (a real gap in an earlier pass — the
 * old hand-styled "+" button had its own press effect that got silently
 * dropped when it moved onto this shared component without one).
 */
export function AdaptiveCircleChip({
  label,
  isSelected,
  hasSentThisSession = false,
  notYetSent = false,
  onPress,
  outline = false,
  accessibilityRole = "checkbox",
  accessibilityLabel,
  expanded,
  labelFontSize,
  labelBold,
  compact = false,
  provisional = false,
  newlyAdded = false,
  clusterSeam = false
}: AdaptiveCircleChipProps) {
  const { colors } = useAppTheme("normal");
  const styles = createStyles(colors);
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null);
  const strippedLabel = stripEmoji(label);

  const onTextLayout = (event: NativeSyntheticEvent<TextLayoutEventData>) => {
    const line = event.nativeEvent.lines[0];
    if (!line) return;
    if (measuredWidth === line.width) return;
    setMeasuredWidth(line.width);
  };

  const availableCircleWidth = STANDARD_CHIP_DIAMETER - CIRCLE_FIT_PADDING * 2;
  const fitsAsCircle = !compact && measuredWidth !== null && measuredWidth <= availableCircleWidth;

  const shapeStyle = compact
    ? styles.chipCompact
    : fitsAsCircle
      ? {
          width: STANDARD_CHIP_DIAMETER,
          height: STANDARD_CHIP_DIAMETER,
          borderRadius: STANDARD_CHIP_DIAMETER / 2
        }
      : {
          minWidth: STANDARD_CHIP_DIAMETER,
          height: STANDARD_CHIP_DIAMETER,
          borderRadius: STANDARD_CHIP_DIAMETER / 2,
          paddingHorizontal: PILL_HORIZONTAL_PADDING
        };

  // Sent look only shows when not currently selected — isSelected always
  // wins, per the priority order above. notYetSent is the lowest priority
  // of the three, and mutually exclusive with hasSentThisSession in practice.
  const showSentFill = !isSelected && hasSentThisSession;
  const showNotYetSentFill = !isSelected && !hasSentThisSession && notYetSent;

  // Reverted (2026-08-21, same day) — a "✓ " prefix here measured into
  // fitsAsCircle's own width check below, tipping names that used to fit
  // as a true circle into pill shape instead once sent. Non-colour signal
  // for sent state now lives entirely in the fill/border/weight below
  // (chipSent, labelBold when showSentFill), not the label text, so shape
  // stays exactly what the name on its own would produce either way. See
  // docs/09-decision-log.md.
  const displayLabel = strippedLabel;

  const variantStyle = showSentFill
    ? styles.chipSent
    : showNotYetSentFill
      ? styles.chipNotYetSent
      : outline
        ? styles.chipOutline
        : styles.chipSecondary;
  const labelVariantStyle = showSentFill
    ? styles.labelTextSent
    : showNotYetSentFill
      ? styles.labelTextNotYetSent
      : outline
        ? styles.labelTextOutline
        : styles.labelTextSecondary;

  // Outline chips ("+") have no ring path of their own by default — the
  // standard chipSelected ring only ever applied to filled chips. Without
  // this, "+"'s active/selected state was invisible (see decision log,
  // 2026-08-11) rather than just thin.
  const selectedRingStyle = outline ? styles.chipSelectedOutline : styles.chipSelected;
  // Only fills the gap when nothing state-driven is already drawing a
  // border — never overrides isSelected/sent/provisional's own treatment.
  const showClusterSeam = clusterSeam && !isSelected && !showSentFill && !provisional;

  const chip = (
    <Pressable
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel ?? displayLabel}
      accessibilityState={
        accessibilityRole === "text" ? undefined : expanded !== undefined ? { expanded } : { checked: isSelected }
      }
      disabled={accessibilityRole === "text"}
      // Only compact chips need this — STANDARD_CHIP_DIAMETER ones are
      // already 90/95pt, well over the accessible floor. Measured, not
      // guessed: every compact-pill row in the app uses the same
      // theme.spacing.sm (10pt) horizontal gap between chips, with no
      // exceptions found — 4pt left/right keeps two neighbours' hit zones
      // 2pt apart at their closest (2×4=8 of the 10pt gap), never
      // touching or overlapping. Vertical isn't constrained by neighbours
      // the same way (these are single-row horizontal scrolls, not a
      // wrapping grid), so 8pt top/bottom actually clears the 44pt
      // accessible floor (32 + 8 + 8 = 48) rather than just nudging it.
      // See docs/09-decision-log.md, 2026-08-21.
      hitSlop={compact ? { top: 8, bottom: 8, left: 4, right: 4 } : undefined}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        shapeStyle,
        variantStyle,
        isSelected && selectedRingStyle,
        showClusterSeam && styles.chipClusterSeam,
        // Provisional wins over the selected ring — a temporary Circle
        // needs to keep reading as temporary even while selected, not
        // have that signal disappear the moment it's picked. Not paired
        // with newlyAdded's double border in the same chip — the two
        // situations (not-yet-decided-on vs. needs-different-wording)
        // are deliberately kept visually distinct. See
        // docs/09-decision-log.md, 2026-08-20.
        provisional && styles.chipProvisional,
        pressed && styles.chipPressed
      ]}
    >
      <Text
        numberOfLines={1}
        onTextLayout={onTextLayout}
        style={[
          styles.labelText,
          labelVariantStyle,
          labelFontSize ? { fontSize: labelFontSize } : null,
          labelBold ? styles.labelBold : null
        ]}
      >
        {displayLabel}
      </Text>
    </Pressable>
  );

  // Double-line border, simulated via an outer ring wrapping the chip's own
  // — RN's borderStyle has no "double" value. Deliberately not combined
  // with `provisional`'s single coloured border at any call site (see the
  // comment above): different meanings, different treatments.
  return newlyAdded ? <View style={styles.newlyAddedRing}>{chip}</View> : chip;
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    chip: {
      alignItems: "center",
      justifyContent: "center"
    },
    // Content-hugging, not diameter-locked — a person-pill row reads as a
    // list of names, not a row of Circles, so it doesn't need the
    // true-circle-if-it-fits treatment STANDARD_CHIP_DIAMETER exists for.
    chipCompact: {
      height: 32,
      borderRadius: 16,
      paddingHorizontal: theme.spacing.sm
    },
    chipSecondary: {
      backgroundColor: colors.surfaceStrong
    },
    // Matches the prior hand-styled "+ New Circle" button's own treatment —
    // transparent fill, bordered, primary-tinted text.
    chipOutline: {
      backgroundColor: "transparent",
      borderWidth: 1.5,
      borderColor: colors.primary
    },
    // The app's one standard sent treatment: dark-green fill, white text,
    // bold weight, plus a visibly thicker rim (2026-08-21, second pass —
    // a "✓ " label prefix was tried first, reverted the same day: it
    // measured into fitsAsCircle's own width check, tipping names that
    // used to fit as a true circle into pill shape instead once sent,
    // which wasn't wanted. Bold+rim carries the same non-colour signal
    // without touching label width at all, since it's chip decoration,
    // not text content). Was wrongly using the same backgroundColor as
    // the default unselected chip (colors.surfaceStrong) — a real
    // regression, not a deliberate softened look, since this shared
    // component is what Going Quiet/Reconnect/Taking Time's update all
    // render sent chips through. See docs/09-decision-log.md, 2026-08-12
    // and 2026-08-21.
    chipSent: {
      backgroundColor: colors.primary,
      borderWidth: 2.5,
      borderColor: colors.onPrimary
    },
    // A third, distinct shade — paler than chipSecondary's default sage,
    // not a tint of chipSent's dark green. Alpha over surfaceStrong rather
    // than a hand-picked hex so it stays correct across the light/dark and
    // normal/quiet palettes without four more colour constants. See
    // docs/09-decision-log.md, 2026-08-13.
    chipNotYetSent: {
      backgroundColor: `${colors.surfaceStrong}66`
    },
    chipSelected: {
      borderWidth: 2,
      borderColor: colors.text
    },
    // Neutral border colour — never colors.text/primary/focus, which all
    // already mean something (selected/sent/provisional) elsewhere on this
    // component. This is purely a seam, not a state signal.
    chipClusterSeam: {
      borderWidth: 1.5,
      borderColor: colors.border
    },
    // "+"'s own active-state ring — a filled tint plus a visibly thicker
    // border, since its normal outline treatment (chipOutline) is already a
    // thin border on transparent, and a same-weight ring on top of that
    // read as imperceptible on-device. A distinct temporary "open" state,
    // not the same treatment as a selected Circle's dark-green fill. See
    // docs/09-decision-log.md, 2026-08-11.
    chipSelectedOutline: {
      backgroundColor: colors.surfaceStrong,
      borderWidth: 3,
      borderColor: colors.primary
    },
    // colors.focus, not primary/error/link — a distinct "temporary,
    // provisional" meaning of its own, not borrowed from an existing one.
    // The border itself (vs. the standard fill-only look) is the shape
    // change pairing with this colour, per the app's colour-blindness-safe
    // rule. See docs/09-decision-log.md, 2026-08-20.
    chipProvisional: {
      borderWidth: 2,
      borderColor: colors.focus
    },
    // Outer ring + inner padding + the chip's own border together read as
    // two concentric lines — RN has no native "double" borderStyle.
    newlyAddedRing: {
      borderWidth: 1.5,
      borderColor: colors.focus,
      borderRadius: theme.radius.pill,
      padding: 3
    },
    chipPressed: {
      opacity: 0.7
    },
    labelText: {
      fontSize: 14,
      fontWeight: "600"
    },
    labelBold: {
      fontWeight: "800"
    },
    labelTextSecondary: {
      color: colors.primary
    },
    labelTextOutline: {
      color: colors.primary
    },
    // colors.onPrimary, not textMuted — this used to be textMuted, which
    // on chipSent's dark-green fill computes to roughly 1.4:1 contrast
    // (WCAG AA needs 4.5:1 for normal text), nowhere close to legible.
    // onPrimary is the pairing used everywhere else text sits on a
    // colors.primary fill (~9:1) and matches this style's own original
    // "white text" description above — found and fixed while touching
    // this block for the bold-weight change, not a separate audit pass.
    // See docs/09-decision-log.md, 2026-08-21.
    labelTextSent: {
      color: colors.onPrimary,
      fontWeight: "800"
    },
    labelTextNotYetSent: {
      color: colors.textMuted
    }
  });
}
