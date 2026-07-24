import { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Screen } from "@/components/Screen";
import { StepHeader } from "@/components/StepHeader";
import { ChoiceCard } from "@/components/ChoiceCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SecondaryButton } from "@/components/SecondaryButton";
import {
  DEFAULT_REPLY_WINDOW_HOURS,
  MAX_REPLY_WINDOW_HOURS,
  REPLY_STYLES,
  REPLY_WINDOW_OPTIONS
} from "@/constants/copy";
import { theme } from "@/constants/theme";
import { createReplyDraft } from "@/services/draftService";
import { endOpenHoldPeriod } from "@/services/holdHistoryService";
import {
  createReplyId,
  deleteReply,
  getActiveReplies,
  saveReply
} from "@/services/replyStorageService";
import { shareMessage } from "@/services/shareService";
import type { ReturnStyle, StoredReply } from "@/types/hold";

export default function ReplyEditScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [recordId, setRecordId] = useState<string | null>(id ?? null);
  const [recipientName, setRecipientName] = useState("");
  const [friendMessage, setFriendMessage] = useState("");
  const [style, setStyle] = useState<ReturnStyle | null>(null);
  const [draft, setDraft] = useState("");
  const [windowHours, setWindowHours] = useState(DEFAULT_REPLY_WINDOW_HOURS);

  useEffect(() => {
    if (!id) return;

    void (async () => {
      const { active } = await getActiveReplies(Date.now());
      const existing = active.find((reply) => reply.id === id);

      if (existing) {
        setRecordId(existing.id);
        setRecipientName(existing.recipientName);
        setFriendMessage(existing.friendMessage);
        setDraft(existing.draftReply);
        setWindowHours(existing.windowHours);
      }
    })();
  }, [id]);

  const chooseStyle = async (choice: ReturnStyle) => {
    setStyle(choice);
    const generated = await createReplyDraft(choice);
    setDraft(generated);
  };

  const persist = async (): Promise<StoredReply> => {
    const now = Date.now();
    const boundedHours = Math.min(windowHours, MAX_REPLY_WINDOW_HOURS);
    const record: StoredReply = {
      id: recordId ?? createReplyId(),
      recipientName: recipientName.trim(),
      friendMessage,
      draftReply: draft,
      windowHours: boundedHours,
      createdAt: now,
      expiresAt: now + boundedHours * 60 * 60 * 1000
    };

    await saveReply(record);
    setRecordId(record.id);
    return record;
  };

  const save = async () => {
    await persist();
    router.replace("/return/reply");
  };

  const share = async () => {
    const record = await persist();

    try {
      await shareMessage(record.draftReply.trim());
    } catch {
      Alert.alert(
        "Couldn’t open sharing",
        "Your reply is still saved on this device. Please try again when you’re ready."
      );
    }
  };

  const markSent = async () => {
    if (recordId) {
      await deleteReply(recordId);
    }
    await endOpenHoldPeriod();
    router.replace("/return/reply");
  };

  return (
    <Screen contentContainerStyle={styles.content}>
      <View>
        <StepHeader
          eyebrow="Thoughtful reply"
          title="Word a considered reply."
          body="Paste what they sent, choose a starting point, then make it yours."
        />

        <Text style={styles.label}>Their name</Text>
        <TextInput
          accessibilityLabel="Recipient name"
          autoCapitalize="words"
          onChangeText={setRecipientName}
          placeholder="Name"
          placeholderTextColor={theme.colors.textMuted}
          style={styles.nameInput}
          value={recipientName}
        />

        <Text style={styles.label}>What they sent</Text>
        <TextInput
          accessibilityLabel="Message you received"
          multiline
          onChangeText={setFriendMessage}
          placeholder="Paste their message here"
          placeholderTextColor={theme.colors.textMuted}
          style={styles.pasteInput}
          textAlignVertical="top"
          value={friendMessage}
        />

        <Text style={styles.label}>Starting point</Text>
        <View accessibilityRole="radiogroup" style={styles.choices}>
          {REPLY_STYLES.map((choice) => (
            <ChoiceCard
              key={choice.id}
              title={choice.title}
              description={choice.description}
              selected={style === choice.id}
              onPress={() => void chooseStyle(choice.id)}
            />
          ))}
        </View>

        <Text style={styles.label}>Your reply</Text>
        <TextInput
          accessibilityLabel="Reply to share"
          multiline
          onChangeText={setDraft}
          style={styles.pasteInput}
          textAlignVertical="top"
          value={draft}
        />

        <Text style={styles.label}>Keep this on your device for</Text>
        <View accessibilityRole="radiogroup" style={styles.choices}>
          {REPLY_WINDOW_OPTIONS.map((option) => (
            <ChoiceCard
              key={option.hours}
              title={`${option.hours} hour${option.hours === 1 ? "" : "s"}`}
              description={option.description}
              selected={windowHours === option.hours}
              onPress={() => setWindowHours(option.hours)}
            />
          ))}
        </View>
      </View>

      <View style={styles.actions}>
        <PrimaryButton
          disabled={!recipientName.trim() || !draft.trim()}
          label="Save"
          onPress={() => void save()}
        />
        <SecondaryButton
          label="Share now"
          onPress={() => void share()}
        />
        {recordId ? (
          <SecondaryButton label="Mark as sent" onPress={() => void markSent()} />
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    justifyContent: "space-between",
    gap: theme.spacing.xl
  },
  label: {
    color: theme.colors.textMuted,
    fontSize: 14,
    fontWeight: "600",
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.sm
  },
  nameInput: {
    minHeight: 54,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    color: theme.colors.text,
    fontSize: 17,
    backgroundColor: theme.colors.white
  },
  pasteInput: {
    minHeight: 120,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    color: theme.colors.text,
    fontSize: 17,
    lineHeight: 25,
    backgroundColor: theme.colors.white
  },
  choices: {
    gap: theme.spacing.sm
  },
  actions: {
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xl
  }
});
