import { useMemo, useState } from "react";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Screen } from "@/components/Screen";
import { StepHeader } from "@/components/StepHeader";
import { GroupPicker } from "@/components/GroupPicker";
import { ChoiceCard } from "@/components/ChoiceCard";
import { RecipientPersonalisation } from "@/components/RecipientPersonalisation";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SecondaryButton } from "@/components/SecondaryButton";
import { EmailOutOfOffice } from "@/components/EmailOutOfOffice";
import { WiderWorldStatus } from "@/components/WiderWorldStatus";
import { HOLD_INTENTS } from "@/constants/copy";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";
import { buildAudienceCircles, useHoldFlow } from "@/context/HoldFlowContext";
import { createDraft } from "@/services/draftService";
import { recordPostSendChoices, startHoldPeriod } from "@/services/holdHistoryService";
import { circleDraftKey, clearDraft } from "@/services/messageDraftService";
import { seedPersonaliseRecipient } from "@/services/conversationService";
import { activateOutOfOffice } from "@/services/emailAccountService";
import { copyToClipboard } from "@/services/clipboardService";
import { sendOrShare } from "@/services/smsService";
import type { EmailAccount, GoingQuietRecipient, HoldIntent } from "@/types/hold";

const DEFAULT_OOO_MESSAGE =
  "I’m currently away and will respond when I’m back. Thank you for understanding.";
const DEFAULT_STATUS_LINE = "Taking some quiet time. Back soon.";

