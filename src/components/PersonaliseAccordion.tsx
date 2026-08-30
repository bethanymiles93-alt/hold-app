import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { ClipboardPasteButton, getStringAsync, isPasteButtonAvailable } from "expo-clipboard";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SecondaryButton } from "@/components/SecondaryButton";
import { CompactSendButton } from "@/components/CompactSendButton";
import { DockedFieldPreview } from "@/components/DockedFieldPreview";
import { SafeguardingBanner } from "@/components/SafeguardingBanner";
import { useSafeguardingCheck } from "@/hooks/useSafeguardingCheck";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";
import { CONVERSATIONS_REPLY_RETENTION_DAYS, REPLY_STYLES } from "@/constants/copy";
import { HAS_SEEN_RETENTION_NOTE_KEY } from "@/constants/storageKeys";
import type { ConversationPerson } from "@/services/conversationService";
import { sendOrShare } from "@/services/smsService";
import { createReplyDraft } from "@/services/draftService";
import { getReply, saveReply } from "@/services/replyStorageService";
import { getLastSentMessage } from "@/services/lastSentMessageService";
import { needsHeadsUp } from "@/services/replyExpiry";
import { formatSentLabel } from "@/services/holdHistoryFormat";
import type { ReturnStyle, StoredReply } from "@/types/hold";

export interface PersonaliseAccordionProps {
  person: ConversationPerson;
  isOpen: boolean;
  onToggle: () => void;
  /** Passed the actual sent text (2026-08-31) so the parent can persist it as this person's new "last sent" — see lastSentMessageService.ts. */
  onSent: (sentText: string) => void;
  /**
   * Inserts `text` as a highlighted, revert-on-edit block into whichever
   * docked-bar field is currently active — the same mechanic Template's
   * own insert uses. Powers the read-only "Last sent" reveal below; never
   * called automatically. See docs/09-decision-log.md, 2026-08-31.
   */
  onInsertLastSent: (text: string) => void;
  /** "Your reply" is controlled by the parent screen — it owns the one shared DockedInputBar. See docs/09-decision-log.md, 2026-08-10. */
  draft: string;
  onChangeDraft: (text: string) => void;
  style: ReturnStyle | null;
  onChangeStyle: (style: ReturnStyle) => void;
  isReplyActive: boolean;
  /**
   * Hands the parent this instance's own changeDraft (which also persists
   * to storage, using friendMessage/sentAt only this instance has) and
   * sendNow — the parent's shared DockedInputBar calls both directly
   * rather than bare setters, so autosave-on-keystroke and the docked
   * bar's own Send icon both keep working through the docked bar. `onSend`
   * closing over this instance's own sendNow is what makes Box B's Send
   * icon actually send (2026-08-29 fix — it previously only closed the
   * field, since the docked bar had no way to reach this instance's local
   * send logic at all). See docs/09-decision-log.md.
   */
  onActivateReply: (bundle: { onChangeText: (text: string) => void; friendMessage: string; onSend: () => void }) => void;
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
  onInsertLastSent,
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
  /** Read-only, collapsed by default — see lastSentMessageService.ts. Loaded alongside friendMessage/reply below, not a separate effect. */
  const [lastSentMessage, setLastSentMessage] = useState<string | null>(null);
  const [lastSentExpanded, setLastSentExpanded] = useState(false);
  /** Threaded through every persist() call, same as sentAt above, so it survives the record being rebuilt on every keystroke autosave. See docs/09-decision-log.md, 2026-08-21. */
  const [headsUpShownAt, setHeadsUpShownAt] = useState<number | undefined>(undefined);
  const safeguardingTriggered = useSafeguardingCheck(draft);

  // The `onSend` handed to the parent's docked bar (below) is captured once,
  // at the moment the box is tapped open — a closure over that render's
  // `draft` prop would go stale the instant the person typed anything
  // afterward in the now-open docked bar, since re-activating isn't what
  // updates it. A ref sidesteps that: always the latest value, regardless
  // of which render's closure ends up calling it. See docs/09-decision-log.md,
  // 2026-08-29.
  const draftRef = useRef(draft);
  draftRef.current = draft;

