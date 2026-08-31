import { useMemo } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { router } from "expo-router";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";
import { findPageForFinding } from "@/constants/researchContent";

interface CitationMarkerProps {
  /** A finding id from researchContent.ts — navigates straight to the concept page that finding lives on. */
  researchSectionId: string;
}

/**
 * Small, muted, secondary-weight tap target — deliberately not an academic
 * footnote number, matching the tone of the "Where this comes from" link
 * already used in Manage Circles. Only ever placed on the "common
 * humanity" line of a Transition screen's drafted sequence, per hold-book
 * 04-ux-content/04-navigation-architecture.md's "Citation marker
 * mechanism." Appearance/behaviour unchanged 2026-08-31 when Research
 * itself was restructured into an index + six concept pages — only the
 * navigation target changed, from a scroll-anchor on one long page to a
 * real subpage route. See docs/09-decision-log.md.
 */
export function CitationMarker({ researchSectionId }: CitationMarkerProps) {
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);

  const handlePress = () => {
    const page = findPageForFinding(researchSectionId);
    if (page) {
      router.push({ pathname: "/research/[slug]", params: { slug: page.slug } });
    } else {
      // Falls back to the index rather than doing nothing if a finding id
      // ever goes stale against a content reshuffle — still lands
      // somewhere useful.
      router.push({ pathname: "/(tabs)/library", params: { tab: "research" } });
    }
  };

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel="Why this is true"
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      onPress={handlePress}
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
