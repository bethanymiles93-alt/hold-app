import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { StepHeader } from "@/components/StepHeader";
import { GroupPicker } from "@/components/GroupPicker";
import { ChoiceCard } from "@/components/ChoiceCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { HOLD_INTENTS } from "@/constants/copy";
import { theme } from "@/constants/theme";
import { useHoldFlow } from "@/context/HoldFlowContext";
import { createDraft } from "@/services/draftService";

export default function HoldPeopleScreen() {
  const { recipients, selectedGroups, toggleGroup, intent, setIntent, setMessage } = useHoldFlow();

  const canContinue =
    selectedGroups.length > 0 &&
    selectedGroups.every((group) => group.contacts.length > 0) &&
    Boolean(intent);

  const continueToReview = async () => {
    if (!canContinue || !intent) return;

    const message = await createDraft({ mode: "hold", recipients, intent });
    setMessage(message);
    router.push("/create/review");
  };

  return (
    <Screen contentContainerStyle={styles.content}>
      <View>
        <StepHeader
          compact
          eyebrow="Step 1 of 2"
          title="Who needs to know?"
          body="Choose one or more Circles, then pick what they need to understand."
        />
        <GroupPicker
          selectedGroupIds={selectedGroups.map((group) => group.id)}
          onToggle={toggleGroup}
        />

        <Text style={styles.sectionLabel}>What do they need to understand?</Text>
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
        disabled={!canContinue}
        label="Review message"
        onPress={() => void continueToReview()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    justifyContent: "space-between",
    gap: theme.spacing.md,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.md
  },
  sectionLabel: {
    color: theme.colors.text,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "600",
    letterSpacing: -0.3,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.md
  },
  choices: {
    gap: theme.spacing.sm
  }
});
