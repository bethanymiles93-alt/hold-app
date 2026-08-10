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
  accessibilityRole?: "checkbox" | "button";
}

// Hard minimum tap target for either shape — a FLOOR, not a fixed cap: the
// container grows beyond this if the text's own measured line height needs
// more room at a large accessibility font size, but never shrinks below it.
// See hold-book 04-ux-content/04-navigation-architecture.md, "Circle shape."
const MIN_DIAMETER = Platform.OS === "android" ? 48 : 44;
// A circle is also allowed to grow beyond MIN_DIAMETER to fit short-word
// labels ("Close," "Friends") as an actual circle, not just single
// characters — capped here so it doesn't keep growing into an oversized
// blob once a label is genuinely long enough to read better as a pill.
const MAX_CIRCLE_DIAMETER = MIN_DIAMETER * 1.5;
const HORIZONTAL_PADDING = theme.spacing.sm;
const VERTICAL_PADDING = theme.spacing.xs;

/**
 * The one Circle-chip treatment used everywhere a Circle can be picked.
 * Supersedes CirclePill's pill-only shape: renders as a TRUE CIRCLE, sized
 * to fit the label (never below MIN_DIAMETER, never above
 * MAX_CIRCLE_DIAMETER), when the label fits within that range; otherwise
 * falls back to the stadium-pill shape, sized to the text.
 *
 * Two bugs fixed here across two passes:
 * 1. The first version measured via an invisible position:'absolute' +
 *    opacity:0 Text read through onLayout, which doesn't reliably
 *    shrink-wrap to its own content inside a flex row — it picked up
 *    ambient sizing from the row instead, so every measured width came
 *    back far larger than the real glyph width. Fixed by measuring via
 *    onTextLayout on the real, always-rendered Text, which reports the
 *    line's own width/height directly off the glyph run.
 * 2. Even with accurate measurement, the circle was never allowed to grow
 *    past a fixed MIN_DIAMETER — so the available inner width (diameter
 *    minus padding) was only ~24pt, which no real word fits at normal text
 *    size ("Close" alone needs roughly 35-40pt). That made the circle
 *    branch effectively unreachable for anything but a single narrow
 *    character. Fixed by letting the circle's diameter grow to fit the
 *    label (still floored at MIN_DIAMETER, now also capped at
 *    MAX_CIRCLE_DIAMETER) — only labels that would need a genuinely
 *    oversized circle fall back to a pill.
 *
 * onTextLayout also naturally re-fires on any relayout, including a live
 * Dynamic Type / accessibility text-size change, so no separate font-scale
 * listener is needed.
 */
export function AdaptiveCircleChip({
  label,
  selected,
  onPress,
  isPrimary = false,
  accessibilityRole = "checkbox"
}: AdaptiveCircleChipProps) {
  const { colors } = useAppTheme("normal");
  const styles = createStyles(colors);
  const [measured, setMeasured] = useState<{ width: number; height: number } | null>(null);

  const onTextLayout = (event: NativeSyntheticEvent<TextLayoutEventData>) => {
    const line = event.nativeEvent.lines[0];
    if (!line) return;
    if (measured && measured.width === line.width && measured.height === line.height) return;
    setMeasured({ width: line.width, height: line.height });
  };

  // The circle a label would need, if it fit inside one at all — floored at
  // the hard minimum, sized up from there to actually contain the text in
  // both dimensions.
  const naturalCircleDiameter =
    measured === null
      ? MIN_DIAMETER
      : Math.max(
          MIN_DIAMETER,
          measured.width + HORIZONTAL_PADDING * 2,
          measured.height + VERTICAL_PADDING * 2
        );
  const fitsAsCircle = measured !== null && naturalCircleDiameter <= MAX_CIRCLE_DIAMETER;

  // Pill height is the same floor-not-cap logic, uncapped on the growth
  // side — a pill's width isn't capped either, so there's no MAX to apply.
  const pillHeight = Math.max(MIN_DIAMETER, (measured?.height ?? 0) + VERTICAL_PADDING * 2);

  const shapeStyle = fitsAsCircle
    ? {
        width: naturalCircleDiameter,
        height: naturalCircleDiameter,
        borderRadius: naturalCircleDiameter / 2
      }
    : {
        minWidth: MIN_DIAMETER,
        height: pillHeight,
        borderRadius: pillHeight / 2,
        paddingHorizontal: HORIZONTAL_PADDING
      };

  return (
    <Pressable
      accessibilityRole={accessibilityRole}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={[
        styles.chip,
        shapeStyle,
        isPrimary ? styles.chipPrimary : styles.chipSecondary,
        selected && styles.chipSelected
      ]}
    >
      <Text
        numberOfLines={1}
        onTextLayout={onTextLayout}
        style={[styles.labelText, isPrimary ? styles.labelTextPrimary : styles.labelTextSecondary]}
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
    chipPrimary: {
      backgroundColor: colors.primary
    },
    chipSecondary: {
      backgroundColor: colors.surfaceStrong
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
    }
  });
}
