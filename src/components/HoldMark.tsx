import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";

interface HoldMarkProps {
  size?: number;
}

/**
 * CSS-only placeholder for the held-circle mark.
 * Replace with the approved vector asset without changing its semantic role.
 */
export function HoldMark({ size = 64 }: HoldMarkProps) {
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);
  const circle = size * 0.48;

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel="Hold symbol"
      style={[styles.frame, { width: size, height: size }]}
    >
      <View
        style={[
          styles.circle,
          {
            width: circle,
            height: circle,
            borderRadius: circle / 2,
            left: (size - circle) / 2,
            top: size * 0.12
          }
        ]}
      />
      <View
        style={[
          styles.hand,
          {
            width: size * 0.64,
            height: size * 0.27,
            borderRadius: size * 0.15,
            left: size * 0.18,
            bottom: size * 0.12
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
    circle: {
      position: "absolute",
      backgroundColor: colors.surfaceStrong,
      borderWidth: 2,
      borderColor: colors.primary
    },
    hand: {
      position: "absolute",
      backgroundColor: colors.primary
    }
  });
}
