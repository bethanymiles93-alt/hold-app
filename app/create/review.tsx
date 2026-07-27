import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Screen } from "@/components/Screen";
import { StepHeader } from "@/components/StepHeader";
import { ReviewMessage } from "@/components/ReviewMessage";
import { EmailOutOfOffice } from "@/components/EmailOutOfOffice";
import { WiderWorldStatus } from "@/components/WiderWorldStatus";
import { PrimaryButton } from "@/components/PrimaryButton";
import { theme } from "@/constants/theme";
import { buildAudienceCircles, useHoldFlow } from "@/context/HoldFlowContext";
import { startHoldPeriod } from "@/services/holdHistoryService";
import { activateOutOfOffice } from "@/services/emailAccountService";
import { copyToClipboard } from "@/services/clipboardService";
import { sendOrShare } from "@/services/smsService";
import type { EmailAccount } from "@/types/hold";

const DEFAULT_OOO_MESSAGE =
  "I’m currently away and will respond when I’m back. Thank you for understanding.";
const DEFAULT_STATUS_LINE = "Taking some quiet time. Back soon.";

export default function HoldReviewScreen() {
  const { recipients, selectedGroups, circleDrafts, setCircleDraftMessage, goingQuietRecipients } =
    useHoldFlow();

  const included = goingQuietRecipients.filter((recipient) => recipient.included);
  const personalisedGroup = included.filter((recipient) => recipient.personalisedMessage !== null);

  const circleSendGroups = circleDrafts
    .map((draft) => ({
      draft,
      recipients: included.filter(
        (recipient) => recipient.circleId === draft.circleId && recipient.personalisedMessage === null
      )
    }))
    .filter((group) => group.recipients.length > 0);

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
  const hasAnyRecipient = included.length > 0;
  const circleMessagesValid = circleSendGroups.every((group) => Boolean(group.draft.message.trim()));
  const personalisedValid = personalisedGroup.every((recipient) =>
    Boolean(recipient.personalisedMessage?.trim())
  );
  const canSend =
    hasAnyRecipient && circleMessagesValid && personalisedValid && emailValid && widerWorldValid;

  const completeSend = async () => {
    await startHoldPeriod({
      recipients,
      audienceCircles: buildAudienceCircles(selectedGroups)
    });

    for (const group of circleSendGroups) {
      const text = group.draft.message.trim();
      if (!text) continue;

      try {
        await sendOrShare(group.recipients.map((recipient) => recipient.phoneNumber), text);
      } catch {
        // Move on to the next Circle even if this compose sheet was dismissed.
      }
    }

    for (const recipient of personalisedGroup) {
      const text = recipient.personalisedMessage?.trim();
      if (!text) continue;

      try {
        await sendOrShare([recipient.phoneNumber], text);
      } catch {
        // Move on to the next personalised message even if this compose sheet was dismissed.
      }
    }

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

        {circleSendGroups.map((group) => (
          <ReviewMessage
            key={group.draft.circleId}
            recipients={group.recipients.map((recipient) => recipient.name)}
            circleName={group.draft.circleName}
            message={group.draft.message}
            onChangeMessage={(text) => setCircleDraftMessage(group.draft.circleId, text)}
          />
        ))}

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

      <PrimaryButton disabled={!canSend} label="Send" onPress={() => void completeSend()} />
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
