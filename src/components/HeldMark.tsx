import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";

interface HeldMarkProps {
  size?: number;
}

/**
 * Alternative mark under evaluation alongside HoldMark: two soft,
 * overlapping shapes suggesting an embrace rather than a circle held
 * by a hand. CSS-only placeholder, shown for comparison only.
 */
export function HeldMark({ size = 64 }: HeldMarkProps) {
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);
  const shape = size * 0.6;

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel="Held symbol (alternative)"
      style={[styles.frame, { width: size, height: size }]}
    >
      <View
        style={[
          styles.shape,
          styles.shapeBack,
          {
            width: shape,
            height: shape,
            borderRadius: shape / 2,
            left: size * 0.08,
            top: size * 0.16
          }
        ]}
      />
      <View
        style={[
          styles.shape,
          styles.shapeFront,
          {
            width: shape,
            height: shape,
            borderRadius: shape / 2,
            left: size * 0.32,
            top: size * 0.28
          }
        ]}
      />
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    frame: {
      position: "relative"
    },
    shape: {
      position: "absolute",
      borderWidth: 2
    },
    shapeBack: {
      backgroundColor: colors.surfaceStrong,
      borderColor: colors.primary,
      opacity: 0.85
    },
    shapeFront: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
      opacity: 0.8
    }
  });
}
