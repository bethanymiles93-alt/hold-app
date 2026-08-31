import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";
import { RESEARCH_INDEX_INTRO, RESEARCH_PAGES, findFindingWithPage } from "@/constants/researchContent";
import { getHiddenFindingIds, unhideFinding } from "@/services/researchHiddenService";

/**
 * Research's own landing page — six concept-page cards replacing the old
 * single long scroll (2026-08-31). Meta/design-process content (what
 * guided Hold's design, low-capacity design, trauma-informed principles,
 * accessibility, where Hold sits, the guilt-spiral-and-voice rationale)
 * stays here as intro text rather than being forced into one of the six
 * citation-heavy concept pages, none of which it actually fits. See
 * docs/09-decision-log.md.
 */
export function ResearchIndex() {
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [showHidden, setShowHidden] = useState(false);

  useEffect(() => {
    void getHiddenFindingIds().then(setHiddenIds);
  }, []);

  const hiddenEntries = [...hiddenIds]
    .map((id) => findFindingWithPage(id))
    .filter((entry): entry is NonNullable<typeof entry> => entry !== undefined);

  const handleUnhide = (findingId: string) => {
    void unhideFinding(findingId).then(() => {
      setHiddenIds((current) => {
        const next = new Set(current);
        next.delete(findingId);
        return next;
      });
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.introTitle}>{RESEARCH_INDEX_INTRO.title}</Text>
      <Text style={styles.introBody}>{RESEARCH_INDEX_INTRO.body}</Text>

      <View style={styles.cards}>
        {RESEARCH_PAGES.map((page) => (
          <Pressable
            key={page.slug}
            accessibilityRole="button"
            accessibilityLabel={page.title}
            onPress={() => router.push({ pathname: "/research/[slug]", params: { slug: page.slug } })}
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          >
            <View style={styles.cardTextBlock}>
              <Text style={styles.cardTitle}>{page.title}</Text>
              <Text style={styles.cardBody} numberOfLines={2}>
                {page.intro}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </Pressable>
        ))}
      </View>

      {hiddenEntries.length > 0 ? (
        <View style={styles.hiddenSection}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: showHidden }}
            onPress={() => setShowHidden((current) => !current)}
            style={styles.hiddenToggle}
          >
            <Text style={styles.hiddenToggleText}>
              {showHidden ? "Hide hidden items" : `Show hidden (${hiddenEntries.length})`}
            </Text>
          </Pressable>

          {showHidden ? (
            <View style={styles.hiddenList}>
              {hiddenEntries.map(({ page, finding }) => (
                <View key={finding.id} style={styles.hiddenRow}>
                  <Text style={styles.hiddenRowText}>{page.title}</Text>
                  <Pressable accessibilityRole="button" onPress={() => handleUnhide(finding.id)} hitSlop={8}>
                    <Text style={styles.unhideText}>Unhide</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      gap: theme.spacing.xl
    },
    introTitle: {
      color: colors.text,
      fontSize: 17,
      fontWeight: "600"
    },
    introBody: {
      color: colors.textMuted,
      fontSize: 15,
      lineHeight: 23
    },
    cards: {
      gap: theme.spacing.sm
    },
    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      padding: theme.spacing.md,
      borderRadius: theme.radius.md,
      backgroundColor: colors.surface
    },
    cardPressed: {
      opacity: 0.7
    },
    cardTextBlock: {
      flex: 1,
      gap: 2
    },
    cardTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "600"
    },
    cardBody: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 18
    },
    hiddenSection: {
      gap: theme.spacing.sm
    },
    hiddenToggle: {
      minHeight: 44,
      justifyContent: "center"
    },
    hiddenToggleText: {
      color: colors.link,
      fontSize: 14,
      fontWeight: "600"
    },
    hiddenList: {
      gap: theme.spacing.xs
    },
    hiddenRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: theme.spacing.sm,
      borderRadius: theme.radius.md,
      backgroundColor: colors.surfaceStrong
    },
    hiddenRowText: {
      color: colors.textMuted,
      fontSize: 13
    },
    unhideText: {
      color: colors.link,
      fontSize: 13,
      fontWeight: "600"
    }
  });
}