export default function HoldPeopleScreen() {
  const {
    recipients,
    selectedGroups,
    toggleGroup,
    circleDrafts,
    setCircleDraftIntent,
    setCircleDraftMessage,
    saveCircleDraftAsDefault,
    goingQuietRecipients,
    toggleRecipientIncluded,
    setRecipientIndividuallyRemoved,
    setRecipientInstantMessage,
    setRecipientRouteToPersonalise
  } = useHoldFlow();
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [showingChipsFor, setShowingChipsFor] = useState<Set<string>>(new Set());

  const [sentAt, setSentAt] = useState<number | null>(null);
  const [personalPromptChoice, setPersonalPromptChoice] = useState<"pending" | "yes" | "not-now">(
    "pending"
  );
  const [personalNoteDrafts, setPersonalNoteDrafts] = useState<Record<string, string>>({});
  const [personalNoteSentAt, setPersonalNoteSentAt] = useState<Record<string, number>>({});

  const [emailEnabled, setEmailEnabled] = useState(false);
  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([]);
  const [useSameEmailMessage, setUseSameEmailMessage] = useState(true);
  const [sharedEmailMessage, setSharedEmailMessage] = useState(DEFAULT_OOO_MESSAGE);
  const [widerWorldEnabled, setWiderWorldEnabled] = useState(false);
  const [widerWorldText, setWiderWorldText] = useState(DEFAULT_STATUS_LINE);

  const canSend =
    selectedGroups.length > 0 &&
    selectedGroups.every((group) => group.contacts.length > 0) &&
    circleDrafts.length > 0 &&
    circleDrafts.every((draft) => draft.message.trim().length > 0);

  const excludedNotRemoved = goingQuietRecipients.filter(
    (recipient) => !recipient.included && !recipient.individuallyRemoved
  );

  const chooseIntent = async (circleId: string, choice: HoldIntent) => {
    setCircleDraftIntent(circleId, choice);
    const recipientNames =
      selectedGroups.find((group) => group.id === circleId)?.contacts.map((contact) => contact.name) ?? [];
    const draftText = await createDraft({ mode: "hold", recipients: recipientNames, intent: choice });
    setCircleDraftMessage(circleId, draftText);
    setShowingChipsFor((current) => {
      const next = new Set(current);
      next.delete(circleId);
      return next;
    });
  };

  const changeTemplate = (circleId: string) => {
    setShowingChipsFor((current) => new Set(current).add(circleId));
  };

  const resolvedEmailMessageFor = (account: EmailAccount) =>
    (useSameEmailMessage ? sharedEmailMessage : account.message).trim();

  const send = async () => {
    const recipientsByCircle = new Map<string, GoingQuietRecipient[]>();
    for (const recipient of goingQuietRecipients) {
      const list = recipientsByCircle.get(recipient.circleId) ?? [];
      list.push(recipient);
      recipientsByCircle.set(recipient.circleId, list);
    }

    for (const draft of circleDrafts) {
      const circleRecipients = recipientsByCircle.get(draft.circleId) ?? [];
      const groupRecipients = circleRecipients.filter((recipient) => recipient.included);
      const text = draft.message.trim();

      if (groupRecipients.length > 0 && text) {
        try {
          await sendOrShare(groupRecipients.map((recipient) => recipient.phoneNumber), text);
        } catch {
          // Move on even if this compose sheet was dismissed.
        }
      }

      const individualRecipients = circleRecipients.filter(
        (recipient) => !recipient.included && !recipient.individuallyRemoved && !recipient.routeToPersonalise
      );
      for (const recipient of individualRecipients) {
        const individualText = recipient.instantMessage.trim();
        if (!individualText) continue;

        try {
          await sendOrShare([recipient.phoneNumber], individualText);
        } catch {
          // Move on to the next person even if this compose sheet was dismissed.
        }
      }

      const personaliseRecipients = circleRecipients.filter(
        (recipient) => !recipient.included && !recipient.individuallyRemoved && recipient.routeToPersonalise
      );
      for (const recipient of personaliseRecipients) {
        await seedPersonaliseRecipient({
          name: recipient.name,
          phoneNumber: recipient.phoneNumber,
          circleId: recipient.circleId,
          circleName: recipient.circleName
        });
      }

      await clearDraft(circleDraftKey(draft.circleId));
    }

    await startHoldPeriod({ recipients, audienceCircles: buildAudienceCircles(selectedGroups) });
    setSentAt(Date.now());
  };

  const sendPersonalNote = async (recipient: GoingQuietRecipient) => {
    const text = (personalNoteDrafts[recipient.contactId] ?? "").trim();
    if (!text) return;

    try {
      await sendOrShare([recipient.phoneNumber], text);
    } catch {
      // The compose sheet closing is the only signal available either way.
    }
    setPersonalNoteSentAt((current) => ({ ...current, [recipient.contactId]: Date.now() }));
  };

  const finish = async () => {
    if (emailEnabled) {
      const enabledAccounts = emailAccounts
        .filter((account) => account.enabled)
        .map((account) => ({ ...account, message: resolvedEmailMessageFor(account) }));
      await activateOutOfOffice(enabledAccounts);
    }

    if (widerWorldEnabled && widerWorldText.trim()) {
      await copyToClipboard(widerWorldText.trim());
    }

    await recordPostSendChoices({
      emailOutOfOfficeEnabled: emailEnabled,
      widerWorldStatusEnabled: widerWorldEnabled
    });

    router.replace("/create/done");
  };

  return (
    <Screen contentContainerStyle={styles.content}>
      <StepHeader
        eyebrow="Going Quiet"
        title="Who needs to know?"
        body="Choose one or more Circles, then let them know."
      />
      <GroupPicker
        selectedGroupIds={selectedGroups.map((group) => group.id)}
        onToggle={toggleGroup}
      />

      {circleDrafts.map((draft) => {
        const showChips =
          showingChipsFor.has(draft.circleId) || (draft.savedMessage === null && !draft.message.trim());
        const isSaved = draft.savedMessage !== null && draft.message === draft.savedMessage;
        const circleRecipients = goingQuietRecipients.filter(
          (recipient) => recipient.circleId === draft.circleId
        );

        return (
          <View key={draft.circleId} style={styles.circleSection}>
            <Text style={styles.sectionLabel}>{draft.circleName}</Text>

            <RecipientPersonalisation
              recipients={circleRecipients}
              onToggleIncluded={toggleRecipientIncluded}
              onSetIndividuallyRemoved={setRecipientIndividuallyRemoved}
              onSetInstantMessage={setRecipientInstantMessage}
              onSetRouteToPersonalise={setRecipientRouteToPersonalise}
            />

            {sentAt !== null ? (
              <View style={styles.sentPill}>
                <Text style={styles.sentPillText}>✓ Sent</Text>
              </View>
            ) : showChips ? (
              <View accessibilityRole="radiogroup" style={styles.choices}>
                {HOLD_INTENTS.map((choice) => (
                  <ChoiceCard
                    key={choice.id}
                    title={choice.title}
                    description={choice.description}
                    selected={draft.intent === choice.id}
                    onPress={() => void chooseIntent(draft.circleId, choice.id)}
                  />
                ))}
              </View>
            ) : (
              <View style={styles.messageBlock}>
                <TextInput
                  accessibilityLabel={`Message for ${draft.circleName}`}
                  multiline
                  onChangeText={(text) => setCircleDraftMessage(draft.circleId, text)}
                  style={styles.messageInput}
                  textAlignVertical="top"
                  value={draft.message}
                />
                <View style={styles.messageControls}>
                  <Pressable accessibilityRole="button" onPress={() => changeTemplate(draft.circleId)}>
                    <Text style={styles.linkText}>Change template</Text>
                  </Pressable>
                  {isSaved ? (
                    <View style={styles.savedPill} accessibilityRole="text">
                      <Text style={styles.savedPillText}>✓ Saved to Library</Text>
                    </View>
                  ) : (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => void saveCircleDraftAsDefault(draft.circleId)}
                    >
                      <Text style={styles.linkText}>Save to Library</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            )}
          </View>
        );
      })}

      {sentAt === null ? (
        <PrimaryButton disabled={!canSend} label="Send" onPress={() => void send()} />
      ) : (
        <>
          <Text style={styles.confirmation}>
            Sent. You've communicated to everyone who needs to know.
          </Text>

          {excludedNotRemoved.length > 0 ? (
            <View style={styles.personalPrompt}>
              {personalPromptChoice === "pending" ? (
                <View style={styles.personalPromptRow}>
                  <Text style={styles.personalPromptText}>
                    Want to send anyone something more personal?
                  </Text>
                  <View style={styles.personalPromptActions}>
                    <SecondaryButton
                      label="Not now"
                      onPress={() => setPersonalPromptChoice("not-now")}
                    />
                    <SecondaryButton label="Yes" onPress={() => setPersonalPromptChoice("yes")} />
                  </View>
                </View>
              ) : personalPromptChoice === "yes" ? (
                <View style={styles.personalNoteList}>
                  {excludedNotRemoved.map((recipient) => {
                    const noteSentAt = personalNoteSentAt[recipient.contactId];
                    return (
                      <View key={recipient.contactId} style={styles.personalNoteBlock}>
                        <Text style={styles.name}>{recipient.name}</Text>
                        {noteSentAt ? (
                          <View style={styles.sentPill}>
                            <Text style={styles.sentPillText}>✓ Sent</Text>
                          </View>
                        ) : (
                          <>
                            <TextInput
                              accessibilityLabel={`Personal note for ${recipient.name}`}
                              multiline
                              onChangeText={(text) =>
                                setPersonalNoteDrafts((current) => ({
                                  ...current,
                                  [recipient.contactId]: text
                                }))
                              }
                              style={styles.messageInput}
                              textAlignVertical="top"
                              value={personalNoteDrafts[recipient.contactId] ?? ""}
                            />
                            <SecondaryButton
                              disabled={!(personalNoteDrafts[recipient.contactId] ?? "").trim()}
                              label="Send"
                              onPress={() => void sendPersonalNote(recipient)}
                            />
                          </>
                        )}
                      </View>
                    );
                  })}
                </View>
              ) : null}
            </View>
          ) : null}

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

          <PrimaryButton label="Done" onPress={() => void finish()} />
        </>
      )}
    </Screen>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    content: {
      gap: theme.spacing.lg
    },
    circleSection: {
      gap: theme.spacing.sm
    },
    sectionLabel: {
      color: colors.text,
      fontSize: 22,
      lineHeight: 28,
      fontWeight: "600",
      letterSpacing: -0.3
    },
    choices: {
      gap: theme.spacing.sm
    },
    messageBlock: {
      gap: theme.spacing.xs
    },
    messageInput: {
      minHeight: 100,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: theme.radius.md,
      padding: theme.spacing.md,
      color: colors.text,
      fontSize: 17,
      lineHeight: 25,
      backgroundColor: colors.surface
    },
    messageControls: {
      flexDirection: "row",
      gap: theme.spacing.lg
    },
    linkText: {
      color: colors.link,
      fontSize: 14,
      fontWeight: "600"
    },
    savedPill: {
      minHeight: 28,
      borderRadius: theme.radius.pill,
      paddingHorizontal: theme.spacing.sm,
      alignItems: "center",
      justifyContent: "center",
      alignSelf: "flex-start",
      backgroundColor: colors.surfaceStrong
    },
    savedPillText: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: "600"
    },
    sentPill: {
      alignSelf: "flex-start",
      minHeight: 32,
      borderRadius: theme.radius.pill,
      paddingHorizontal: theme.spacing.md,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceStrong
    },
    sentPillText: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: "600"
    },
    confirmation: {
      color: colors.text,
      fontSize: 17,
      fontWeight: "600",
      lineHeight: 24
    },
    personalPrompt: {
      gap: theme.spacing.md
    },
    personalPromptRow: {
      gap: theme.spacing.sm
    },
    personalPromptText: {
      color: colors.text,
      fontSize: 16,
      lineHeight: 23
    },
    personalPromptActions: {
      flexDirection: "row",
      gap: theme.spacing.sm
    },
    personalNoteList: {
      gap: theme.spacing.md
    },
    personalNoteBlock: {
      gap: theme.spacing.xs
    },
    name: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "600"
    }
  });
}
