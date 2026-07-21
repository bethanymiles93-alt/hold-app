import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import { Screen } from "@/components/Screen";
import { StepHeader } from "@/components/StepHeader";
import { RecipientEntry } from "@/components/RecipientEntry";
import { PrimaryButton } from "@/components/PrimaryButton";
import { theme } from "@/constants/theme";
import { useHoldFlow } from "@/context/HoldFlowContext";

export default function HoldPeopleScreen() {
  const { recipients, setRecipients } = useHoldFlow();

  return (
    <Screen contentContainerStyle={styles.content}>
      <View>
        <StepHeader
          eyebrow="Step 1 of 3"
          title="Who needs to know?"
          body="Add only the people you want to include. You’ll choose how to share the message later."
        />
        <RecipientEntry recipients={recipients} onChange={setRecipients} />
      </View>

      <PrimaryButton
        disabled={recipients.length === 0}
        label="Continue"
        onPress={() => router.push("/create/intent")}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    justifyContent: "space-between",
    gap: theme.spacing.xl
  }
});
