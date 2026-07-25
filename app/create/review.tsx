import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Screen } from "@/components/Screen";
import { StepHeader } from "@/components/StepHeader";
import { ReviewMessage } from "@/components/ReviewMessage";
import { EmailOutOfOffice } from "@/components/EmailOutOfOffice";
import { WiderWorldStatus } from "@/components/WiderWorldStatus";
import { SendChoice } from "@/components/SendChoice";
import { theme } from "@/constants/theme";
import { buildAudienceCircles, dedupeContactsByPhoneNumber, useHoldFlow } from "@/context/HoldFlowContext";
import { setLastSendMethod } from "@/services/circleService";
import { startHoldPeriod } from "@/services/holdHistoryService";
import { activateOutOfOffice } from "@/services/emailAccountService";
import { copyToClipboard } from "@/services/clipboardService";
import type { EmailAccount } from "@/types/hold";

const DEFAULT_OOO_MESSAGE =
  "I’m currently away and will respond when I’m back. Thank you for understanding.";
const DEFAULT_STATUS_LINE = "Taking some quiet time. Back soon.";

export default function HoldReviewScreen() {
  const { recipients, selectedGroups, message, setMessage } = useHoldFlow();

  const audienceContacts = dedupeContactsByPhoneNumber(selectedGroups);
  const numbers = audienceContacts.map((contact) => contact.phoneNumber);
  const circleNames = selectedGroups.map((group) => group.name);
  const recipientLabel = selectedGroups.length === 1 ? selectedGroups[0]?.name ?? "your Circle" : "your Circles";

  const [emailEnabled, setEmailEnabled] = useState(false);
  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([]);
  const [useSameEmailMessage, setUseSameEmailMessage] = useState(true);
  const [sharedEmailMessage, setSharedEmailMessage] = useState(DEFAULT_OOO_MESSAGE);

  const [widerWorldEnabled, setWiderWorldEnabled] = useState(false);
  const [widerWorldText, setWiderWorldText] = useState(DEFAULT_STATUS_LINE);

  const resolvedMessageFor = (account: EmailAccount) =>
    (useSameEmailMessage ? sharedEmailMessage : account.message).trim();

  const emailValid =
    !emailEnabled ||
    emailAccounts.filter((account) => account.enabled).every((account) => resolvedMessageFor(account).length > 0);
  const widerWorldValid = !widerWorldEnabled || widerWorldText.trim().length > 0;
  const canSend = Boolean(message.trim()) && emailValid && widerWorldValid;

  const onSent = async () => {
    await startHoldPeriod({
      recipients,
      audienceCircles: buildAudienceCircles(selectedGroups)
    });

    if (emailEnabled) {
      const enabledAccounts = emailAccounts
        .filter((account) => account.enabled)
        .map((account) => ({ ...account, message: resolvedMessageFor(account) }));
      await activateOutOfOffice(enabledAccounts);
    }

    if (widerWorldEnabled && widerWorldText.trim()) {
      await copyToClipboard(widerWorldText.trim());
    }

    router.replace("/create/done");
  };

  return (
    <Screen contentContainerStyle={styles.content}>
      <View style={styles.top}>
        <StepHeader
          compact
          eyebrow="Step 2 of 2"
          title="Make it sound like you."
          body="Text your Circle directly, or open your device’s share options. Nothing is sent automatically."
        />
        <ReviewMessage
          recipients={recipients}
          circleName={circleNames.length > 0 ? circleNames.join(", ") : null}
          message={message}
          onChangeMessage={setMessage}
        />

        <EmailOutOfOffice
          enabled={emailEnabled}
          onToggleEnabled={setEmailEnabled}
          accounts={emailAccounts}
          onAccountsChange={setEmailAccounts}
          useSameMessage={useSameEmailMessage}
          onToggleUseSameMessage={setUseSameEmailMessage}
          sharedMessage={sharedEmailMessage}
          onChangeSharedMessage={setSharedEmailMessage}
        />

        <WiderWorldStatus
          enabled={widerWorldEnabled}
          onToggleEnabled={setWiderWorldEnabled}
          text={widerWorldText}
          onChangeText={setWiderWorldText}
        />
      </View>

      <SendChoice
        recipientLabel={recipientLabel}
        numbers={numbers}
        message={message}
        lastSendMethod={selectedGroups[0]?.lastSendMethod ?? null}
        onRememberMethod={async (method) => {
          await Promise.all(selectedGroups.map((group) => setLastSendMethod(group.id, method)));
        }}
        disabled={!canSend}
        onSent={onSent}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    justifyContent: "space-between",
    gap: theme.spacing.xl
  },
  top: {
    gap: theme.spacing.lg
  }
});
