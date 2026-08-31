import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";
import { ResearchFindingText } from "@/components/ResearchFindingText";
import { getHiddenFindingIds, hideFinding } from "@/services/researchHiddenService";
import { shareMessage } from "@/services/shareService";
import { pageToPlainText, type ResearchPage } from "@/constants/researchContent";

interface ResearchConceptPageProps {
  page: ResearchPage;
}

const TAG_LABELS: Record<string, string> = {
  Causal: "Causal",
  Correlational: "Correlational",
  "Descriptive/qualitative": "Descriptive",
  Theoretical: "Theoretical",
  "Meta-analysis, mixed designs": "Meta-analysis",
  "Practitioner-driven, not peer-reviewed": "Not peer-reviewed"
};

export function ResearchConceptPage({ page }: ResearchConceptPageProps) {
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);
  const scrollRef = useRef<ScrollView>(null);
  const findingRefs = useRef<Record<string, View | null>>({});
  const referenceRefs = useRef<Record<string, View | null>>({});
  const lastFindingIdRef = useRef<string | null>(null);

  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [jumpedRefId, setJumpedRefId] = useState<string | null>(null);

  useEffect(() => {
    void getHiddenFindingIds().then(setHiddenIds);
  }, []);

  const visibleFindings = page.findings.filter((finding) => !hiddenIds.has(finding.id));

  const scrollToNode = (node: View | null) => {
    const scrollView = scrollRef.current;
    const innerViewNode = scrollView?.getInnerViewNode?.();
    if (!node || !scrollView || innerViewNode == null) return;
    node.measureLayout(
      innerViewNode,
      (_x, y) => scrollView.scrollTo({ y: Math.max(y - theme.spacing.lg, 0), animated: true }),
      () => {
        // Best-effort — the section is still reachable by scrolling normally if this fails.
      }
    );
  };

  const handleCitationPress = (refId: string, findingId: string) => {
    lastFindingIdRef.current = findingId;
    setJumpedRefId(refId);
    // A brief delay lets the just-set highlight style land before the
    // scroll starts, same reasoning the old single-page Research layout
    // used for its own anchor-jump timing.
    setTimeout(() => scrollToNode(referenceRefs.current[refId] ?? null), 50);
  };

  const handleBackToReading = () => {
    const findingId = lastFindingIdRef.current;
    setJumpedRefId(null);
    if (findingId) scrollToNode(findingRefs.current[findingId] ?? null);
  };

  const handleHide = (findingId: string) => {
    void hideFinding(findingId).then(() => {
      setHiddenIds((current) => new Set(current).add(findingId));
    });
  };

  const handleShare = () => {
    void shareMessage(pageToPlainText(page));
  };

  return (
    <Screen scrollRef={scrollRef} contentContainerStyle={styles.content}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{page.title}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Share ${page.title}`}
          onPress={handleShare}
          hitSlop={8}
          style={({ pressed }) => [styles.shareButton, pressed && styles.pressed]}
        >
          <Ionicons name="share-outline" size={22} color={colors.text} />
        </Pressable>
      </View>

      <Text style={styles.intro}>{page.intro}</Text>

      <View style={styles.findings}>
        {visibleFindings.map((finding) => (
          <View
            key={finding.id}
            ref={(node) => {
              findingRefs.current[finding.id] = node;
            }}
            style={styles.findingCard}
          >
            <ResearchFindingText
              segments={finding.segments}
              references={page.references}
              onCitationPress={(refId) => handleCitationPress(refId, finding.id)}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Not helpful for me — hide this"
              onPress={() => handleHide(finding.id)}
              hitSlop={8}
            >
              <Text style={styles.hideText}>Not helpful for me</Text>
            </Pressable>
          </View>
        ))}
      </View>

      <View style={styles.referencesSection}>
        <Text style={styles.referencesTitle}>References</Text>
        {page.references.map((reference) => {
          const isJumpedTo = jumpedRefId === reference.id;
          return (
            <View
              key={reference.id}
              ref={(node) => {
                referenceRefs.current[reference.id] = node;
              }}
              style={[styles.referenceRow, isJumpedTo && styles.referenceRowHighlighted]}
            >
              <Text style={styles.referenceText}>{reference.fullCitation}</Text>
              <Text style={styles.referenceTag}>{TAG_LABELS[reference.tag] ?? reference.tag}</Text>
              {isJumpedTo ? (
                <Pressable accessibilityRole="button" onPress={handleBackToReading} hitSlop={8}>
                  <Text style={styles.backToReadingText}>Back to reading</Text>
                </Pressable>
              ) : null}
            </View>
          );
        })}
      </View>
    </Screen>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    content: {
      gap: theme.spacing.xl
    },
    titleRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: theme.spacing.sm
    },
    title: {
      flex: 1,
      color: colors.text,
      fontSize: 22,
      lineHeight: 27,
      fontWeight: "700"
    },
    shareButton: {
      minWidth: 44,
      minHeight: 44,
      alignItems: "center",
      justifyContent: "center"
    },
    pressed: {
      opacity: 0.6
    },
    intro: {
      color: colors.textMuted,
      fontSize: 17,
      lineHeight: 26
    },
    findings: {
      gap: theme.spacing.md
    },
    findingCard: {
      padding: theme.spacing.md,
      borderRadius: theme.radius.md,
      backgroundColor: colors.surface,
      gap: theme.spacing.sm
    },
    hideText: {
      color: colors.textMuted,
      fontSize: 12,
      alignSelf: "flex-start"
    },
    referencesSection: {
      gap: theme.spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: theme.spacing.lg
    },
    referencesTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "600"
    },
    referenceRow: {
      padding: theme.spacing.sm,
      borderRadius: theme.radius.md,
      borderWidth: 1.5,
      borderColor: "transparent",
      gap: 2
    },
    referenceRowHighlighted: {
      borderColor: colors.primary,
      backgroundColor: colors.surfaceStrong
    },
    referenceText: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 19
    },
    referenceTag: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: "600",
      textTransform: "uppercase"
    },
    backToReadingText: {
      color: colors.link,
      fontSize: 13,
      fontWeight: "600",
      marginTop: theme.spacing.xs
    }
  });
}
