import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { HoldMark } from "@/components/HoldMark";
import { PrimaryButton } from "@/components/PrimaryButton";
import { theme } from "@/constants/theme";
import { useHoldFlow } from "@/context/HoldFlowContext";
import { HAS_SEEN_WELCOME_KEY } from "@/constants/storageKeys";

export default function WelcomeScreen() {
  const { resetFlow } = useHoldFlow();

  const getStarted = async () => {
    await AsyncStorage.setItem(HAS_SEEN_WELCOME_KEY, "true");
    resetFlow("hold");
    router.replace("/create/people");
  };

  return (
    <Screen contentContainerStyle={styles.content}>
      <View style={styles.brand}>
        <HoldMark size={72} />
      </View>

      <View style={styles.body}>
        <Text style={styles.title}>Welcome to Hold.</Text>
        <Text style={styles.paragraph}>
          We built Hold because staying in touch can feel impossible when you don’t have the
          capacity, whatever the reason. Hold helps you keep your circles in the loop, rest
          without guilt, and reconnect in your own time.
        </Text>
        <Text style={styles.paragraph}>
          It also helps the people who care about you, so they’re not left worrying in silence.
        </Text>
        <Text style={styles.paragraph}>
          We’d love to hear what you think. If Hold helps you, we’d be grateful if you shared it
          with someone who might need it too.
        </Text>
      </View>

      <PrimaryButton label="Get started" onPress={() => void getStarted()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    justifyContent: "space-between",
    paddingTop: 80,
    gap: theme.spacing.xl
  },
  brand: {
    alignItems: "center"
  },
  body: {
    gap: theme.spacing.lg
  },
  title: {
    color: theme.colors.text,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "600"
  },
  paragraph: {
    color: theme.colors.text,
    fontSize: 17,
    lineHeight: 26
  }
});
