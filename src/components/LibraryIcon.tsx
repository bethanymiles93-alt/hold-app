import { StyleSheet, View } from "react-native";
import { theme } from "@/constants/theme";

interface LibraryIconProps {
  size?: number;
}

/** CSS-only placeholder "library" glyph: a simple speech-bubble outline. */
export function LibraryIcon({ size = 20 }: LibraryIconProps) {
  const tailSize = size * 0.22;

  return (
    <View
      accessibilityElementsHidden
      style={[styles.frame, { width: size, height: size }]}
    >
      <View
        style={[
          styles.bubble,
          {
            width: size,
            height: size * 0.78,
            borderRadius: size * 0.3
          }
        ]}
      />
      <View
        style={[
          styles.tail,
          {
            width: tailSize,
            height: tailSize,
            left: size * 0.22,
            bottom: 0
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
  bubble: {
    borderWidth: 1.5,
    borderColor: theme.colors.text,
    backgroundColor: "transparent"
  },
  tail: {
    position: "absolute",
    borderBottomWidth: 1.5,
    borderRightWidth: 1.5,
    borderColor: theme.colors.text,
    backgroundColor: theme.colors.background,
    transform: [{ rotate: "45deg" }]
  }
});
