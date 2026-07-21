import { Alert, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Screen } from "@/components/Screen";
import { StepHeader } from "@/components/StepHeader";
import { ReviewMessage } from "@/components/ReviewMessage";
import { PrimaryButton } from "@/components/PrimaryButton";
import { theme } from "@/constants/theme";
import { useHoldFlow } from "@/context/HoldFlowContext";
import { shareMessage } from "@/services/shareService";

export default function ReturnReviewScreen() {
  const { recipients, message, setMessage } = useHoldFlow();

  const share = async () => {
    try {
      await shareMessage(message.trim());
      router.replace("/return/done");
    } catch {
      Alert.alert(
        "Couldn’t open sharing",
        "Your message is still here. Please try again when you’re ready."
      );
    }
  };

  return (
    <Screen contentContainerStyle={styles.content}>
      <View>
        <StepHeader
          eyebrow="Step 3 of 3"
          title="This can be enough."
          body="Edit anything you need. Hold will not send it automatically."
        />
        <ReviewMessage
          recipients={recipients}
          message={message}
          onChangeMessage={setMessage}
        />
      </View>

      <PrimaryButton
        disabled={!message.trim()}
        label="Choose how to share"
        onPress={() => void share()}
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
