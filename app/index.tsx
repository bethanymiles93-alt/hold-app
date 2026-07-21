import { Link, router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { HoldMark } from "@/components/HoldMark";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SecondaryButton } from "@/components/SecondaryButton";
import { theme } from "@/constants/theme";
import { useHoldFlow } from "@/context/HoldFlowContext";

export default function HomeScreen() {
  const { resetFlow } = useHoldFlow();

  const start = (mode: "hold" | "return") => {
    resetFlow(mode);
    router.push(mode === "hold" ? "/create/people" : "/return/people");
  };

  return (
    <Screen contentContainerStyle={styles.content}>
      <View style={styles.brand}>
        <HoldMark size={72} />
        <Text style={styles.wordmark}>Hold</Text>
      </View>

      <View style={styles.copy}>
        <Text style={styles.heading}>A gentler way to go quiet and come back.</Text>
        <Text style={styles.body}>
          Tell the people you care about when your capacity is low—without having to explain everything.
        </Text>
      </View>

      <View style={styles.actions}>
        <PrimaryButton label="Create a Hold" onPress={() => start("hold")} />
        <SecondaryButton label="Return from Hold" onPress={() => start("return")} />
      </View>

      <View style={styles.reassurance}>
        <Text style={styles.reassuranceText}>
          Hold never sends anything without you reviewing and choosing to share it.
        </Text>
      </View>

      <Link href="/privacy" asChild>
        <Pressable accessibilityRole="link" style={styles.linkButton}>
          <Text style={styles.link}>How privacy works</Text>
        </Pressable>
      </Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: "space-between",
    paddingTop: theme.spacing.xxl,
    paddingBottom: theme.spacing.lg
  },
  brand: {
    alignItems: "center",
    gap: theme.spacing.sm
  },
  wordmark: {
    fontSize: 25,
    fontWeight: "600",
    color: theme.colors.text,
    letterSpacing: 0.3
  },
  copy: {
    gap: theme.spacing.md
  },
  heading: {
    fontSize: 34,
    lineHeight: 42,
    fontWeight: "600",
    color: theme.colors.text,
    letterSpacing: -0.6
  },
  body: {
    fontSize: 18,
    lineHeight: 28,
    color: theme.colors.textMuted
  },
  actions: {
    gap: theme.spacing.md
  },
  reassurance: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md
  },
  reassuranceText: {
    color: theme.colors.textMuted,
    fontSize: 15,
    lineHeight: 22
  },
  linkButton: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center"
  },
  link: {
    color: theme.colors.link,
    fontSize: 15,
    textDecorationLine: "underline"
  }
});
