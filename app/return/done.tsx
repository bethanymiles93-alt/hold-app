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
    resetFlow("return");
    router.replace("/");
  };

  return (
    <Screen contentContainerStyle={styles.content}>
      <View style={styles.message}>
        <HoldMark size={92} />
        <Text style={styles.title}>They know you’re on your way back.</Text>
        <Text style={styles.subtitle}>There’s nothing else you need to do right now.</Text>
        <Text style={styles.note}>Hold opened your sharing options.</Text>
      </View>

      <PrimaryButton label="Finish" onPress={finish} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    justifyContent: "space-between",
    paddingTop: 120
  },
  message: {
    alignItems: "center",
    gap: theme.spacing.md
  },
  title: {
    color: theme.colors.text,
    fontSize: 34,
    lineHeight: 42,
    textAlign: "center",
    fontWeight: "600"
  },
  subtitle: {
    color: theme.colors.textMuted,
    fontSize: 23
  },
  note: {
    color: theme.colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    marginTop: theme.spacing.lg
  }
});
