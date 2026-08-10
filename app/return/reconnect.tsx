import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Screen } from "@/components/Screen";
import { StepHeader } from "@/components/StepHeader";
import { CompactSendButton } from "@/components/CompactSendButton";
import { SecondaryButton } from "@/components/SecondaryButton";
import { AmendWithAI } from "@/components/AmendWithAI";
import { MemoryNoteSuggestion } from "@/components/MemoryNoteSuggestion";
import { AdaptiveCircleChip } from "@/components/AdaptiveCircleChip";
import { PENDING_CIRCLE_ID_PREFIX } from "@/components/GroupPicker";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";
import { QUICK_RECONNECT_MESSAGES } from "@/constants/copy";
import { useHoldFlow } from "@/context/HoldFlowContext";
import {
  beginReconnecting,
  getHoldPeriodById,
  getReconnectCoverage,
  getReconnectingPeriod,
  markPendingCircleResolved,
  markReconnectContacted,
  recordSendChannel
} from "@/services/holdHistoryService";
import {
  getAll as getAllConversationPeople,
  markContacted,
  seedFromAudience
} from "@/services/conversationService";
import { addContactToGroup, createGroup } from "@/services/circleService";
import { deactivateOutOfOffice } from "@/services/emailAccountService";
import { channelKey, sendOrShare } from "@/services/smsService";
import { clearDraft, getDraft, saveDraft } from "@/services/messageDraftService";
import type { AudienceCircle, HoldPeriod } from "@/types/hold";

const RECONNECT_DRAFT_KEY = "reconnect";

