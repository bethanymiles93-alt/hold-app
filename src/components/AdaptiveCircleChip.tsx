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
  /** Close's stronger/primary fill, per the app's Circle-picker convention. */
  isPrimary?: boolean;
  /** Bordered/transparent treatment instead of a filled circle/pill — e.g. the "+" New Circle button. */
  outline?: boolean;
  accessibilityRole?: "checkbox" | "button";
  /** Defaults to `label` — set when the visible text ("+") isn't what a screen reader should announce. */
  accessibilityLabel?: string;
  /** When set, accessibilityState reports {expanded} instead of {checked: isSelected} — for a toggle-a-panel button like "+ New Circle" rather than a toggle-a-selection chip. */
  expanded?: boolean;
}

/**
 * One fixed height for every chip in the row. Increased again (2026-08-11,
 * per direct instruction, chosen option — a final number given directly,
 * not measured from a screenshot) from 64pt/68dp to 72pt (iOS) / 76dp
 * (Android), so Going Quiet's and Manage Circles' chips can carry a
 * dropdown arrow (" ▼"/" ▲", appended into the measured label, same
 * technique Manage Circles already used) and still fit as true circles for
 * common short names. Estimated fit is tight for the longest names this
 * needs to cover ("Close ▼" ≈ 52pt against 52pt of available width at this
 * diameter — see the worked table in docs/09-decision-log.md) — flagged as
 * a close-to-the-line estimate, not a comfortable margin, pending on-device
 * confirmation.
 */
const STANDARD_CHIP_DIAMETER = Platform.OS === "android" ? 76 : 72;
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
  isPrimary = false,
  outline = false,
  accessibilityRole = "checkbox",
  accessibilityLabel,
  expanded
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

  const variantStyle = showSentFill
    ? styles.chipSent
    : outline
      ? styles.chipOutline
      : isPrimary
        ? styles.chipPrimary
        : styles.chipSecondary;
  const labelVariantStyle = showSentFill
    ? styles.labelTextSent
    : outline
      ? styles.labelTextOutline
      : isPrimary
        ? styles.labelTextPrimary
        : styles.labelTextSecondary;

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
        isSelected && !outline && styles.chipSelected,
        pressed && styles.chipPressed
      ]}
    >
      <Text numberOfLines={1} onTextLayout={onTextLayout} style={[styles.labelText, labelVariantStyle]}>
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
    chipPrimary: {
      backgroundColor: colors.primary
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
    chipPressed: {
      opacity: 0.7
    },
    labelText: {
      fontSize: 14,
      fontWeight: "600"
    },
    labelTextPrimary: {
      color: colors.onPrimary
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
