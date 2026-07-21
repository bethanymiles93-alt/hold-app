import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import { Screen } from "@/components/Screen";
import { StepHeader } from "@/components/StepHeader";
import { ChoiceCard } from "@/components/ChoiceCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { HOLD_INTENTS } from "@/constants/copy";
import { theme } from "@/constants/theme";
import { useHoldFlow } from "@/context/HoldFlowContext";
import { createDraft } from "@/services/draftService";

export default function HoldIntentScreen() {
  const {
    recipients,
    intent,
    setIntent,
    setMessage
  } = useHoldFlow();

  const continueToReview = async () => {
    if (!intent) return;

    const message = await createDraft({
      mode: "hold",
      recipients,
      intent
    });

    setMessage(message);
    router.push("/create/review");
  };

  return (
    <Screen contentContainerStyle={styles.content}>
      <View>
        <StepHeader
          eyebrow="Step 2 of 3"
          title="What do they need to understand?"
          body="Choose the closest option. You can change every word before sharing."
        />

        <View accessibilityRole="radiogroup" style={styles.choices}>
          {HOLD_INTENTS.map((choice) => (
            <ChoiceCard
              key={choice.id}
              title={choice.title}
              description={choice.description}
              selected={intent === choice.id}
              onPress={() => setIntent(choice.id)}
            />
          ))}
        </View>
      </View>

      <PrimaryButton
        disabled={!intent}
        label="Review message"
        onPress={() => void continueToReview()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    justifyContent: "space-between",
    gap: theme.spacing.xl
  },
  choices: {
    gap: theme.spacing.sm
  }
});
