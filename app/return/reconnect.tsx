import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Screen } from "@/components/Screen";
import { StepHeader } from "@/components/StepHeader";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SecondaryButton } from "@/components/SecondaryButton";
import { AmendWithAI } from "@/components/AmendWithAI";
import { MemoryNoteSuggestion } from "@/components/MemoryNoteSuggestion";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";
import { QUICK_RECONNECT_MESSAGES } from "@/constants/copy";
import {
  getReconnectCoverage,
  getReconnectingPeriod,
  markReconnectContacted,
  recordSendChannel
} from "@/services/holdHistoryService";
import { getAll as getAllConversationPeople, markQuickSent } from "@/services/conversationService";
import { deactivateOutOfOffice } from "@/services/emailAccountService";
import { channelKey, sendOrShare } from "@/services/smsService";
import { clearDraft, getDraft, saveDraft } from "@/services/messageDraftService";
import type { HoldPeriod } from "@/types/hold";

const RECONNECT_DRAFT_KEY = "reconnect";

export default function ReconnectScreen() {
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [period, setPeriod] = useState<HoldPeriod | null>(null);
  const [message, setMessage] = useState(QUICK_RECONNECT_MESSAGES[0]?.text ?? "");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [emailOff, setEmailOff] = useState(false);
  const [statusCleared, setStatusCleared] = useState(false);
  const [suggestedPrompt, setSuggestedPrompt] = useState<string | undefined>(undefined);

  const refresh = useCallback(async () => {
    const current = await getReconnectingPeriod();
    setPeriod(current);

    if (current) {
      const coverage = getReconnectCoverage(current);
      setSelectedIds(new Set(coverage.totalIds.filter((id) => !coverage.contactedIds.includes(id))));
    }
  }, []);

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
      await markQuickSent(matchedIds);
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

          <View style={styles.chipRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: allSelected }}
              onPress={toggleAll}
              style={[styles.chip, allSelected && styles.chipSelected]}
            >
              <Text style={[styles.chipText, allSelected && styles.chipTextSelected]}>All</Text>
            </Pressable>

            {circlePills.map((circle) => {
              const selected = selectedIds.has(circle.circleId);
              const contacted = !selected && coverage.contactedIds.includes(circle.circleId);

              return contacted ? (
                <Pressable
                  key={circle.circleId}
                  accessibilityRole="button"
                  accessibilityLabel={`${circle.circleName}, already reached. Tap to send another message.`}
                  onPress={() => toggleId(circle.circleId)}
                  style={styles.chipSent}
                >
                  <Text style={styles.chipSentText}>✓ {circle.circleName}</Text>
                </Pressable>
              ) : (
                <Pressable
                  key={circle.circleId}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => toggleId(circle.circleId)}
                  style={[styles.chip, selected && styles.chipSelected]}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                    {circle.circleName}
                  </Text>
                </Pressable>
              );
            })}

            {ungroupedPills.map((contact) => {
              const selected = selectedIds.has(contact.phoneNumber);
              const contacted = !selected && coverage.contactedIds.includes(contact.phoneNumber);

              return contacted ? (
                <Pressable
                  key={contact.phoneNumber}
                  accessibilityRole="button"
                  accessibilityLabel={`${contact.name}, already reached. Tap to send another message.`}
                  onPress={() => toggleId(contact.phoneNumber)}
                  style={styles.chipSent}
                >
                  <Text style={styles.chipSentText}>✓ {contact.name}</Text>
                </Pressable>
              ) : (
                <Pressable
                  key={contact.phoneNumber}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => toggleId(contact.phoneNumber)}
                  style={[styles.chip, selected && styles.chipSelected]}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                    {contact.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>

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

        <PrimaryButton
          disabled={selectedIds.size === 0 || !message.trim()}
          label="Send"
          onPress={() => void send()}
        />
      </Screen>
    );
  }

  return (
    <Screen contentContainerStyle={styles.content}>
      <View style={styles.top}>
        <StepHeader body="Everyone's been reached." />

        <Text style={styles.gatePrompt}>Want to reply to anyone properly?</Text>

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
      flexWrap: "wrap",
      gap: theme.spacing.sm
    },
    chip: {
      minHeight: 36,
      borderRadius: theme.radius.pill,
      borderWidth: 1.5,
      borderColor: colors.border,
      paddingHorizontal: theme.spacing.md,
      alignItems: "center",
      justifyContent: "center"
    },
    chipSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary
    },
    chipText: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "600"
    },
    chipTextSelected: {
      color: colors.onPrimary
    },
    chipSent: {
      minHeight: 36,
      borderRadius: theme.radius.pill,
      paddingHorizontal: theme.spacing.md,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceStrong
    },
    chipSentText: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: "600"
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
    linkText: {
      color: colors.link,
      fontSize: 14,
      fontWeight: "600"
    },
    settledText: {
      color: colors.textMuted,
      fontSize: 14
    },
    actions: {
      gap: theme.spacing.sm
    }
  });
}
