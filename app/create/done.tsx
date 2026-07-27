import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { HoldMark } from "@/components/HoldMark";
import { PrimaryButton } from "@/components/PrimaryButton";
import { theme } from "@/constants/theme";
import { useHoldFlow } from "@/context/HoldFlowContext";

export default function HoldDoneScreen() {
  const { resetFlow } = useHoldFlow();

  const finish = () => {
    resetFlow("hold");
    router.replace("/");
  };

  return (
    <Screen contentContainerStyle={styles.content}>
      <View style={styles.message}>
        <HoldMark size={92} />
        <Text style={styles.title}>You’ve taken the first step.</Text>
        <Text style={styles.subtitle}>
          You’ve let the people who matter know you need some time. Taking time to recover
          isn’t selfish. You don’t need to earn rest.
        </Text>
      </View>

      <PrimaryButton label="Begin Taking Time" onPress={finish} />
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
    fontWeight: "600",
    textAlign: "center"
  },
  subtitle: {
    color: theme.colors.textMuted,
    fontSize: 17,
    lineHeight: 25,
    textAlign: "center",
    maxWidth: 300
  }
});
