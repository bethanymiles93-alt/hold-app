import { useMemo } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { router, type Href } from "expo-router";
import { type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useSettingsDrawer } from "@/context/SettingsDrawerContext";

/**
 * Replaces the native header's default back button everywhere. Two jobs:
 * flush, unstyled treatment (no pill/background, matching the hamburger's
 * own always-flush look) and, when the Settings drawer was opened from a
 * flow screen (Going Quiet, Taking Time's update, Reconnect), returning
 * there directly regardless of how many settings screens were visited in
 * between — rather than the default one-screen-at-a-time stack pop, which
 * would otherwise walk back through each intermediate settings screen.
 */
export function SettingsBackButton() {
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { originRoute, clearOriginRoute } = useSettingsDrawer();

  const goBack = () => {
    if (originRoute) {
      clearOriginRoute();
      router.dismissTo(originRoute as Href);
      return;
    }

    router.back();
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back"
      onPress={goBack}
      android_ripple={{ color: "transparent", borderless: true }}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Text style={styles.chevron}>‹</Text>
      <Text style={styles.label}>Back</Text>
    </Pressable>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    button: {
      flexDirection: "row",
      alignItems: "center",
      minHeight: 44,
      backgroundColor: "transparent"
    },
    pressed: {
      backgroundColor: "transparent",
      opacity: 0.6
    },
    chevron: {
      color: colors.text,
      fontSize: 26,
      fontWeight: "400",
      marginRight: 2,
      marginTop: -2
    },
    label: {
      color: colors.text,
      fontSize: 17
    }
  });
}
