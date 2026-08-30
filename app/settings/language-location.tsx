import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Screen } from "@/components/Screen";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";
import { CRISIS_RESOURCES } from "@/constants/crisisResources";
import {
  getLanguageLocationSettings,
  setLanguage,
  setRegion,
  type Language,
  type Region
} from "@/services/languageLocationService";

const LANGUAGE_OPTIONS: { value: Language; label: string }[] = [
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
  { value: "fr", label: "Français" },
  { value: "de", label: "Deutsch" }
];

const REGION_OPTIONS: { value: Region; label: string }[] = [
  { value: "uk", label: "United Kingdom" },
  { value: "ie", label: "Ireland" },
  { value: "us", label: "United States" },
  { value: "ca", label: "Canada" },
  { value: "au", label: "Australia" },
  { value: "nz", label: "New Zealand" },
  { value: "other", label: "Other" }
];

/**
 * "Language & Location" (2026-08-31) — replaces the standalone "Language"
 * drawer stub, merged per direct instruction: region determines which
 * crisis/safeguarding resources someone is shown, so language and region
 * belong together, not as separate settings that can drift. Kept in the
 * practical top group of the drawer, not moved near Privacy/Terms — this
 * is a safety-relevant setting, not legal boilerplate.
 *
 * **Not yet shared with an onboarding step** — hold-book's own
 * 03-safeguarding.md documents a decided (not built) onboarding
 * confirmation step reading/writing the same preference this screen
 * would read/write; that onboarding step doesn't exist in this codebase
 * yet (confirmed directly, not assumed), so this screen is currently the
 * only source of truth. When onboarding is built, it should read/write
 * this exact preference, not a second one.
 *
 * **Language is stored only, not yet applied** — no translation system
 * exists in this codebase (every screen's copy is English-only). Region
 * IS genuinely functional: it drives the real crisis-resource list below,
 * sourced from hold-book's own verified "core six" research
 * (06-privacy-security/03-safeguarding.md).
 */
export default function LanguageLocationScreen() {
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [language, setLanguageState] = useState<Language>("en");
  const [region, setRegionState] = useState<Region>("uk");

  useFocusEffect(
    useCallback(() => {
      void getLanguageLocationSettings().then((settings) => {
        setLanguageState(settings.language);
        setRegionState(settings.region);
      });
    }, [])
  );

  const chooseLanguage = (value: Language) => {
    setLanguageState(value);
    void setLanguage(value);
  };

  const chooseRegion = (value: Region) => {
    setRegionState(value);
    void setRegion(value);
  };

  const resources = CRISIS_RESOURCES[region];

  return (
    <Screen>
      <Text style={styles.intro}>
        Your language and region — region determines which crisis and safeguarding resources Hold
        shows you.
      </Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Language</Text>
        <Text style={styles.sectionBody}>
          Only English is built so far — the rest are shown so you can see what's planned.
        </Text>
        <View style={styles.optionRow}>
          {LANGUAGE_OPTIONS.map((option) => {
            const selected = language === option.value;
            const disabled = option.value !== "en";
            return (
              <Pressable
                key={option.value}
                disabled={disabled}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected, disabled }}
                accessibilityLabel={disabled ? `${option.label}, coming later` : option.label}
                onPress={() => chooseLanguage(option.value)}
                style={[styles.pill, selected && styles.pillSelected, disabled && styles.pillDisabled]}
              >
                <Text style={[styles.pillText, selected && styles.pillTextSelected, disabled && styles.pillTextDisabled]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Region</Text>
        <View style={styles.optionRow}>
          {REGION_OPTIONS.map((option) => {
            const selected = region === option.value;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={option.label}
                onPress={() => chooseRegion(option.value)}
                style={[styles.pill, selected && styles.pillSelected]}
              >
                <Text style={[styles.pillText, selected && styles.pillTextSelected]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Crisis and safeguarding resources</Text>
        <View style={styles.resourceList}>
          {resources.map((resource) => (
            <View key={resource.label} style={styles.resourceRow}>
              <Text style={styles.resourceLabel}>{resource.label}</Text>
              <Text style={styles.resourceDetail}>{resource.detail}</Text>
            </View>
          ))}
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
    resourceList: {
      gap: theme.spacing.sm,
      marginTop: theme.spacing.xs
    },
    resourceRow: {
      padding: theme.spacing.md,
      borderRadius: theme.radius.md,
      backgroundColor: colors.surfaceStrong,
      gap: 2
    },
    resourceLabel: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "600"
    },
    resourceDetail: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 20
    }
  });
}