  useEffect(() => {
    if (!isOpen || loaded) return;

    void (async () => {
      setLastSentMessage(await getLastSentMessage(person.id));
      const existing = await getReply(person.id);
      if (existing) {
        setFriendMessage(existing.friendMessage);
        setFriendMessageEditing(!existing.friendMessage.trim());
        onChangeDraft(existing.draftReply);
        setStatus(existing.sentAt ? "sent" : "draft");
        setSentAt(existing.sentAt ?? null);
        setHeadsUpShownAt(existing.headsUpShownAt);

        // Quiet, one-time-per-draft heads-up as this record nears its own
        // 7-day retention backstop — never a countdown/urgency framing, see
        // hold-book 06-privacy-security/04-content-retention.md, "Heads-up
        // before auto-clear".
        if (needsHeadsUp(existing, Date.now())) {
          const shownAt = Date.now();
          setHeadsUpShownAt(shownAt);
          await saveReply({ ...existing, headsUpShownAt: shownAt });
          // hold-book's own suggested wording ends "...or save it to Library?" —
          // adjusted here: no "save a Conversations reply to Library" action
          // exists anywhere in this component (Library's saved-template
          // mechanism is Circle-scoped, for Going Quiet/Reconnect messages,
          // not per-person Conversations replies). Flagged as a real gap
          // rather than promising a button that isn't there. See
          // docs/09-decision-log.md, 2026-08-21.
          Alert.alert("Still there?", "This draft has been open a while. Send it when you're ready, or keep it as is.");
        }
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
    // Both fields share one 7-day lifecycle now — friendMessage never
    // expires earlier than draftReply, they clear together on the same
    // clock. See hold-book 06-privacy-security/04-content-retention.md,
    // "Draft retention windows — resolved".
    const expiresAt = now + CONVERSATIONS_REPLY_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const record: StoredReply = {
      id: person.id,
      recipientName: person.name,
      friendMessage: overrides?.friendMessage ?? friendMessage,
      friendMessageExpiresAt: expiresAt,
      draftReply: overrides?.draftReply ?? draft,
      draftReplyExpiresAt: expiresAt,
      createdAt: now,
      sentAt: sentAtValue
      // headsUpShownAt deliberately NOT carried forward here — every
      // persist() call recomputes expiresAt fresh (now + 7 days), so any
      // earlier heads-up is stale the moment real activity happens again;
      // omitting it resets eligibility for the new, later deadline. Only
      // the direct saveReply() call in the load effect below sets it,
      // against the record's own unchanged expiry, not through persist().
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

  /**
   * Fallback path (Android, pre-iOS-16) for someone who's already inside
   * Hold and has manually copied a message elsewhere — the genuine native
   * ClipboardPasteButton is used instead wherever isPasteButtonAvailable
   * is true (iOS 16+, no permission prompt at all). This path triggers the
   * OS's own "Allow Paste" system prompt, likely every time until the
   * person sets Hold to Allow in their own Settings — still a real
   * improvement over the full manual copy-switch-paste round trip. See
   * docs/09-decision-log.md, 2026-08-30.
   */
  const pasteFromClipboard = () => {
    void getStringAsync().then((text) => {
      if (text.trim()) changeFriendMessage(text);
    });
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
        "This and their message stay private to your device for about a week, then clear together. Nothing to manage."
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
      // Explicit override, not persist()'s own draft-prop default — see
      // draftRef's own comment above: this can be called from a stale
      // closure (the docked bar's Send icon), so it must read the ref, not
      // whatever `draft` this particular closure remembers.
      const record = await persist(now, { draftReply: draftRef.current });
      try {
        await sendOrShare([person.phoneNumber], record.draftReply.trim());
      } catch {
        // The compose sheet closing is the only signal available either way.
      }
      setStatus("sent");
      setSentAt(now);
      setLastSentMessage(record.draftReply.trim());
      onToggle();
      onSent(record.draftReply.trim());
    })();
  };

  const statusLabel =
    status === "sent" && sentAt !== null
      ? formatSentLabel(sentAt, "Sent. They'll hear from you properly.")
      : status === "draft"
        ? "Continue draft"
        : "Conversations";

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

          <View style={styles.fieldLabelRow}>
            <Text style={styles.fieldLabel}>What they sent</Text>
            {friendMessageEditing ? (
              isPasteButtonAvailable ? (
                <ClipboardPasteButton
                  acceptedContentTypes={["plain-text"]}
                  displayMode="iconAndLabel"
                  style={styles.pasteButton}
                  onPress={(data) => {
                    if (data.type === "text" && data.text.trim()) changeFriendMessage(data.text);
                  }}
                />
              ) : (
                <Pressable accessibilityRole="button" onPress={pasteFromClipboard}>
                  <Text style={styles.linkText}>Paste</Text>
                </Pressable>
              )
            ) : null}
          </View>
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

          {lastSentMessage ? (
            <View style={styles.lastSentBlock}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Last sent. ${lastSentExpanded ? "Hide" : "Show"} what you last sent them.`}
                accessibilityState={{ expanded: lastSentExpanded }}
                onPress={() => setLastSentExpanded((current) => !current)}
                style={styles.lastSentHeader}
              >
                <Text style={styles.fieldLabel}>Last sent</Text>
                <Text style={styles.lastSentChevron}>{lastSentExpanded ? "▲" : "▼"}</Text>
              </Pressable>
              {lastSentExpanded ? (
                <>
                  <Text style={styles.lastSentText}>{lastSentMessage}</Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      // Ensures the reply field is actually active first —
                      // same bundle DockedFieldPreview's own onPress uses
                      // below, safe to call even if already active. The
                      // insert itself happens via onInsertLastSent, which
                      // the parent implements as a one-shot pendingInsert
                      // on its own shared docked bar.
                      onActivateReply({
                        onChangeText: changeDraft,
                        friendMessage,
                        onSend: () => {
                          if (draftRef.current.trim()) sendNow();
                        }
                      });
                      onInsertLastSent(lastSentMessage);
                    }}
                  >
                    <Text style={styles.linkText}>Insert into reply</Text>
                  </Pressable>
                </>
              ) : null}
            </View>
          ) : null}

          <Text style={styles.fieldLabel}>Your reply</Text>
          <DockedFieldPreview
            value={draft}
            placeholder="Your reply"
            isActive={isReplyActive}
            onPress={() =>
              onActivateReply({
                onChangeText: changeDraft,
                friendMessage,
                // Guards empty-draft sends itself — the docked bar's Send
                // icon has no disabled state of its own, unlike
                // CompactSendButton just below, which this instance's own
                // inline send already correctly disables on an empty draft.
                // Reads draftRef, not draft — see draftRef's own comment.
                onSend: () => {
                  if (draftRef.current.trim()) sendNow();
                }
              })
            }
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
    fieldLabelRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between"
    },
    pasteButton: {
      height: 30,
      width: 90
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
    lastSentBlock: {
      gap: theme.spacing.xs
    },
    lastSentHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between"
    },
    lastSentChevron: {
      color: colors.textMuted,
      fontSize: 13
    },
    lastSentText: {
      color: colors.textMuted,
      fontSize: 15,
      lineHeight: 21,
      padding: theme.spacing.sm,
      borderRadius: theme.radius.md,
      backgroundColor: colors.surfaceStrong
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
