import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import { Screen } from "@/components/Screen";
import { StepHeader } from "@/components/StepHeader";
import { ChoiceCard } from "@/components/ChoiceCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { RETURN_STYLES } from "@/constants/copy";
import { theme } from "@/constants/theme";
import { useHoldFlow } from "@/context/HoldFlowContext";
import { createDraft } from "@/services/draftService";

export default function ReturnStyleScreen() {
  const {
    recipients,
    returnStyle,
    setReturnStyle,
    setMessage
  } = useHoldFlow();

  const continueToReview = async () => {
    if (!returnStyle) return;

    const message = await createDraft({
      mode: "return",
      recipients,
      returnStyle
    });

    setMessage(message);
    router.push("/return/review");
  };

  return (
    <Screen contentContainerStyle={styles.content}>
      <View>
        <StepHeader
          eyebrow="Step 2 of 3"
          title="How much do you want to say?"
          body="A small message is enough. Choose what feels possible today."
        />

        <View accessibilityRole="radiogroup" style={styles.choices}>
          {RETURN_STYLES.map((choice) => (
            <ChoiceCard
              key={choice.id}
              title={choice.title}
              description={choice.description}
              selected={returnStyle === choice.id}
              onPress={() => setReturnStyle(choice.id)}
            />
          ))}
        </View>
      </View>

      <PrimaryButton
        disabled={!returnStyle}
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
