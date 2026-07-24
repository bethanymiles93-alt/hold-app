import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { Screen } from "@/components/Screen";
import { StepHeader } from "@/components/StepHeader";
import { ChoiceCard } from "@/components/ChoiceCard";
import { SendChoice } from "@/components/SendChoice";
import { QUICK_RECONNECT_MESSAGES } from "@/constants/copy";
import { theme } from "@/constants/theme";
import { useHoldFlow } from "@/context/HoldFlowContext";
import { endOpenHoldPeriod, setPostReconnectActive } from "@/services/holdHistoryService";
import { getActiveReplies } from "@/services/replyStorageService";

export default function ReturnInstantScreen() {
  const { audienceCircleNames, audienceContacts } = useHoldFlow();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [quickReconnectMessage, setQuickReconnectMessage] = useState("");

  const numbers = audienceContacts.map((contact) => contact.phoneNumber);
  const recipientLabel =
    audienceCircleNames.length > 0
      ? audienceCircleNames.join(", ")
      : audienceContacts.map((contact) => contact.name).join(", ");

  const choose = (id: string, defaultText: string) => {
    setSelectedId(id);
    setQuickReconnectMessage(defaultText);
  };

  const onSent = async () => {
    await endOpenHoldPeriod();
    const { active } = await getActiveReplies(Date.now());
    await setPostReconnectActive(active.length);
    router.replace("/return/done");
  };

  return (
    <Screen contentContainerStyle={styles.content}>
      <View>
        <StepHeader
          compact
          eyebrow="Step 2 of 2"
          title="Pick what’s closest to true."
          body="You can lightly edit it before sending."
        />

        <View style={styles.recipientPanel}>
          <Text style={styles.label}>For</Text>
          <Text style={styles.recipients}>{recipientLabel}</Text>
        </View>

        <View accessibilityRole="radiogroup" style={styles.choices}>
          {QUICK_RECONNECT_MESSAGES.map((choice) => (
            <ChoiceCard
              key={choice.id}
              title={choice.title}
              description={choice.text}
              selected={selectedId === choice.id}
              onPress={() => choose(choice.id, choice.text)}
            />
          ))}
        </View>

        {selectedId ? (
          <TextInput
            accessibilityLabel="Message to share"
            multiline
            onChangeText={setQuickReconnectMessage}
            style={styles.input}
            textAlignVertical="top"
            value={quickReconnectMessage}
          />
        ) : null}
      </View>

      <SendChoice
        recipientLabel={recipientLabel}
        numbers={numbers}
        message={quickReconnectMessage}
        disabled={!quickReconnectMessage.trim()}
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
  recipientPanel: {
    gap: theme.spacing.xs,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg
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
  choices: {
    gap: theme.spacing.sm
  },
  input: {
    minHeight: 120,
    marginTop: theme.spacing.lg,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    color: theme.colors.text,
    fontSize: 18,
    lineHeight: 28,
    backgroundColor: theme.colors.white
  }
});
