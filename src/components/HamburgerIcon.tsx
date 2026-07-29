import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";

interface HamburgerIconProps {
  size?: number;
}

/** CSS-only placeholder "menu" glyph: three lines. */
export function HamburgerIcon({ size = 20 }: HamburgerIconProps) {
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View accessibilityElementsHidden style={[styles.frame, { width: size, height: size }]}>
      <View style={styles.line} />
      <View style={styles.line} />
      <View style={styles.line} />
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    frame: {
      justifyContent: "space-between",
      paddingVertical: 2
    },
    line: {
      height: 1.5,
      borderRadius: 1,
      backgroundColor: colors.text
    }
  });
}
