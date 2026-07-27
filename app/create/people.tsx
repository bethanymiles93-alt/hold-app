import { useState } from "react";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Screen } from "@/components/Screen";
import { StepHeader } from "@/components/StepHeader";
import { GroupPicker } from "@/components/GroupPicker";
import { ChoiceCard } from "@/components/ChoiceCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { HOLD_INTENTS } from "@/constants/copy";
import { theme } from "@/constants/theme";
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
          compact
          eyebrow="Step 1 of 2"
          title="Who needs to know?"
          body="Choose one or more Circles, then pick what they need to understand."
        />
        <GroupPicker
          selectedGroupIds={selectedGroups.map((group) => group.id)}
          onToggle={toggleGroup}
        />

        {circleDrafts.map((draft) => {
          const showChips = showingChipsFor.has(draft.circleId) || (!draft.hasSavedDefault && !draft.message.trim());

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
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => void saveCircleDraftAsDefault(draft.circleId)}
                    >
                      <Text style={styles.linkText}>Save to Library</Text>
                    </Pressable>
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

const styles = StyleSheet.create({
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
    color: theme.colors.text,
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
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    color: theme.colors.text,
    fontSize: 18,
    lineHeight: 28,
    backgroundColor: theme.colors.white
  },
  messageControls: {
    flexDirection: "row",
    gap: theme.spacing.lg
  },
  linkText: {
    color: theme.colors.link,
    fontSize: 14,
    fontWeight: "600"
  },
  helper: {
    color: theme.colors.textMuted,
    fontSize: 13,
    lineHeight: 19
  }
});