export default function ReconnectScreen() {
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { reconnectPeriodId } = useHoldFlow();

  const [period, setPeriod] = useState<HoldPeriod | null>(null);
  const [message, setMessage] = useState(QUICK_RECONNECT_MESSAGES[0]?.text ?? "");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [emailOff, setEmailOff] = useState(false);
  const [statusCleared, setStatusCleared] = useState(false);
  const [suggestedPrompt, setSuggestedPrompt] = useState<string | undefined>(undefined);
  const [oooExpanded, setOooExpanded] = useState(false);

  const refresh = useCallback(async () => {
    // Prefer the durable marker (force-quit-resume, or any visit after the first
    // genuine send). Before that marker exists — the very first visit this
    // session, or a resumed visit after backing out earlier without sending —
    // fall back to reading the period directly by the id context carried here
    // from Home, so the picker still has data with nothing durable written yet.
    const durable = await getReconnectingPeriod();
    const current = durable ?? (reconnectPeriodId ? await getHoldPeriodById(reconnectPeriodId) : null);
    setPeriod(current);

    if (current) {
      const coverage = getReconnectCoverage(current);
      setSelectedIds(new Set(coverage.totalIds.filter((id) => !coverage.contactedIds.includes(id))));
    }
  }, [reconnectPeriodId]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  useEffect(() => {
    void getDraft(RECONNECT_DRAFT_KEY).then((draft) => {
      if (draft) setMessage(draft);
    });
  }, []);

  const changeMessage = (text: string) => {
    setMessage(text);
    void saveDraft(RECONNECT_DRAFT_KEY, text);
  };

  const coverage = period ? getReconnectCoverage(period) : null;
  const allSelected = Boolean(
    coverage && coverage.totalIds.length > 0 && selectedIds.size === coverage.totalIds.length
  );

  const toggleAll = () => {
    if (!coverage) return;
    setSelectedIds(allSelected ? new Set() : new Set(coverage.totalIds));
  };

  const toggleId = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const send = async () => {
    if (!period) return;

    const circles = (period.audienceCircles ?? []).filter((circle) => selectedIds.has(circle.circleId));
    const ungrouped = (period.audienceUngrouped ?? []).filter((contact) =>
      selectedIds.has(contact.phoneNumber)
    );
    const numbers = [
      ...circles.flatMap((circle) => circle.contacts.map((contact) => contact.phoneNumber)),
      ...ungrouped.map((contact) => contact.phoneNumber)
    ];
    const text = message.trim();
    if (numbers.length === 0 || !text) return;

    try {
      const channel = await sendOrShare(numbers, text);
      for (const id of selectedIds) {
        await recordSendChannel(period.id, id, channelKey(channel));
      }
    } catch {
      // The compose sheet closing is the only signal available either way.
    }

    // Both the durable reconnecting marker and Conversations seeding only
    // happen here, at the first genuine send — never on entering the flow —
    // so backing out beforehand never leaves Home wrongly showing "Continue
    // reconnecting" or "Finish Reconnecting" for a Reconnect that was never
    // actually acted on. Both are idempotent, so repeat sends are harmless;
    // seeding uses the period's full audience, not just this send's
    // selection, so anyone not yet individually messaged still shows up in
    // Conversations once the coverage gate is eventually satisfied.
    await beginReconnecting(period.id);
    await seedFromAudience(period.audienceCircles ?? [], period.audienceUngrouped ?? []);

    for (const id of selectedIds) {
      await markReconnectContacted(period.id, id);
    }

    // Keep Library/Conversations' own per-person sentAt truthfully in sync,
    // so PersonaliseAccordion can honestly show already-contacted vs not.
    const conversationPeople = await getAllConversationPeople();
    const sentNumbers = new Set(numbers);
    const matchedIds = conversationPeople
      .filter((person) => sentNumbers.has(person.phoneNumber))
      .map((person) => person.id);
    if (matchedIds.length > 0) {
      await markContacted(matchedIds);
    }

    await clearDraft(RECONNECT_DRAFT_KEY);
    await refresh();
  };

  const goToConversations = () => {
    router.push("/library");
  };

  const notNow = () => {
    router.replace("/");
  };

  const turnOffEmail = () => {
    void deactivateOutOfOffice();
    setEmailOff(true);
  };

  const clearStatus = () => {
    setStatusCleared(true);
  };

  const confirmPendingCircle = async (circle: AudienceCircle) => {
    if (!period) return;
    const contact = circle.contacts[0];
    if (!contact) return;

    // Real Circle creation and the contact add happen together, only now —
    // nothing exists in storage before this point.
    const group = await createGroup(circle.circleName);
    await addContactToGroup(group.id, contact);
    await markPendingCircleResolved(period.id, circle.circleId);
    await refresh();
  };

  const discardPendingCircle = async (circle: AudienceCircle) => {
    if (!period) return;
    await markPendingCircleResolved(period.id, circle.circleId);
    await refresh();
  };

  if (!period || !coverage) {
    return <Screen contentContainerStyle={styles.content} />;
  }

  if (!coverage.complete) {
    const circlePills = period.audienceCircles ?? [];
    const ungroupedPills = period.audienceUngrouped ?? [];

    return (
      <Screen contentContainerStyle={styles.content}>
        <View style={styles.top}>
          <StepHeader body="Reach everyone at your own pace, a few at a time." />

          <MemoryNoteSuggestion onUseIt={setSuggestedPrompt} />

          <Text style={styles.progressText}>
            {coverage.contactedIds.length} of {coverage.totalIds.length} reached
          </Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            <AdaptiveCircleChip
              label="All"
              isSelected={allSelected}
              onPress={toggleAll}
              accessibilityRole="button"
            />

            {circlePills.map((circle) => {
              const isSelected = selectedIds.has(circle.circleId);
              const hasSentThisSession = coverage.contactedIds.includes(circle.circleId);
              const sentLook = hasSentThisSession && !isSelected;

              return (
                <AdaptiveCircleChip
                  key={circle.circleId}
                  label={sentLook ? `✓ ${circle.circleName}` : circle.circleName}
                  isSelected={isSelected}
                  hasSentThisSession={hasSentThisSession}
                  onPress={() => toggleId(circle.circleId)}
                  accessibilityRole="button"
                  accessibilityLabel={
                    sentLook
                      ? `${circle.circleName}, already reached. Tap to send another message.`
                      : circle.circleName
                  }
                />
              );
            })}

            {ungroupedPills.map((contact) => {
              const isSelected = selectedIds.has(contact.phoneNumber);
              const hasSentThisSession = coverage.contactedIds.includes(contact.phoneNumber);
              const sentLook = hasSentThisSession && !isSelected;

              return (
                <AdaptiveCircleChip
                  key={contact.phoneNumber}
                  label={sentLook ? `✓ ${contact.name}` : contact.name}
                  isSelected={isSelected}
                  hasSentThisSession={hasSentThisSession}
                  onPress={() => toggleId(contact.phoneNumber)}
                  accessibilityRole="button"
                  accessibilityLabel={
                    sentLook ? `${contact.name}, already reached. Tap to send another message.` : contact.name
                  }
                />
              );
            })}
          </ScrollView>

          <TextInput
            accessibilityLabel="Message to send"
            multiline
            onChangeText={changeMessage}
            style={styles.input}
            textAlignVertical="top"
            value={message}
          />

          <AmendWithAI
            surface="reconnect"
            currentMessage={message}
            onApply={changeMessage}
            initialPrompt={suggestedPrompt}
          />
        </View>

        <View style={styles.sendRow}>
          <CompactSendButton
            disabled={selectedIds.size === 0 || !message.trim()}
            onPress={() => void send()}
          />
        </View>
      </Screen>
    );
  }

  const showOoo = period.emailOutOfOfficeEnabled || period.widerWorldStatusEnabled;
  const resolvedPendingCircleIds = period.resolvedPendingCircleIds ?? [];
  const pendingCircles = (period.audienceCircles ?? []).filter(
    (circle) =>
      circle.circleId.startsWith(PENDING_CIRCLE_ID_PREFIX) &&
      !resolvedPendingCircleIds.includes(circle.circleId)
  );

  return (
    <Screen contentContainerStyle={styles.content}>
      <View style={styles.top}>
        <StepHeader body="Everyone's been reached." />

        {pendingCircles.map((circle) => {
          const contact = circle.contacts[0];
          if (!contact) return null;

          return (
            <View key={circle.circleId} style={styles.pendingPromptRow}>
              <Text style={styles.pendingPromptText}>
                Add {contact.name} to {circle.circleName} permanently?
              </Text>
              <View style={styles.pendingPromptActions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void discardPendingCircle(circle)}
                  style={styles.smallPill}
                >
                  <Text style={styles.smallPillText}>Not now</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void confirmPendingCircle(circle)}
                  style={styles.smallPill}
                >
                  <Text style={styles.smallPillText}>Yes</Text>
                </Pressable>
              </View>
            </View>
          );
        })}

        <Text style={styles.gatePrompt}>Want to reply to anyone properly?</Text>

        {showOoo ? (
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
                {period.emailOutOfOfficeEnabled ? (
                  emailOff ? (
                    <Text style={styles.settledText}>Out-of-office turned off.</Text>
                  ) : (
                    <Pressable accessibilityRole="button" onPress={turnOffEmail}>
                      <Text style={styles.linkText}>Turn off out-of-office</Text>
                    </Pressable>
                  )
                ) : null}

                {period.widerWorldStatusEnabled ? (
                  statusCleared ? (
                    <Text style={styles.settledText}>Status cleared.</Text>
                  ) : (
                    <Pressable accessibilityRole="button" onPress={clearStatus}>
                      <Text style={styles.linkText}>Clear my status</Text>
                    </Pressable>
                  )
                ) : null}
              </View>
            ) : null}
          </>
        ) : null}
      </View>

      <View style={styles.actions}>
        <SecondaryButton label="Personalise" onPress={goToConversations} />
        <SecondaryButton label="Not now" onPress={notNow} />
      </View>
    </Screen>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    content: {
      justifyContent: "space-between",
      gap: theme.spacing.xl
    },
    top: {
      gap: theme.spacing.lg
    },
    progressText: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: "600"
    },
    chipRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm
    },
    sendRow: {
      flexDirection: "row",
      justifyContent: "flex-end"
    },
    input: {
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
    gatePrompt: {
      color: colors.textMuted,
      fontSize: 15,
      lineHeight: 22
    },
    pendingPromptRow: {
      gap: theme.spacing.sm
    },
    pendingPromptText: {
      color: colors.text,
      fontSize: 16,
      lineHeight: 23
    },
    pendingPromptActions: {
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
    linkText: {
      color: colors.link,
      fontSize: 14,
      fontWeight: "600"
    },
    settledText: {
      color: colors.textMuted,
      fontSize: 14
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
    actions: {
      gap: theme.spacing.sm
    }
  });
}
