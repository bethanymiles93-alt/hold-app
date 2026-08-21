import { useMemo } from "react";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { HoldMark } from "@/components/HoldMark";
import { PrimaryButton } from "@/components/PrimaryButton";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";

export default function ReconnectTransitionScreen() {
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);

  const goToReconnect = () => {
    router.replace("/return/reconnect");
  };

  return (
    <Screen
      contentContainerStyle={styles.content}
      footer={<PrimaryButton label="Continue" onPress={goToReconnect} />}
    >
      {/*
       * Drafted replacement copy, confirmed directly — the previous
       * "Welcome back. Reply however feels right today, whenever you're
       * ready." copy is fully superseded, not amended, per hold-book
       * 04-ux-content/04-navigation-architecture.md's "Reconnect landing
       * moment" sequence. Three lines, no separate "Welcome back." title —
       * the drafted sequence replaces the whole message block, matching
       * Going Quiet's own equivalent transition screen's shape. Line 2's
       * own citation marker ("Why this is true", linking to an anchored
       * Research-page section) is deliberately not built here — its own
       * dependency (individually addressable Research sections) is a
       * separate, larger, explicitly-not-yet-built piece of
       * infrastructure per that same hold-book section, not part of this
       * copy change. See docs/09-decision-log.md.
       */}
      <View style={styles.message}>
        <HoldMark size={64} />
        <Text style={styles.subtitle}>Coming back doesn’t need a perfect opening line.</Text>
        <Text style={styles.subtitle}>Most people underestimate how much a message like this means.</Text>
        <Text style={styles.subtitle}>It doesn’t need to be perfect. It just needs to be sent.</Text>
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
    }
  });
}
