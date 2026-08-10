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
  selected: boolean;
  onPress: () => void;
  /** Close's stronger/primary fill, per the app's Circle-picker convention. */
  isPrimary?: boolean;
  /** Bordered/transparent treatment instead of a filled circle/pill — e.g. the "+" New Circle button. */
  outline?: boolean;
  accessibilityRole?: "checkbox" | "button";
  /** Defaults to `label` — set when the visible text ("+") isn't what a screen reader should announce. */
  accessibilityLabel?: string;
  /** When set, accessibilityState reports {expanded} instead of {checked: selected} — for a toggle-a-panel button like "+ New Circle" rather than a toggle-a-selection chip. */
  expanded?: boolean;
}

/**
 * One fixed height for every chip in the row — a flat +4 above the 44pt
 * (iOS) / 48dp (Android) accessibility tap-target floor, for deliberate
 * visual breathing room rather than sitting at the bare minimum. This is
 * NOT a floor with per-label growth (that was the prior, now-removed
 * design) — every chip is exactly this size, full stop, so the row reads
 * as one consistent set of shapes rather than a mix of heights.
 */
const STANDARD_CHIP_DIAMETER = Platform.OS === "android" ? 52 : 48;
const HORIZONTAL_PADDING = theme.spacing.sm;

/**
 * The one Circle-chip treatment used everywhere a Circle can be picked.
 *
 * Fixed-height model, replacing an earlier grow-to-fit-per-label design
 * (floor at the accessibility minimum, cap at 1.5x that, natural diameter
 * in between) that produced an inconsistent row — "D" sat at the bare
 * floor, "Close" sat noticeably taller, a pill sat taller still. Every
 * chip is now STANDARD_CHIP_DIAMETER tall, with no exceptions:
 * - If the label's measured text width fits inside STANDARD_CHIP_DIAMETER
 *   (minus horizontal padding on both sides) as a circle, it renders as a
 *   true circle at exactly that fixed size.
 * - Otherwise it renders as a pill at the exact same fixed height —
 *   literally the same circle, stretched wider — with its width growing
 *   to fit the text plus padding, uncapped.
 *
 * Text is measured via onTextLayout on the real, always-rendered Text
 * (reports the glyph run's own width directly, unaffected by container
 * sizing — see docs/09-decision-log.md, 2026-08-10, for why an earlier
 * invisible-measuring-Text approach measured wrong). It naturally re-fires
 * on any relayout, including a live Dynamic Type / accessibility
 * text-size change, so width — both the fits-as-circle decision and a
 * pill's actual rendered width — stays correct at any font size with no
 * separate font-scale listener needed.
 *
 * Height does NOT vary with font size, per direct instruction ("no
 * exceptions, no per-label height variation"). At very large accessibility
 * text sizes this means a label's rendered line height could exceed the
 * fixed chip height — numberOfLines={1} means it would clip rather than
 * wrap or grow the box. Flagged as an accepted trade-off of this
 * simplification, not silently worked around.
 */
export function AdaptiveCircleChip({
  label,
  selected,
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

  const availableCircleWidth = STANDARD_CHIP_DIAMETER - HORIZONTAL_PADDING * 2;
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
        paddingHorizontal: HORIZONTAL_PADDING
      };

  const variantStyle = outline ? styles.chipOutline : isPrimary ? styles.chipPrimary : styles.chipSecondary;
  const labelVariantStyle = outline
    ? styles.labelTextOutline
    : isPrimary
      ? styles.labelTextPrimary
      : styles.labelTextSecondary;

  return (
    <Pressable
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={expanded !== undefined ? { expanded } : { checked: selected }}
      onPress={onPress}
      style={[styles.chip, shapeStyle, variantStyle, !outline && selected && styles.chipSelected]}
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
    chipSelected: {
      borderWidth: 2,
      borderColor: colors.text
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
    }
  });
}
