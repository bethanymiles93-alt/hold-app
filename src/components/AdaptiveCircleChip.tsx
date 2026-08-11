import { useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  type NativeSyntheticEvent,
  type TextLayoutEventData
} from "react-native";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";

interface AdaptiveCircleChipProps {
  label: string;
  isSelected: boolean;
  /** Whether a message has already been sent to this Circle/person this session — see the priority order below. */
  hasSentThisSession?: boolean;
  onPress: () => void;
  /** Bordered/transparent treatment instead of a filled circle/pill — e.g. the "+" New Circle button. */
  outline?: boolean;
  accessibilityRole?: "checkbox" | "button";
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
  onPress,
  outline = false,
  accessibilityRole = "checkbox",
  accessibilityLabel,
  expanded,
  labelFontSize,
  labelBold
}: AdaptiveCircleChipProps) {
  const { colors } = useAppTheme("normal");
  const styles = createStyles(colors);
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null);

  const onTextLayout = (event: NativeSyntheticEvent<TextLayoutEventData>) => {
    const line = event.nativeEvent.lines[0];
    if (!line) return;
    if (measuredWidth === line.width) return;
    setMeasuredWidth(line.width);
  };

  const availableCircleWidth = STANDARD_CHIP_DIAMETER - CIRCLE_FIT_PADDING * 2;
  const fitsAsCircle = measuredWidth !== null && measuredWidth <= availableCircleWidth;

  const shapeStyle = fitsAsCircle
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
  // wins, per the priority order above.
  const showSentFill = !isSelected && hasSentThisSession;

  const variantStyle = showSentFill ? styles.chipSent : outline ? styles.chipOutline : styles.chipSecondary;
  const labelVariantStyle = showSentFill
    ? styles.labelTextSent
    : outline
      ? styles.labelTextOutline
      : styles.labelTextSecondary;

  // Outline chips ("+") have no ring path of their own by default — the
  // standard chipSelected ring only ever applied to filled chips. Without
  // this, "+"'s active/selected state was invisible (see decision log,
  // 2026-08-11) rather than just thin.
  const selectedRingStyle = outline ? styles.chipSelectedOutline : styles.chipSelected;

  return (
    <Pressable
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={expanded !== undefined ? { expanded } : { checked: isSelected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        shapeStyle,
        variantStyle,
        isSelected && selectedRingStyle,
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
        {label}
      </Text>
    </Pressable>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    chip: {
      alignItems: "center",
      justifyContent: "center"
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
    // Matches reconnect.tsx/update.tsx's existing sent-chip convention —
    // softened/desaturated fill, muted text, no selection ring.
    chipSent: {
      backgroundColor: colors.surfaceStrong
    },
    chipSelected: {
      borderWidth: 2,
      borderColor: colors.text
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
    labelTextSent: {
      color: colors.textMuted
    }
  });
}
