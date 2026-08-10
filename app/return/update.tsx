import { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Screen } from "@/components/Screen";
import { StepHeader } from "@/components/StepHeader";
import { CompactSendButton } from "@/components/CompactSendButton";
import { AmendWithAI } from "@/components/AmendWithAI";
import { AdaptiveCircleChip } from "@/components/AdaptiveCircleChip";
import { MemoryNoteSuggestion } from "@/components/MemoryNoteSuggestion";
import { DEFAULT_TAKING_TIME_UPDATE } from "@/constants/copy";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useHoldFlow } from "@/context/HoldFlowContext";
import { getOpenHoldPeriod, markUpdateSent } from "@/services/holdHistoryService";
import { sendOrShare } from "@/services/smsService";
import type { HoldPeriod } from "@/types/hold";

const CONFIRMATION_DISMISS_MS = 1800;

export default function TakingTimeUpdateScreen() {
  const { audienceCircles, audienceUngrouped } = useHoldFlow();
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [selectedCircleIds, setSelectedCircleIds] = useState<Set<string>>(
    () => new Set(audienceCircles.map((circle) => circle.circleId))
  );
  const [message, setMessage] = useState(DEFAULT_TAKING_TIME_UPDATE);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [suggestedPrompt, setSuggestedPrompt] = useState<string | undefined>(undefined);
  // Durable, on the still-open Hold period — see holdHistoryService.ts's
  // markUpdateSent — so this survives a force-quit the same way Reconnect's
  // reconnectContactedIds already did, rather than living only in
  // HoldFlowContext (in-memory, lost on relaunch).
  const [period, setPeriod] = useState<HoldPeriod | null>(null);
  const sentCircleIds = period?.updateSentCircleIds ?? [];

  const refreshPeriod = useCallback(async () => {
    setPeriod(await getOpenHoldPeriod());
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshPeriod();
    }, [refreshPeriod])
  );

  useEffect(() => {
    if (!showConfirmation) return;
    const timeout = setTimeout(() => router.replace("/"), CONFIRMATION_DISMISS_MS);
    return () => clearTimeout(timeout);
  }, [showConfirmation]);

  const allSelected = audienceCircles.length > 0 && selectedCircleIds.size === audienceCircles.length;

  const selectAll = () => {
    setSelectedCircleIds(
      allSelected ? new Set() : new Set(audienceCircles.map((circle) => circle.circleId))
    );
  };

  const toggleCircle = (circleId: string) => {
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

  const send = async () => {
    const selectedCircles = audienceCircles.filter((circle) => selectedCircleIds.has(circle.circleId));
    const numbers = selectedCircles
      .flatMap((circle) => circle.contacts)
      .map((contact) => contact.phoneNumber);

    // Ungrouped contacts have no pill of their own — only bundled in when
    // literally every Circle is selected, matching what "All" means to send.
    if (allSelected) {
      numbers.push(...audienceUngrouped.map((contact) => contact.phoneNumber));
    }

    try {
      await sendOrShare(numbers, message.trim());
    } catch {
      // The compose sheet closing is the only signal available either way.
    }

    for (const circleId of selectedCircleIds) {
      await markUpdateSent(circleId);
    }

    setSelectedCircleIds(new Set());
    setShowConfirmation(true);
  };

  if (showConfirmation) {
    return (
      <Screen contentContainerStyle={styles.confirmationContent}>
        <Text style={styles.confirmationText}>
          You've updated the people you need to. Well done.
        </Text>
      </Screen>
    );
  }

  return (
    <Screen contentContainerStyle={styles.content}>
      <View style={styles.top}>
        <StepHeader body="A short reassurance, without ending Taking Time. Send it as many times as you like." />

        <MemoryNoteSuggestion onUseIt={setSuggestedPrompt} />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          <AdaptiveCircleChip label="All" isSelected={allSelected} onPress={selectAll} accessibilityRole="button" />
          {audienceCircles.map((circle) => {
            const isSelected = selectedCircleIds.has(circle.circleId);
            const hasSentThisSession = sentCircleIds.includes(circle.circleId);
            const sentLook = hasSentThisSession && !isSelected;

            return (
              <AdaptiveCircleChip
                key={circle.circleId}
                label={sentLook ? `✓ ${circle.circleName}` : circle.circleName}
                isSelected={isSelected}
                hasSentThisSession={hasSentThisSession}
                onPress={() => toggleCircle(circle.circleId)}
                accessibilityRole="button"
                accessibilityLabel={
                  sentLook
                    ? `${circle.circleName}, already updated. Tap to send another update.`
                    : circle.circleName
                }
              />
            );
          })}
        </ScrollView>

        <TextInput
          accessibilityLabel="Update message"
          multiline
          onChangeText={setMessage}
          style={styles.input}
          textAlignVertical="top"
          value={message}
        />

        <AmendWithAI
          surface="reassurance"
          currentMessage={message}
          onApply={setMessage}
          initialPrompt={suggestedPrompt}
        />
      </View>

      <View style={styles.sendRow}>
        <CompactSendButton
          disabled={selectedCircleIds.size === 0 || !message.trim()}
          onPress={() => void send()}
        />
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
    sendRow: {
      flexDirection: "row",
      justifyContent: "flex-end"
    },
    chipRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm
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
    confirmationContent: {
      flexGrow: 1,
      alignItems: "center",
      justifyContent: "center"
    },
    confirmationText: {
      color: colors.text,
      fontSize: 17,
      fontWeight: "600",
      lineHeight: 24,
      textAlign: "center"
    }
  });
}
