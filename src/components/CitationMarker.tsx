import { useMemo } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { router } from "expo-router";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";

interface CitationMarkerProps {
  /** A RESEARCH_SECTIONS id from ResearchContent.tsx — jumps Library's Research tab straight to that section rather than landing on an undifferentiated page. */
  researchSectionId: string;
}

/**
 * Small, muted, secondary-weight tap target — deliberately not an academic
 * footnote number, matching the tone of the "Where this comes from" link
 * already used in Manage Circles. Only ever placed on the "common
 * humanity" line of a Transition screen's drafted sequence, per hold-book
 * 04-ux-content/04-navigation-architecture.md's "Citation marker
 * mechanism." See docs/09-decision-log.md, 2026-08-30.
 */
export function CitationMarker({ researchSectionId }: CitationMarkerProps) {
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel="Why this is true"
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      onPress={() =>
        router.push({ pathname: "/(tabs)/library", params: { tab: "research", section: researchSectionId } })
      }
    >
      <Text style={styles.text}>Why this is true</Text>
    </Pressable>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    text: {
      color: colors.textMuted,
      fontSize: 12,
      fontStyle: "italic"
    }
  });
}
