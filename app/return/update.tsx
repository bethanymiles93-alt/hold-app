import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { Screen } from "@/components/Screen";
import { StepHeader } from "@/components/StepHeader";
import { PrimaryButton } from "@/components/PrimaryButton";
import { AmendWithAI } from "@/components/AmendWithAI";
import { DEFAULT_TAKING_TIME_UPDATE } from "@/constants/copy";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useHoldFlow } from "@/context/HoldFlowContext";
import { sendOrShare } from "@/services/smsService";

const CONFIRMATION_DISMISS_MS = 1800;

export default function TakingTimeUpdateScreen() {
  const { audienceCircles, audienceUngrouped, updatedCircleIds, markCircleUpdated } = useHoldFlow();
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [selectedCircleIds, setSelectedCircleIds] = useState<Set<string>>(
    () => new Set(audienceCircles.map((circle) => circle.circleId))
  );
  const [message, setMessage] = useState(DEFAULT_TAKING_TIME_UPDATE);
  const [showConfirmation, setShowConfirmation] = useState(false);

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
      markCircleUpdated(circleId);
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
        <StepHeader
          title="Send an update"
          body="A short reassurance, without ending Taking Time. Send it as many times as you like."
        />

        <View style={styles.chipRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: allSelected }}
            onPress={selectAll}
            style={[styles.chip, allSelected && styles.chipSelected]}
          >
            <Text style={[styles.chipText, allSelected && styles.chipTextSelected]}>All</Text>
          </Pressable>
          {audienceCircles.map((circle) => {
            const selected = selectedCircleIds.has(circle.circleId);
            const sent = !selected && updatedCircleIds.includes(circle.circleId);

            if (sent) {
              return (
                <Pressable
                  key={circle.circleId}
                  accessibilityRole="button"
                  accessibilityLabel={`${circle.circleName}, already updated. Tap to send another update.`}
                  onPress={() => toggleCircle(circle.circleId)}
                  style={styles.chipSent}
                >
                  <Text style={styles.chipSentText}>✓ {circle.circleName}</Text>
                </Pressable>
              );
            }

            return (
              <Pressable
                key={circle.circleId}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => toggleCircle(circle.circleId)}
                style={[styles.chip, selected && styles.chipSelected]}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                  {circle.circleName}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <TextInput
          accessibilityLabel="Update message"
          multiline
          onChangeText={setMessage}
          style={styles.input}
          textAlignVertical="top"
          value={message}
        />

        <AmendWithAI surface="reassurance" currentMessage={message} onApply={setMessage} />
      </View>

      <PrimaryButton
        disabled={selectedCircleIds.size === 0 || !message.trim()}
        label="Send"
        onPress={() => void send()}
      />
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
