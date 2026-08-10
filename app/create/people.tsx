import { useCallback, useEffect, useMemo, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Screen } from "@/components/Screen";
import { StepHeader } from "@/components/StepHeader";
import { GroupPicker, type PendingNewCircle } from "@/components/GroupPicker";
import { ChoiceCard } from "@/components/ChoiceCard";
import { AdaptiveCircleChip } from "@/components/AdaptiveCircleChip";
import { RecipientPersonalisation } from "@/components/RecipientPersonalisation";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SecondaryButton } from "@/components/SecondaryButton";
import { AmendWithAI } from "@/components/AmendWithAI";
import { EmailOutOfOffice } from "@/components/EmailOutOfOffice";
import { WiderWorldStatus } from "@/components/WiderWorldStatus";
import { SafeguardingBanner } from "@/components/SafeguardingBanner";
import { useSafeguardingCheck } from "@/hooks/useSafeguardingCheck";
import { HOLD_INTENTS } from "@/constants/copy";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";
import { buildAudienceCircles, useHoldFlow } from "@/context/HoldFlowContext";
import { createDraft } from "@/services/draftService";
import {
  getOpenHoldPeriod,
  recordPostSendChoices,
  recordSendChannel,
  startHoldPeriod
} from "@/services/holdHistoryService";
import { seedPersonaliseRecipient } from "@/services/conversationService";
import { activateOutOfOffice } from "@/services/emailAccountService";
import { addContactToGroup, createGroup } from "@/services/circleService";
import { copyToClipboard } from "@/services/clipboardService";
import { channelKey, sendOrShare } from "@/services/smsService";
import type {
  EmailAccount,
  GoingQuietCircleDraft,
  GoingQuietRecipient,
  HoldIntent,
  HoldPeriod
} from "@/types/hold";

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
    applyGeneratedTemplate,
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

  // Which drafted Circles are currently expanded/included in the next Send —
  // independent of hasSentThisSession, matching the isSelected/hasSentThisSession
  // pattern already built for Reconnect, Taking Time's update, and Library's
  // Quick message. A circle only auto-joins this set once (see the effect
  // below); once sent-and-deselected it stays deselected until re-tapped.
  const [selectedCircleIds, setSelectedCircleIds] = useState<Set<string>>(new Set());
  // Durable, on the still-open Hold period (see holdHistoryService.ts). No new
  // field needed: recordSendChannel already keys sendChannels by Circle id on
  // every real group send, so "has this Circle been sent this session" is
  // derived from it — the same derived-not-stored approach Library's Quick
  // message uses, rather than inventing a parallel flag that could drift.
  const [period, setPeriod] = useState<HoldPeriod | null>(null);
  const [personalPromptChoice, setPersonalPromptChoice] = useState<"pending" | "yes" | "not-now">(
    "pending"
  );
  const [personalNoteDrafts, setPersonalNoteDrafts] = useState<Record<string, string>>({});
  const [personalNoteSentAt, setPersonalNoteSentAt] = useState<Record<string, number>>({});
  const [oooExpanded, setOooExpanded] = useState(false);
  const [pendingNewCircles, setPendingNewCircles] = useState<PendingNewCircle[]>([]);
  const [resolvedPendingCircles, setResolvedPendingCircles] = useState<Set<string>>(new Set());

  const [emailEnabled, setEmailEnabled] = useState(false);
  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([]);
  const [useSameEmailMessage, setUseSameEmailMessage] = useState(true);
  const [sharedEmailMessage, setSharedEmailMessage] = useState(DEFAULT_OOO_MESSAGE);
  const [widerWorldEnabled, setWiderWorldEnabled] = useState(false);
  const [widerWorldText, setWiderWorldText] = useState(DEFAULT_STATUS_LINE);

  const refreshPeriod = useCallback(async () => {
    setPeriod(await getOpenHoldPeriod());
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshPeriod();
    }, [refreshPeriod])
  );

  // sendChannels also holds individual-recipient phone-number keys (from the
  // instant-message loop in send()) — filtering to circleDrafts' own ids
  // keeps this to genuine whole-Circle group sends only.
  const sentCircleIds = useMemo(() => {
    if (!period?.sendChannels) return [];
    const channelKeys = new Set(Object.keys(period.sendChannels));
    return circleDrafts.filter((draft) => channelKeys.has(draft.circleId)).map((draft) => draft.circleId);
  }, [period, circleDrafts]);

  const hasSentAnything = sentCircleIds.length > 0;

  // Keeps selection in sync as Circles are added/removed via GroupPicker: a
  // freshly-added, never-sent draft joins the selection automatically (so it
  // behaves like today's "every selected Circle has a visible card" default);
  // a sent-and-deselected draft is deliberately left alone, since re-adding it
  // here would undo the user's own "not now" tap.
  useEffect(() => {
    setSelectedCircleIds((current) => {
      const draftIds = new Set(circleDrafts.map((draft) => draft.circleId));
      let changed = false;
      const next = new Set(current);
      for (const id of next) {
        if (!draftIds.has(id)) {
          next.delete(id);
          changed = true;
        }
      }
      for (const draft of circleDrafts) {
        if (!next.has(draft.circleId) && !sentCircleIds.includes(draft.circleId)) {
          next.add(draft.circleId);
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [circleDrafts, sentCircleIds]);

  const toggleCircleSelection = (circleId: string) => {
    setSelectedCircleIds((current) => {
      const next = new Set(current);
      if (next.has(circleId)) {
        next.delete(circleId);
      } else {
        next.add(circleId);
      }
      return next;
    });
  };

  const selectedDrafts = circleDrafts.filter((draft) => selectedCircleIds.has(draft.circleId));

  const canSend =
    selectedGroups.length > 0 &&
    selectedGroups.every((group) => group.contacts.length > 0) &&
    selectedDrafts.length > 0 &&
    selectedDrafts.every((draft) => draft.message.trim().length > 0);

  const excludedNotRemoved = goingQuietRecipients.filter(
    (recipient) =>
      !recipient.included && !recipient.individuallyRemoved && sentCircleIds.includes(recipient.circleId)
  );
  // Strict one-at-a-time reveal: nothing to personalise means stage 2 has
  // nothing to answer, so it's treated as already resolved.
  const personalPromptResolved = excludedNotRemoved.length === 0 || personalPromptChoice !== "pending";

  const chooseIntent = async (circleId: string, choice: HoldIntent) => {
    setCircleDraftIntent(circleId, choice);
    const recipientNames =
      selectedGroups.find((group) => group.id === circleId)?.contacts.map((contact) => contact.name) ?? [];
    const draftText = await createDraft({ mode: "hold", recipients: recipientNames, intent: choice });
    await applyGeneratedTemplate(circleId, draftText);
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
    if (selectedDrafts.length === 0) return;

    // The period is created once, on this session's first Send, and reused
    // for every subsequent per-Circle Send — sending is repeatable now, so
    // this can no longer start a fresh period (and silently orphan the
    // previous one) on every call the way the old single-shot send() did.
    const periodId = period?.id ?? (await startHoldPeriod({
      recipients,
      audienceCircles: buildAudienceCircles(selectedGroups)
    }));

    const recipientsByCircle = new Map<string, GoingQuietRecipient[]>();
    for (const recipient of goingQuietRecipients) {
      const list = recipientsByCircle.get(recipient.circleId) ?? [];
      list.push(recipient);
      recipientsByCircle.set(recipient.circleId, list);
    }

    for (const draft of selectedDrafts) {
      const circleRecipients = recipientsByCircle.get(draft.circleId) ?? [];
      const groupRecipients = circleRecipients.filter((recipient) => recipient.included);
      const text = draft.message.trim();

      if (groupRecipients.length > 0 && text) {
        try {
          const channel = await sendOrShare(groupRecipients.map((recipient) => recipient.phoneNumber), text);
          await recordSendChannel(periodId, draft.circleId, channelKey(channel));
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
          const channel = await sendOrShare([recipient.phoneNumber], individualText);
          await recordSendChannel(periodId, recipient.phoneNumber, channelKey(channel));
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
    }

    await refreshPeriod();
    // Sent Circles drop out of the selection so their cards collapse back to
    // a compact sent chip — tapping one re-selects it (per the isSelected/
    // hasSentThisSession pattern), rather than leaving it expanded as if
    // still mid-draft.
    setSelectedCircleIds((current) => {
      const next = new Set(current);
      for (const draft of selectedDrafts) next.delete(draft.circleId);
      return next;
    });
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

  const confirmPendingCircle = async (pending: PendingNewCircle) => {
    // Real Circle creation and the contact add happen together, only now —
    // nothing exists in storage before this point.
    const group = await createGroup(pending.circleName);
    await addContactToGroup(group.id, pending.contact);
    setResolvedPendingCircles((current) => new Set(current).add(pending.tempId));
  };

  const discardPendingCircle = (pending: PendingNewCircle) => {
    setResolvedPendingCircles((current) => new Set(current).add(pending.tempId));
  };

  return (
    <Screen contentContainerStyle={styles.content}>
      <StepHeader title="Who needs to know?" />
      <GroupPicker
        selectedGroupIds={selectedGroups.map((group) => group.id)}
        onToggle={toggleGroup}
        onPendingContact={(pending) => setPendingNewCircles((current) => [...current, pending])}
      />

      {circleDrafts.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
          style={styles.chipScroll}
        >
          {circleDrafts.map((draft) => {
            const isSelected = selectedCircleIds.has(draft.circleId);
            const hasSentThisSession = sentCircleIds.includes(draft.circleId);
            const sentLook = hasSentThisSession && !isSelected;

            return (
              <AdaptiveCircleChip
                key={draft.circleId}
                label={sentLook ? `✓ ${draft.circleName}` : draft.circleName}
                isSelected={isSelected}
                hasSentThisSession={hasSentThisSession}
                onPress={() => toggleCircleSelection(draft.circleId)}
                accessibilityRole="button"
                accessibilityLabel={
                  sentLook
                    ? `${draft.circleName}, already sent. Tap to send another message.`
                    : draft.circleName
                }
              />
            );
          })}
        </ScrollView>
      ) : null}

      {circleDrafts
        .filter((draft) => selectedCircleIds.has(draft.circleId))
        .map((draft) => {
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

              {showChips ? (
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
                <GoingQuietMessageBox
                  styles={styles}
                  draft={draft}
                  isSaved={isSaved}
                  onChangeText={(text) => setCircleDraftMessage(draft.circleId, text)}
                  onChangeTemplate={() => changeTemplate(draft.circleId)}
                  onSaveDefault={() => void saveCircleDraftAsDefault(draft.circleId)}
                />
              )}
            </View>
          );
        })}

      <PrimaryButton disabled={!canSend} label="Send" onPress={() => void send()} />

      {hasSentAnything ? (
        <>
          <Text style={styles.confirmation}>
            Sent. You've communicated to everyone who needs to know.
          </Text>

          {pendingNewCircles
            .filter((pending) => !resolvedPendingCircles.has(pending.tempId))
            .map((pending) => (
              <View key={pending.tempId} style={styles.personalPromptRow}>
                <Text style={styles.personalPromptText}>
                  Add {pending.contact.name} to {pending.circleName} permanently?
                </Text>
                <View style={styles.personalPromptActions}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => discardPendingCircle(pending)}
                    style={styles.smallPill}
                  >
                    <Text style={styles.smallPillText}>Not now</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void confirmPendingCircle(pending)}
                    style={styles.smallPill}
                  >
                    <Text style={styles.smallPillText}>Yes</Text>
                  </Pressable>
                </View>
              </View>
            ))}

          {!personalPromptResolved ? (
            <View style={styles.personalPromptRow}>
              <Text style={styles.personalPromptText}>
                Want to send anyone something more personal?
              </Text>
              <View style={styles.personalPromptActions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setPersonalPromptChoice("not-now")}
                  style={styles.smallPill}
                >
                  <Text style={styles.smallPillText}>Not now</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setPersonalPromptChoice("yes")}
                  style={styles.smallPill}
                >
                  <Text style={styles.smallPillText}>Yes</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {personalPromptResolved && personalPromptChoice === "yes" ? (
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

          {personalPromptResolved ? (
            <>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: oooExpanded }}
                onPress={() => setOooExpanded((current) => !current)}
                style={styles.oooHeader}
              >
                <Text style={styles.oooHeaderText}>OOO and status</Text>
                <Text style={styles.oooChevron}>{oooExpanded ? "▲" : "▼"}</Text>
              </Pressable>

              {oooExpanded ? (
                <View style={styles.oooBody}>
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
              ) : null}

              <PrimaryButton label="Done" onPress={() => void finish()} />
            </>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

interface GoingQuietMessageBoxProps {
  styles: ReturnType<typeof createStyles>;
  draft: GoingQuietCircleDraft;
  isSaved: boolean;
  onChangeText: (text: string) => void;
  onChangeTemplate: () => void;
  onSaveDefault: () => void;
}

/**
 * Extracted so useSafeguardingCheck (a hook) can run once per Circle draft
 * with a stable identity — circleDrafts.map(...) can't call hooks directly,
 * since the array's length changes as Circles are toggled on/off.
 */
function GoingQuietMessageBox({
  styles,
  draft,
  isSaved,
  onChangeText,
  onChangeTemplate,
  onSaveDefault
}: GoingQuietMessageBoxProps) {
  const safeguardingTriggered = useSafeguardingCheck(draft.message);

  return (
    <View style={styles.messageBlock}>
      <TextInput
        accessibilityLabel={`Message for ${draft.circleName}`}
        multiline
        onChangeText={onChangeText}
        style={styles.messageInput}
        textAlignVertical="top"
        value={draft.message}
      />
      <View style={styles.messageControls}>
        <Pressable accessibilityRole="button" onPress={onChangeTemplate}>
          <Text style={styles.linkText}>Change template</Text>
        </Pressable>
        {isSaved ? (
          <View style={styles.savedPill} accessibilityRole="text">
            <Text style={styles.savedPillText}>✓ Saved to Library</Text>
          </View>
        ) : (
          <Pressable accessibilityRole="button" onPress={onSaveDefault}>
            <Text style={styles.linkText}>Save to Library</Text>
          </Pressable>
        )}
      </View>

      <SafeguardingBanner visible={safeguardingTriggered} />

      <AmendWithAI
        surface="going-quiet"
        currentMessage={draft.message}
        onApply={onChangeText}
        context={{ intent: draft.intent ?? undefined, recipientLabel: draft.circleName }}
      />
    </View>
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
      fontSize: 17,
      lineHeight: 23,
      fontWeight: "600",
      letterSpacing: -0.2
    },
    choices: {
      gap: theme.spacing.sm
    },
    chipScroll: {
      flexGrow: 0
    },
    chipRow: {
      flexDirection: "row",
      alignItems: "center",
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
    smallPill: {
      minHeight: 40,
      borderRadius: theme.radius.pill,
      paddingHorizontal: theme.spacing.md,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceStrong
    },
    smallPillText: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "600"
    },
    oooHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      minHeight: 44
    },
    oooHeaderText: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "600"
    },
    oooChevron: {
      color: colors.textMuted,
      fontSize: 13
    },
    oooBody: {
      gap: theme.spacing.md
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
