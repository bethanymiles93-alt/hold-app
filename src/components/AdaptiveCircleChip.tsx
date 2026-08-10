import { useEffect, useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  type LayoutChangeEvent
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

// Hard minimum tap target for either shape, at any font size — see
// hold-book 04-ux-content/04-navigation-architecture.md, "Circle shape."
const MIN_DIAMETER = Platform.OS === "android" ? 48 : 44;
const SHAPE_PADDING = theme.spacing.sm;

/**
 * The one Circle-chip treatment used everywhere a Circle can be picked.
 * Supersedes CirclePill's pill-only shape: renders as a TRUE CIRCLE
 * (MIN_DIAMETER, the hard minimum tap target) when the label's actual
 * rendered text fits inside it at the current font size; otherwise falls
 * back to the existing stadium-pill shape, sized to the text. Re-measures
 * live against useWindowDimensions().fontScale, which RN's iOS bridge
 * re-emits on Dynamic Type / accessibility text-size changes (confirmed via
 * RCTDeviceInfo's RCTAccessibilityManagerDidUpdateMultiplierNotification
 * listener → didUpdateDimensions), not just on rotation.
 *
 * Two-pass render per distinct label: an invisible, unconstrained
 * measuring pass first (captures natural text width via onLayout), then
 * the real pressable shape once that width is known. One extra layout per
 * label/font-scale change, not per keystroke — acceptable for a short,
 * infrequently-changing picker row.
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
  const { fontScale } = useWindowDimensions();
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null);

  // A stale width from a previous label or font size must never linger —
  // re-measure whenever either changes.
  useEffect(() => {
    setMeasuredWidth(null);
  }, [label, fontScale]);

  const onMeasureLayout = (event: LayoutChangeEvent) => {
    setMeasuredWidth(event.nativeEvent.layout.width);
  };

  if (measuredWidth === null) {
    return (
      <Text style={[styles.labelText, styles.measuring]} onLayout={onMeasureLayout}>
        {label}
      </Text>
    );
  }

  const availableCircleWidth = MIN_DIAMETER - SHAPE_PADDING * 2;
  const fitsAsCircle = measuredWidth <= availableCircleWidth;

  const shapeStyle = fitsAsCircle
    ? { width: MIN_DIAMETER, height: MIN_DIAMETER, borderRadius: MIN_DIAMETER / 2 }
    : {
        width: measuredWidth + SHAPE_PADDING * 2,
        height: MIN_DIAMETER,
        borderRadius: MIN_DIAMETER / 2,
        paddingHorizontal: SHAPE_PADDING
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
        style={[styles.labelText, isPrimary ? styles.labelTextPrimary : styles.labelTextSecondary]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    measuring: {
      position: "absolute",
      opacity: 0
    },
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
