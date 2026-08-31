import { useMemo } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { WarmthSlider } from "@/components/WarmthSlider";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useDisplaySettings } from "@/context/DisplaySettingsContext";
import type { ColorSchemeOverride, DisplayTheme, FontChoice, TextSize } from "@/services/displaySettingsService";

const SCHEME_OPTIONS: { value: ColorSchemeOverride; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" }
];

const TEXT_SIZE_OPTIONS: { value: TextSize; label: string }[] = [
  { value: "small", label: "Small" },
  { value: "default", label: "Default" },
  { value: "large", label: "Large" },
  { value: "extraLarge", label: "Extra large" }
];

// Verdana/Arial/Open Sans considered and cut as redundant with System
// default — see docs/09-decision-log.md, 2026-08-12.
const FONT_OPTIONS: { value: FontChoice; label: string }[] = [
  { value: "system", label: "System default" },
  { value: "lexend", label: "Lexend" },
  { value: "atkinsonHyperlegible", label: "Atkinson Hyperlegible" },
  { value: "openDyslexic", label: "OpenDyslexic" }
];

// Beach/Forest/Meadow got real colours 2026-08-31 (a background-tint blend,
// same safe pattern warmth uses — see displayThemeColors.ts). Seasonal
// stays disabled deliberately, not just unfinished — it implies
// auto-rotating by time of year, a different kind of feature needing real
// date logic, not just an anchor colour. See docs/09-decision-log.md.
const DISPLAY_THEME_OPTIONS: { value: DisplayTheme; label: string }[] = [
  { value: "default", label: "Default" },
  { value: "beach", label: "Beach" },
  { value: "forest", label: "Forest" },
  { value: "meadow", label: "Meadow" },
  { value: "seasonal", label: "Seasonal" }
];

/**
 * "Accessibility & Display" — both sub-groups now present, per the confirmed
 * hold-book screen structure at 04-ux-content/04-navigation-architecture.md.
 * **Reading's text size and font choice are stored and selectable here, but
 * not yet applied app-wide** — this codebase has 200+ hardcoded fontSize
 * literals across 50+ files with no shared typography scale to hook into;
 * retrofitting that is separate, larger work, flagged rather than silently
 * claimed done. Reduce Motion's own in-app override IS fully functional —
 * `useReducedMotion()` (the one shared hook every animation in the app
 * already reads from) is additive with this preference. See
 * docs/09-decision-log.md, 2026-08-31.
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
    setMoonPhaseEnabled,
    textSize,
    setTextSize,
    fontChoice,
    setFontChoice,
    reduceMotionOverride,
    setReduceMotionOverride
  } = useDisplaySettings();

  return (
    <Screen>
      <Text style={styles.intro}>
        How Hold looks and reads — text size and font, colour scheme, a warm tint on top of it, and
        the visual theme.
      </Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Text size</Text>
        <Text style={styles.sectionBody}>
          Being rolled out across Hold's screens — some text may not reflect this yet.
        </Text>
        <View style={styles.optionRow}>
          {TEXT_SIZE_OPTIONS.map((option) => {
            const selected = textSize === option.value;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={option.label}
                onPress={() => setTextSize(option.value)}
                style={[styles.pill, selected && styles.pillSelected]}
              >
                <Text style={[styles.pillText, selected && styles.pillTextSelected]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Font</Text>
        <Text style={styles.sectionBody}>
          Lexend (visual-processing research), Atkinson Hyperlegible (low vision), and OpenDyslexic
          (dyslexia-specific letterforms) are alternatives to the system default. Being rolled out
          across Hold's screens — some text may not reflect this yet.
        </Text>
        <View style={styles.optionRow}>
          {FONT_OPTIONS.map((option) => {
            const selected = fontChoice === option.value;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={option.label}
                onPress={() => setFontChoice(option.value)}
                style={[styles.pill, selected && styles.pillSelected]}
              >
                <Text style={[styles.pillText, selected && styles.pillTextSelected]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.switchRow}>
          <View style={styles.switchRowText}>
            <Text style={styles.sectionTitle}>Reduce motion</Text>
            <Text style={styles.sectionBody}>
              Turns off animation in Hold even if your device's own Reduce Motion setting is off.
            </Text>
          </View>
          <Switch
            accessibilityLabel="Reduce motion within Hold"
            value={reduceMotionOverride}
            onValueChange={setReduceMotionOverride}
            trackColor={{ true: colors.primary, false: colors.border }}
          />
        </View>
      </View>

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
          Seasonal isn't built yet — the rest are shown so you can see what's planned.
        </Text>
        <View style={styles.optionRow}>
          {DISPLAY_THEME_OPTIONS.map((option) => {
            const selected = displayTheme === option.value;
            const disabled = option.value === "seasonal";
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
