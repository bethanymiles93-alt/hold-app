import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Screen } from "@/components/Screen";
import { StepHeader } from "@/components/StepHeader";
import { ReviewMessage } from "@/components/ReviewMessage";
import { SendChoice } from "@/components/SendChoice";
import { DEFAULT_TAKING_TIME_UPDATE } from "@/constants/copy";
import { theme } from "@/constants/theme";
import { useHoldFlow } from "@/context/HoldFlowContext";

export default function TakingTimeUpdateScreen() {
  const { audienceCircleNames, audienceContacts } = useHoldFlow();
  const [takingTimeUpdate, setTakingTimeUpdate] = useState(DEFAULT_TAKING_TIME_UPDATE);

  const numbers = audienceContacts.map((contact) => contact.phoneNumber);
  const recipientLabel =
    audienceCircleNames.length > 0
      ? audienceCircleNames.join(", ")
      : audienceContacts.map((contact) => contact.name).join(", ");

  const onSent = () => {
    router.back();
  };

  return (
    <Screen contentContainerStyle={styles.content}>
      <View>
        <StepHeader
          compact
          title="Send an update"
          body="A short reassurance, without ending Taking Time. Send it as many times as you like."
        />
        <ReviewMessage
          recipients={audienceContacts.map((contact) => contact.name)}
          circleName={recipientLabel || null}
          message={takingTimeUpdate}
          onChangeMessage={setTakingTimeUpdate}
        />
      </View>

      <SendChoice
        recipientLabel={recipientLabel}
        numbers={numbers}
        message={takingTimeUpdate}
        disabled={!takingTimeUpdate.trim()}
        onSent={onSent}
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
