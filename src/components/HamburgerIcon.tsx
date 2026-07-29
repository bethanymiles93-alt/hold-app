import { StyleSheet, View } from "react-native";
import { theme } from "@/constants/theme";

interface HamburgerIconProps {
  size?: number;
}

/** CSS-only placeholder "menu" glyph: three lines. */
export function HamburgerIcon({ size = 20 }: HamburgerIconProps) {
  return (
    <View accessibilityElementsHidden style={[styles.frame, { width: size, height: size }]}>
      <View style={styles.line} />
      <View style={styles.line} />
      <View style={styles.line} />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    justifyContent: "space-between",
    paddingVertical: 2
  },
  line: {
    height: 1.5,
    borderRadius: 1,
    backgroundColor: theme.colors.text
  }
});
