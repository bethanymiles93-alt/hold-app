import { useMemo } from "react";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { HoldMark } from "@/components/HoldMark";
import { CitationMarker } from "@/components/CitationMarker";
import { PrimaryButton } from "@/components/PrimaryButton";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useHoldFlow } from "@/context/HoldFlowContext";

export default function HoldDoneScreen() {
  const { resetFlow } = useHoldFlow();
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);

  const finish = () => {
    resetFlow("hold");
    router.replace("/");
  };

  return (
    <Screen
      contentContainerStyle={styles.content}
      footer={<PrimaryButton label="Begin Taking Time" onPress={finish} />}
    >
      {/*
       * Drafted replacement copy, per hold-book
       * 04-ux-content/04-navigation-architecture.md's "Going Quiet →
       * Transition screen" sequence — supersedes the previous title +
       * single-paragraph subtitle outright, matching the three-line, no-
       * separate-title shape already shipped on Reconnect's own landing
       * moment (app/return/transition.tsx). Line 2's citation marker links
       * to the "Staying connected, even briefly" Research section. A
       * second marker on line 3 was added 2026-08-31, closing a real gap:
       * the "shame-and-self-compassion" Research section (built earlier
       * this pass, real citations — Tangney, Brown's Shame Resilience
       * Theory, Neff's Self-Compassion Break) had no citation marker
       * anywhere in the app pointing to it, even though its own body text
       * says "Hold's Transition screen draws on" it — "You don't need to
       * earn rest" is exactly the guilt-adjacent framing that section
       * addresses. See docs/09-decision-log.md.
       */}
      <View style={styles.message}>
        <HoldMark size={64} />
        <Text style={styles.subtitle}>This can feel harder than it should.</Text>
        <View style={styles.lineWithMarker}>
          <Text style={styles.subtitle}>Taking time isn’t the same as letting people down.</Text>
          <CitationMarker researchSectionId="connection-and-loneliness" />
        </View>
        <View style={styles.lineWithMarker}>
          <Text style={styles.subtitle}>You don’t need to earn rest.</Text>
          <CitationMarker researchSectionId="shame-and-self-compassion" />
        </View>
      </View>
    </Screen>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    content: {
      paddingTop: theme.spacing.xxl
    },
    message: {
      alignItems: "center",
      gap: theme.spacing.md
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: 17,
      lineHeight: 25,
      textAlign: "center",
      maxWidth: 300
    },
    lineWithMarker: {
      alignItems: "center",
      gap: 2
    }
  });
}
