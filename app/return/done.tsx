import { useMemo } from "react";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { HoldMark } from "@/components/HoldMark";
import { PrimaryButton } from "@/components/PrimaryButton";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useHoldFlow } from "@/context/HoldFlowContext";
import { endReconnecting } from "@/services/holdHistoryService";
import { getProgress as getConversationProgress } from "@/services/conversationService";

export default function ReturnDoneScreen() {
  const { resetFlow } = useHoldFlow();
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);

  const finish = () => {
    void (async () => {
      // Only end the durable reconnecting marker once there's genuinely
      // nothing left to personalise — this screen's own "Done" used to
      // clear it unconditionally, which is what left Home's "Finish
      // Reconnecting" (shown precisely because Personalise is still
      // outstanding) routing into a reconnect.tsx that had already lost
      // its only durable way to find this period. Leaving the marker set
      // here lets reconnect.tsx's own refresh() (getReconnectingPeriod())
      // resolve correctly if the person comes back to finish personalising
      // later; Home clears it for real once conversationProgress actually
      // catches up. See docs/09-decision-log.md, 2026-08-13.
      const conversationProgress = await getConversationProgress().catch(() => null);
      const personaliseDone = !conversationProgress || conversationProgress.completed >= conversationProgress.total;
      if (personaliseDone) {
        await endReconnecting();
      }
    })();
    // Back to the neutral default, not "return" — otherwise mode stays stuck on
    // "return" forever, and a later standalone Library visit would wrongly look
    // like it's still inside a Reconnect journey.
    resetFlow("hold");
    router.replace("/");
  };

  return (
    <Screen contentContainerStyle={styles.content} footer={<PrimaryButton label="Done" onPress={finish} />}>
      <View style={styles.message}>
        <HoldMark size={64} />
        <Text style={styles.title}>You’re reconnected.</Text>
        <Text style={styles.subtitle}>
          You’ve let the people who matter know you’re here again. That’s enough for today.
        </Text>
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
    title: {
      color: colors.text,
      fontSize: 22,
      lineHeight: 28,
      textAlign: "center",
      fontWeight: "600"
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
