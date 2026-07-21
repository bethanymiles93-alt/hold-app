import { StyleSheet, View } from "react-native";
import { theme } from "@/constants/theme";

interface HoldMarkProps {
  size?: number;
}

/**
 * CSS-only placeholder for the held-circle mark.
 * Replace with the approved vector asset without changing its semantic role.
 */
export function HoldMark({ size = 64 }: HoldMarkProps) {
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

const styles = StyleSheet.create({
  frame: {
    position: "relative"
  },
  circle: {
    position: "absolute",
    backgroundColor: theme.colors.surfaceStrong,
    borderWidth: 2,
    borderColor: theme.colors.primary
  },
  hand: {
    position: "absolute",
    backgroundColor: theme.colors.primary
  }
});
