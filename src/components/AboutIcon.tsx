import { StyleSheet, Text, View } from "react-native";
import { theme } from "@/constants/theme";

interface AboutIconProps {
  size?: number;
}

/** CSS-only placeholder "about" glyph: a simple circled "i". */
export function AboutIcon({ size = 20 }: AboutIconProps) {
  return (
    <View
      accessibilityElementsHidden
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2 }
      ]}
    >
      <Text style={[styles.letter, { fontSize: size * 0.62 }]}>i</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    borderWidth: 1.5,
    borderColor: theme.colors.text,
    alignItems: "center",
    justifyContent: "center"
  },
  letter: {
    color: theme.colors.text,
    fontWeight: "700",
    fontStyle: "italic"
  }
});
