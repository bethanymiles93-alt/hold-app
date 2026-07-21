import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import { Screen } from "@/components/Screen";
import { StepHeader } from "@/components/StepHeader";
import { RecipientEntry } from "@/components/RecipientEntry";
import { PrimaryButton } from "@/components/PrimaryButton";
import { theme } from "@/constants/theme";
import { useHoldFlow } from "@/context/HoldFlowContext";

export default function ReturnPeopleScreen() {
  const { recipients, setRecipients } = useHoldFlow();

  return (
    <Screen contentContainerStyle={styles.content}>
      <View>
        <StepHeader
          eyebrow="Step 1 of 3"
          title="Who would you like to come back to?"
          body="You can start with one person. Returning does not have to happen all at once."
        />
        <RecipientEntry recipients={recipients} onChange={setRecipients} />
      </View>

      <PrimaryButton
        disabled={recipients.length === 0}
        label="Continue"
        onPress={() => router.push("/return/style")}
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
