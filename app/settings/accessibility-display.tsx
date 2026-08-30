import { useMemo } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { WarmthSlider } from "@/components/WarmthSlider";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useDisplaySettings } from "@/context/DisplaySettingsContext";
import type { ColorSchemeOverride, DisplayTheme } from "@/services/displaySettingsService";

const SCHEME_OPTIONS: { value: ColorSchemeOverride; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" }
];

// Only "default" renders a real palette — the rest are named here so the
// intended option set is visible, not invented on the spot. Disabled until
// each one actually has palette values designed. See
// src/services/displaySettingsService.ts.
const DISPLAY_THEME_OPTIONS: { value: DisplayTheme; label: string }[] = [
  { value: "default", label: "Default" },
  { value: "beach", label: "Beach" },
  { value: "forest", label: "Forest" },
  { value: "meadow", label: "Meadow" },
  { value: "seasonal", label: "Seasonal" }
];

/**
 * "Accessibility & Display" — Look & Feel sub-group only (display theme,
 * warmth bar, Light/Dark/System, moon phase toggle), per the confirmed
 * hold-book screen structure at 04-ux-content/04-navigation-architecture.md.
 * The Reading sub-group (text size, font picker, in-app Reduce Motion
 * override) is specced there too but explicitly out of scope for this pass —
 * not built here. See docs/09-decision-log.md, 2026-08-22.
 */
export default function AccessibilityDisplayScreen() {
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);
  const {
    warmthOffset,
    setWarmthOffset,
    colorSchemeOverride,
    setColorSchemeOverride,
    displayTheme,
    setDisplayTheme,
    moonPhaseEnabled,
    setMoonPhaseEnabled
  } = useDisplaySettings();

  return (
    <Screen>
      <Text style={styles.intro}>
        How Hold looks — colour scheme, a warm/cool tint on top of it, and the visual theme.
      </Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Appearance</Text>
        <View style={styles.optionRow}>
          {SCHEME_OPTIONS.map((option) => {
            const selected = colorSchemeOverride === option.value;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={option.label}
                onPress={() => setColorSchemeOverride(option.value)}
                style={[styles.pill, selected && styles.pillSelected]}
              >
                <Text style={[styles.pillText, selected && styles.pillTextSelected]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Warmth</Text>
        <Text style={styles.sectionBody}>
          Nudges the background warmer still, on top of Hold's own warm base tone — not a separate
          colour scheme. Contrast against text stays checked across the full range.
        </Text>
        <WarmthSlider value={warmthOffset} onChange={setWarmthOffset} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Display theme</Text>
        <Text style={styles.sectionBody}>
          Only Default is built so far — the rest are shown so you can see what's planned.
        </Text>
        <View style={styles.optionRow}>
          {DISPLAY_THEME_OPTIONS.map((option) => {
            const selected = displayTheme === option.value;
            const disabled = option.value !== "default";
            return (
              <Pressable
                key={option.value}
                disabled={disabled}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected, disabled }}
                accessibilityLabel={disabled ? `${option.label}, coming later` : option.label}
                onPress={() => setDisplayTheme(option.value)}
                style={[styles.pill, selected && styles.pillSelected, disabled && styles.pillDisabled]}
              >
                <Text style={[styles.pillText, selected && styles.pillTextSelected, disabled && styles.pillTextDisabled]}>
                  {option.label}
                </Text>
                {disabled ? <Text style={styles.pillTag}>Coming later</Text> : null}
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.switchRow}>
          <View style={styles.switchRowText}>
            <Text style={styles.sectionTitle}>Moon phase</Text>
            <Text style={styles.sectionBody}>A small moon marker that tracks the current phase.</Text>
          </View>
          <Switch
            accessibilityLabel="Show moon phase"
            value={moonPhaseEnabled}
            onValueChange={setMoonPhaseEnabled}
            trackColor={{ true: colors.primary, false: colors.border }}
          />
        </View>
      </View>
    </Screen>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    intro: {
      color: colors.textMuted,
      fontSize: 15,
      lineHeight: 22
    },
    section: {
      marginTop: theme.spacing.xl,
      gap: theme.spacing.sm
    },
    sectionTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "600"
    },
    sectionBody: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 20
    },
    optionRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.sm,
      marginTop: theme.spacing.xs
    },
    pill: {
      minHeight: 44,
      justifyContent: "center",
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.radius.pill,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surface
    },
    pillSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primary
    },
    pillDisabled: {
      opacity: 0.5
    },
    pillText: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "600"
    },
    pillTextSelected: {
      color: colors.onPrimary
    },
    pillTextDisabled: {
      color: colors.textMuted
    },
    pillTag: {
      color: colors.textMuted,
      fontSize: 10,
      marginTop: 2
    },
    switchRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md
    },
    switchRowText: {
      flex: 1,
      gap: 2
    }
  });
}
