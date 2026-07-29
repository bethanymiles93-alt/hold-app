import { useMemo, useState } from "react";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Screen } from "@/components/Screen";
import { StepHeader } from "@/components/StepHeader";
import { GroupPicker } from "@/components/GroupPicker";
import { ChoiceCard } from "@/components/ChoiceCard";
import { KEYBOARD_DONE_ACCESSORY_ID } from "@/components/KeyboardDoneAccessory";
import { PrimaryButton } from "@/components/PrimaryButton";
import { HOLD_INTENTS } from "@/constants/copy";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useHoldFlow } from "@/context/HoldFlowContext";
import { createDraft } from "@/services/draftService";
import type { HoldIntent } from "@/types/hold";

export default function HoldPeopleScreen() {
  const {
    selectedGroups,
    toggleGroup,
    circleDrafts,
    setCircleDraftIntent,
    setCircleDraftMessage,
    saveCircleDraftAsDefault
  } = useHoldFlow();
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [showingChipsFor, setShowingChipsFor] = useState<Set<string>>(new Set());

  const canContinue =
    selectedGroups.length > 0 &&
    selectedGroups.every((group) => group.contacts.length > 0) &&
    circleDrafts.length > 0 &&
    circleDrafts.every((draft) => draft.message.trim().length > 0);

  const chooseIntent = async (circleId: string, choice: HoldIntent) => {
    setCircleDraftIntent(circleId, choice);
    const recipients =
      selectedGroups.find((group) => group.id === circleId)?.contacts.map((contact) => contact.name) ?? [];
    const draftText = await createDraft({ mode: "hold", recipients, intent: choice });
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

  return (
    <Screen contentContainerStyle={styles.content}>
      <View style={styles.top}>
        <StepHeader
          eyebrow="Step 1 of 2"
          title="Who needs to know?"
          body="Choose one or more Circles, then pick what they need to understand."
        />
        <GroupPicker
          selectedGroupIds={selectedGroups.map((group) => group.id)}
          onToggle={toggleGroup}
        />

        {circleDrafts.map((draft) => {
          const showChips =
            showingChipsFor.has(draft.circleId) || (draft.savedMessage === null && !draft.message.trim());
          const isSaved = draft.savedMessage !== null && draft.message === draft.savedMessage;

          return (
            <View key={draft.circleId} style={styles.circleSection}>
              <Text style={styles.sectionLabel}>{draft.circleName}</Text>

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
                <View style={styles.messageBlock}>
                  <TextInput
                    accessibilityLabel={`Message for ${draft.circleName}`}
                    inputAccessoryViewID={KEYBOARD_DONE_ACCESSORY_ID}
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
                  <Text style={styles.helper}>
                    This becomes your usual message for {draft.circleName}. Edit it anytime in Library.
                  </Text>
                </View>
              )}
            </View>
          );
        })}
      </View>

      <PrimaryButton
        disabled={!canContinue}
        label="Review message"
        onPress={() => router.push("/create/review")}
      />
    </Screen>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    content: {
      justifyContent: "space-between",
      gap: theme.spacing.md,
      paddingTop: theme.spacing.md,
      paddingBottom: theme.spacing.md
    },
    top: {
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
      minHeight: 120,
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
    helper: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 19
    }
  });
}
