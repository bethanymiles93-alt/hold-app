import { useMemo } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { useNavigation } from "expo-router";
import { type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";

/**
 * Library's own header-left replacement for the bottom tab bar, which
 * Library never shows (enforced via navTier's TIER_1_PREFIXES, which
 * includes "/library" — see src/utils/navTier.ts) — Back returns to Home
 * via the tab navigator's own `navigate`, not a stack pop, since Library
 * is a tab root with no real back history of its own. Same flush,
 * unstyled chevron+label treatment as SettingsBackButton, for visual
 * consistency across the app's back buttons. See docs/09-decision-log.md,
 * 2026-08-13.
 */
export function LibraryBackButton() {
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);
  const navigation = useNavigation();

  const goHome = () => {
    navigation.navigate("index" as never);
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back"
      onPress={goHome}
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
