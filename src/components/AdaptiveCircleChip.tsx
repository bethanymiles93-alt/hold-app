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
const HORIZONTAL_PADDING = theme.spacing.sm;
const VERTICAL_PADDING = theme.spacing.xs;

/**
 * The one Circle-chip treatment used everywhere a Circle can be picked.
 * Supersedes CirclePill's pill-only shape: renders as a TRUE CIRCLE when the
 * label's actual rendered text fits inside MIN_DIAMETER at the current font
 * size; otherwise falls back to the stadium-pill shape, sized to the text.
 *
 * Measured via onTextLayout on the real, always-rendered Text — not a
 * separate invisible measuring pass. An earlier version used a
 * position:'absolute'+opacity:0 Text measured via onLayout, sized by its
 * container rather than its own intrinsic content: inside a flex row
 * (ScrollView's horizontal contentContainerStyle, or a wrapping View), an
 * absolutely-positioned child with no explicit width still picks up
 * ambient sizing from the parent's layout under some alignItems/flex
 * combinations, rather than reliably shrinking to its own content — so
 * every measured width came back far larger than the actual glyph width,
 * which meant every label failed the circle-fits check, even single
 * characters. onTextLayout instead reports the rendered line's own
 * width/height directly off the glyph run, independent of any container
 * box — not affected by that failure mode. It also naturally re-fires on
 * any relayout, including a live Dynamic Type / accessibility text-size
 * change, so no separate font-scale listener is needed.
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

  const availableCircleWidth = MIN_DIAMETER - HORIZONTAL_PADDING * 2;
  const fitsAsCircle = measured !== null && measured.width <= availableCircleWidth;

  // Floor, not a cap — see MIN_DIAMETER's comment above.
  const size = Math.max(MIN_DIAMETER, (measured?.height ?? 0) + VERTICAL_PADDING * 2);

  const shapeStyle = fitsAsCircle
    ? { width: size, height: size, borderRadius: size / 2 }
    : {
        minWidth: MIN_DIAMETER,
        height: size,
        borderRadius: size / 2,
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
