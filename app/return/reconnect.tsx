import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { Screen } from "@/components/Screen";
import { StepHeader } from "@/components/StepHeader";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SecondaryButton } from "@/components/SecondaryButton";
import { theme } from "@/constants/theme";
import { QUICK_RECONNECT_MESSAGES } from "@/constants/copy";
import { useHoldFlow } from "@/context/HoldFlowContext";
import { sendOrShare } from "@/services/smsService";
import { formatSentLabel } from "@/services/holdHistoryFormat";

export default function ReconnectScreen() {
  const { audienceCircles, audienceUngrouped } = useHoldFlow();
  const [message, setMessage] = useState(QUICK_RECONNECT_MESSAGES[0]?.text ?? "");
  const [isEditing, setIsEditing] = useState(false);
  const [sentAt, setSentAt] = useState<number | null>(null);

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

  const send = () => {
    void (async () => {
      try {
        await sendOrShare(numbers, message.trim());
      } catch {
        // The compose sheet closing is the only signal available either way,
        // so the sent state still shows — matches the "sent" wording rule.
      }
      setIsEditing(false);
      setSentAt(Date.now());
    })();
  };

  const goToConversations = () => {
    router.push("/return/conversations");
  };

  const notNow = () => {
    router.replace("/return/done");
  };

  return (
    <Screen contentContainerStyle={styles.content}>
      <View style={styles.top}>
        <StepHeader title="Reconnect" body="Both are enough. Reply however feels right today." />

        <View style={styles.recipientPanel}>
          <Text style={styles.label}>For</Text>
          <Text style={styles.recipients}>{recipientLabel}</Text>
        </View>

        {isEditing ? (
          <TextInput
            accessibilityLabel="Message to send"
            multiline
            onChangeText={setMessage}
            style={styles.input}
            textAlignVertical="top"
            value={message}
          />
        ) : (
          <View style={styles.messageBox}>
            <Text style={styles.messageText}>{message}</Text>
          </View>
        )}

        {sentAt === null ? (
          <Pressable accessibilityRole="button" onPress={() => setIsEditing((current) => !current)}>
            <Text style={styles.linkText}>{isEditing ? "Done" : "Edit"}</Text>
          </Pressable>
        ) : (
          <View style={styles.sentState}>
            <Text style={styles.sentLabel}>
              {formatSentLabel(sentAt, "Sent. They know you're thinking of them.")}
            </Text>
            <Text style={styles.gatePrompt}>Want to reply to anyone properly?</Text>
          </View>
        )}
      </View>

      <View style={styles.actions}>
        {sentAt === null ? (
          <PrimaryButton disabled={!message.trim()} label="Send" onPress={send} />
        ) : null}
        <SecondaryButton label="Personalise" onPress={goToConversations} />
        {sentAt !== null ? <SecondaryButton label="Not now" onPress={notNow} /> : null}
      </View>
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
  },
  recipientPanel: {
    gap: theme.spacing.xs,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md
  },
  label: {
    color: theme.colors.textMuted,
    fontSize: 14,
    fontWeight: "600"
  },
  recipients: {
    color: theme.colors.text,
    fontSize: 17,
    lineHeight: 24
  },
  messageBox: {
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.white
  },
  messageText: {
    color: theme.colors.text,
    fontSize: 18,
    lineHeight: 28
  },
  input: {
    minHeight: 100,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    color: theme.colors.text,
    fontSize: 18,
    lineHeight: 28,
    backgroundColor: theme.colors.white
  },
  linkText: {
    color: theme.colors.link,
    fontSize: 14,
    fontWeight: "600"
  },
  sentState: {
    gap: theme.spacing.xs
  },
  sentLabel: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: "600"
  },
  gatePrompt: {
    color: theme.colors.textMuted,
    fontSize: 15,
    lineHeight: 22
  },
  actions: {
    gap: theme.spacing.sm
  }
});
