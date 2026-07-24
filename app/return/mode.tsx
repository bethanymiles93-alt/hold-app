import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { StepHeader } from "@/components/StepHeader";
import { PrimaryButton } from "@/components/PrimaryButton";
import { theme } from "@/constants/theme";

export default function ReturnModeScreen() {
  return (
    <Screen contentContainerStyle={styles.content}>
      <View style={styles.top}>
        <StepHeader
          compact
          eyebrow="Step 1 of 2"
          title="How would you like to reconnect?"
          body="Both are enough. Choose what fits today."
        />

        <View style={styles.primaryCard}>
          <Text style={styles.primaryTitle}>Thoughtful reply</Text>
          <Text style={styles.primaryBody}>
            Hold helps you word a proper reply, at your own pace.
          </Text>
          <PrimaryButton
            label="Write a thoughtful reply"
            onPress={() => router.push("/return/reply")}
          />
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/return/instant")}
          style={({ pressed }) => [
            styles.secondary,
            pressed && styles.secondaryPressed
          ]}
        >
          <Text style={styles.secondaryTitle}>Quick reconnect</Text>
          <Text style={styles.secondaryBody}>
            A short message for now — you can still write a proper reply later.
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: "flex-start"
  },
  top: {
    gap: theme.spacing.lg
  },
  primaryCard: {
    gap: theme.spacing.md,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surfaceStrong,
    padding: theme.spacing.lg
  },
  primaryTitle: {
    color: theme.colors.text,
    fontSize: 22,
    fontWeight: "600"
  },
  primaryBody: {
    color: theme.colors.textMuted,
    fontSize: 16,
    lineHeight: 24
  },
  secondary: {
    gap: theme.spacing.xs,
    borderRadius: theme.radius.md,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    padding: theme.spacing.md
  },
  secondaryPressed: {
    backgroundColor: theme.colors.surface
  },
  secondaryTitle: {
    color: theme.colors.text,
    fontSize: 17,
    fontWeight: "600"
  },
  secondaryBody: {
    color: theme.colors.textMuted,
    fontSize: 15,
    lineHeight: 22
  }
});
