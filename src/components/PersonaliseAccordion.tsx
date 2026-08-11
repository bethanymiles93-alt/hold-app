import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SecondaryButton } from "@/components/SecondaryButton";
import { CompactSendButton } from "@/components/CompactSendButton";
import { DockedFieldPreview } from "@/components/DockedFieldPreview";
import { SafeguardingBanner } from "@/components/SafeguardingBanner";
import { useSafeguardingCheck } from "@/hooks/useSafeguardingCheck";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";
import { DRAFT_REPLY_RETENTION_HOURS, FRIEND_MESSAGE_RETENTION_HOURS, REPLY_STYLES } from "@/constants/copy";
import { HAS_SEEN_RETENTION_NOTE_KEY } from "@/constants/storageKeys";
import type { ConversationPerson } from "@/services/conversationService";
import { sendOrShare } from "@/services/smsService";
import { createReplyDraft } from "@/services/draftService";
import { getReply, saveReply } from "@/services/replyStorageService";
import { formatSentLabel } from "@/services/holdHistoryFormat";
import type { ReturnStyle, StoredReply } from "@/types/hold";

export interface PersonaliseAccordionProps {
  person: ConversationPerson;
  isOpen: boolean;
  onToggle: () => void;
  onSent: () => void;
  /** "Your reply" is controlled by the parent screen — it owns the one shared DockedInputBar. See docs/09-decision-log.md, 2026-08-10. */
  draft: string;
  onChangeDraft: (text: string) => void;
  style: ReturnStyle | null;
  onChangeStyle: (style: ReturnStyle) => void;
  isReplyActive: boolean;
  /**
   * Hands the parent this instance's own changeDraft (which also persists
   * to storage, using friendMessage/sentAt only this instance has) — the
   * parent's shared DockedInputBar calls it directly rather than a bare
   * setter, so autosave-on-keystroke keeps working through the docked bar.
   */
  onActivateReply: (bundle: { onChangeText: (text: string) => void; friendMessage: string }) => void;
}

/**
 * The one per-person Send/Edit/Personalise mechanic used anywhere a
 * ConversationPerson can be personalised — originally built inline in
 * Library, extracted (2026-08-11) so Going Quiet's and Reconnect's own
 * completion steps can reach the same rich experience rather than each
 * growing a thinner, divergent version of it. See docs/09-decision-log.md,
 * 2026-08-11.
 */
