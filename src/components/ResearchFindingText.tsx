import { useMemo } from "react";
import { StyleSheet, Text } from "react-native";
import { type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";
import type { BodySegment, ResearchReference } from "@/constants/researchContent";

interface ResearchFindingTextProps {
  segments: BodySegment[];
  references: ResearchReference[];
  onCitationPress: (refId: string) => void;
}

/**
 * Harvard author-date citations, in-line, as ordinary readable sentence
 * text — the author-date text itself is the only tappable marker, not a
 * numbered footnote. Deliberate: a numbered superscript requires jumping
 * away from the sentence to an opaque number and back, a real cognitive-
 * load cost that's in direct tension with Hold's low-capacity-design
 * principle. Author-date text needs no jump to be understood — tapping it
 * is optional and additive, not required to read the sentence. Nested
 * `<Text onPress>` inside a parent `<Text>` is React Native's own
 * supported way to get an inline pressable span; no separate Pressable
 * wrapper needed. See docs/09-decision-log.md, 2026-08-31.
 */
export function ResearchFindingText({ segments, references, onCitationPress }: ResearchFindingTextProps) {
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);
  const referenceById = useMemo(() => new Map(references.map((reference) => [reference.id, reference])), [references]);

  return (
    <Text style={styles.body}>
      {segments.map((segment, index) => {
        if (segment.type === "text") {
          return <Text key={index}>{segment.text}</Text>;
        }

        const reference = referenceById.get(segment.refId);
        const label = reference?.authorDate ?? segment.refId;

        return (
          <Text
            key={index}
            style={styles.citation}
            accessibilityRole="link"
            accessibilityLabel={`Citation, ${label}. Jumps to the full reference below.`}
            suppressHighlighting
            onPress={() => onCitationPress(segment.refId)}
          >
            {label}
          </Text>
        );
      })}
    </Text>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    body: {
      color: colors.textMuted,
      fontSize: 15,
      lineHeight: 23
    },
    citation: {
      color: colors.link,
      textDecorationLine: "underline"
    }
  });
}
