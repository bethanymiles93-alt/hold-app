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
  const { audienceCircles, audienceUngrouped } = useHoldFlow();
  const [takingTimeUpdate, setTakingTimeUpdate] = useState(DEFAULT_TAKING_TIME_UPDATE);

  const audienceContacts = [
    ...audienceCircles.flatMap((circle) => circle.contacts),
    ...audienceUngrouped
  ];
  const numbers = audienceContacts.map((contact) => contact.phoneNumber);
  const circleNames = audienceCircles.map((circle) => circle.circleName);
  const recipientLabel =
    circleNames.length > 0
      ? circleNames.join(", ")
      : audienceContacts.map((contact) => contact.name).join(", ");

  const onSent = () => {
    router.back();
  };

  return (
    <Screen contentContainerStyle={styles.content}>
      <View>
        <StepHeader
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