export function PersonaliseAccordion({
  person,
  isOpen,
  onToggle,
  onSent,
  draft,
  onChangeDraft,
  style,
  onChangeStyle,
  isReplyActive,
  onActivateReply
}: PersonaliseAccordionProps) {
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [loaded, setLoaded] = useState(false);
  const [friendMessage, setFriendMessage] = useState("");
  // Settles into a muted, read-only-looking card once populated — pinned above
  // the reply box throughout drafting, never collapses. "Edit" is the only way
  // back to an editable field, no implicit/hidden gesture. Deliberately stays
  // an in-page field, not the docked bar — reference content pasted once, not
  // something actively composed. See docs/09-decision-log.md, 2026-08-10.
  const [friendMessageEditing, setFriendMessageEditing] = useState(true);
  const [status, setStatus] = useState<"none" | "draft" | "sent">("none");
  const [sentAt, setSentAt] = useState<number | null>(null);
  const safeguardingTriggered = useSafeguardingCheck(draft);

  useEffect(() => {
    if (!isOpen || loaded) return;

    void (async () => {
      const existing = await getReply(person.id);
      if (existing) {
        setFriendMessage(existing.friendMessage);
        setFriendMessageEditing(!existing.friendMessage.trim());
        onChangeDraft(existing.draftReply);
        setStatus(existing.sentAt ? "sent" : "draft");
        setSentAt(existing.sentAt ?? null);
      }
      setLoaded(true);
    })();
    // onChangeDraft is a fresh closure each render from the parent — only
    // re-run this load-once effect on isOpen/loaded/person.id, matching its
    // original dependency list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, loaded, person.id]);

  const chooseStyle = (choice: ReturnStyle) => {
    onChangeStyle(choice);
    void createReplyDraft(choice).then(changeDraft);
  };

  const persist = async (
    sentAtValue: number | null,
    overrides?: { friendMessage?: string; draftReply?: string }
  ): Promise<StoredReply> => {
    const now = Date.now();
    const record: StoredReply = {
      id: person.id,
      recipientName: person.name,
      friendMessage: overrides?.friendMessage ?? friendMessage,
      friendMessageExpiresAt: now + FRIEND_MESSAGE_RETENTION_HOURS * 60 * 60 * 1000,
      draftReply: overrides?.draftReply ?? draft,
      draftReplyExpiresAt: now + DRAFT_REPLY_RETENTION_HOURS * 60 * 60 * 1000,
      createdAt: now,
      sentAt: sentAtValue
    };
    await saveReply(record);
    return record;
  };

  // Autosaves on every keystroke so an interruption before Save/Send never loses this content.
  const changeFriendMessage = (text: string) => {
    setFriendMessage(text);
    void persist(sentAt, { friendMessage: text });
  };

  const settleFriendMessage = () => {
    if (friendMessage.trim()) setFriendMessageEditing(false);
  };

  const changeDraft = (text: string) => {
    onChangeDraft(text);
    void persist(sentAt, { draftReply: text });
  };

  const showRetentionNoteOnce = () => {
    void (async () => {
      const hasSeen = await AsyncStorage.getItem(HAS_SEEN_RETENTION_NOTE_KEY);
      if (hasSeen) return;

      await AsyncStorage.setItem(HAS_SEEN_RETENTION_NOTE_KEY, "true");
      Alert.alert(
        "Saved",
        "Your reply stays on your device for a couple of days in case you need to step away. Their message clears sooner."
      );
    })();
  };

  const saveForLater = () => {
    void (async () => {
      await persist(null);
      setStatus("draft");
      onToggle();
      showRetentionNoteOnce();
    })();
  };

  const sendNow = () => {
    void (async () => {
      const now = Date.now();
      const record = await persist(now);
      try {
        await sendOrShare([person.phoneNumber], record.draftReply.trim());
      } catch {
        // The compose sheet closing is the only signal available either way.
      }
      setStatus("sent");
      setSentAt(now);
      onToggle();
      onSent();
    })();
  };

  const statusLabel =
    status === "sent" && sentAt !== null
      ? formatSentLabel(sentAt, "Sent. They'll hear from you properly.")
      : status === "draft"
        ? "Continue draft"
        : "Personalise";

  return (
    <View style={styles.personaliseBlock}>
      <Pressable accessibilityRole="button" onPress={onToggle}>
        <Text style={styles.linkText}>{isOpen ? "Close" : statusLabel}</Text>
      </Pressable>

      {isOpen ? (
        <View style={styles.accordionPanel}>
          <Text style={styles.contactedStatus}>
            {person.sentAt !== null
              ? "Already sent them a message."
              : "This will be your first message to them."}
          </Text>

          <Text style={styles.fieldLabel}>What they sent</Text>
          {friendMessageEditing ? (
            <TextInput
              accessibilityLabel="Message they sent"
              multiline
              onBlur={settleFriendMessage}
              onChangeText={changeFriendMessage}
              style={styles.input}
              textAlignVertical="top"
              value={friendMessage}
            />
          ) : (
            <View style={styles.friendMessageSettled}>
              <Text style={styles.friendMessageSettledText}>{friendMessage}</Text>
              <Pressable accessibilityRole="button" onPress={() => setFriendMessageEditing(true)}>
                <Text style={styles.linkText}>Edit</Text>
              </Pressable>
            </View>
          )}

          <Text style={styles.fieldLabel}>Starting point</Text>
          <View style={styles.styleChipRow}>
            {REPLY_STYLES.map((option) => (
              <Pressable
                key={option.id}
                accessibilityRole="button"
                onPress={() => chooseStyle(option.id)}
                style={[styles.styleChip, style === option.id && styles.styleChipSelected]}
              >
                <Text
                  style={[styles.styleChipText, style === option.id && styles.styleChipTextSelected]}
                >
                  {option.title}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.fieldLabel}>Your reply</Text>
          <DockedFieldPreview
            value={draft}
            placeholder="Your reply"
            isActive={isReplyActive}
            onPress={() => onActivateReply({ onChangeText: changeDraft, friendMessage })}
            accessibilityLabel="Your reply"
          />

          <SafeguardingBanner visible={safeguardingTriggered} />

          <View style={styles.accordionActions}>
            <SecondaryButton label="Save for later" onPress={saveForLater} />
            <CompactSendButton
              disabled={!draft.trim()}
              accessibilityLabel="Send reply now"
              onPress={sendNow}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    personaliseBlock: {
      gap: theme.spacing.sm
    },
    accordionPanel: {
      gap: theme.spacing.xs
    },
    contactedStatus: {
      color: colors.textMuted,
      fontSize: 13,
      fontStyle: "italic"
    },
    fieldLabel: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: "600",
      marginTop: theme.spacing.xs
    },
    input: {
      minHeight: 60,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: theme.radius.md,
      padding: theme.spacing.sm,
      color: colors.text,
      fontSize: 16,
      lineHeight: 22,
      backgroundColor: colors.surface
    },
    friendMessageSettled: {
      gap: theme.spacing.xs,
      padding: theme.spacing.sm,
      borderRadius: theme.radius.md,
      backgroundColor: colors.surfaceStrong
    },
    friendMessageSettledText: {
      color: colors.textMuted,
      fontSize: 15,
      lineHeight: 21
    },
    linkText: {
      color: colors.link,
      fontSize: 13,
      fontWeight: "600"
    },
    styleChipRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.xs
    },
    styleChip: {
      minHeight: 32,
      borderRadius: theme.radius.pill,
      borderWidth: 1.5,
      borderColor: colors.border,
      paddingHorizontal: theme.spacing.sm,
      alignItems: "center",
      justifyContent: "center"
    },
    styleChipSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary
    },
    styleChipText: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "600"
    },
    styleChipTextSelected: {
      color: colors.onPrimary
    },
    accordionActions: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: theme.spacing.sm
    }
  });
}
