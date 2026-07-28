import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { HoldMark } from "@/components/HoldMark";
import { PrimaryButton } from "@/components/PrimaryButton";
import { theme } from "@/constants/theme";
import { useHoldFlow } from "@/context/HoldFlowContext";

export default function ReturnDoneScreen() {
  const { resetFlow } = useHoldFlow();

  const finish = () => {
    // Back to the neutral default, not "return" — otherwise mode stays stuck on
    // "return" forever, and a later standalone Library visit would wrongly look
    // like it's still inside a Reconnect journey.
    resetFlow("hold");
    router.replace("/");
  };

  return (
    <Screen contentContainerStyle={styles.content}>
      <View style={styles.message}>
        <HoldMark size={92} />
        <Text style={styles.title}>You’re reconnected.</Text>
        <Text style={styles.subtitle}>
          You’ve let the people who matter know you’re here again. That’s enough for today.
        </Text>
      </View>

      <PrimaryButton label="Done" onPress={finish} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    justifyContent: "space-between",
    paddingTop: 88
  },
  message: {
    alignItems: "center",
    gap: theme.spacing.md
  },
  title: {
    color: theme.colors.text,
    fontSize: 22,
    lineHeight: 28,
    textAlign: "center",
    fontWeight: "600"
  },
  subtitle: {
    color: theme.colors.textMuted,
    fontSize: 17,
    lineHeight: 25,
    textAlign: "center",
    maxWidth: 300
  }
});
