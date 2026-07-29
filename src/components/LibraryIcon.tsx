import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";

interface LibraryIconProps {
  size?: number;
}

/** CSS-only placeholder "library" glyph: a simple speech-bubble outline. */
export function LibraryIcon({ size = 20 }: LibraryIconProps) {
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);
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

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    frame: {
      position: "relative"
    },
    bubble: {
      borderWidth: 1.5,
      borderColor: colors.text,
      backgroundColor: "transparent"
    },
    tail: {
      position: "absolute",
      borderBottomWidth: 1.5,
      borderRightWidth: 1.5,
      borderColor: colors.text,
      backgroundColor: colors.background,
      transform: [{ rotate: "45deg" }]
    }
  });
}
