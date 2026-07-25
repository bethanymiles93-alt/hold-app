import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { HoldMark } from "@/components/HoldMark";
import { PrimaryButton } from "@/components/PrimaryButton";
import { theme } from "@/constants/theme";

export default function ReconnectTransitionScreen() {
  const goToConversations = () => {
    router.replace("/return/conversations");
  };

  return (
    <Screen contentContainerStyle={styles.content}>
      <View style={styles.message}>
        <HoldMark size={92} />
        <Text style={styles.title}>Welcome back.</Text>
        <Text style={styles.subtitle}>
          Here’s who’s waiting to hear from you — reply however feels right today.
        </Text>
      </View>

      <PrimaryButton label="Continue" onPress={goToConversations} />
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
    fontSize: 18,
    lineHeight: 26,
    textAlign: "center",
    maxWidth: 300
  }
});
