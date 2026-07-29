import { useCallback, useMemo, useState } from "react";
import { Link, useFocusEffect } from "expo-router";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useHoldFlow } from "@/context/HoldFlowContext";
import { addContactToGroup, createGroup, getGroups } from "@/services/circleService";
import { pickContact } from "@/services/contactPickerService";
import { RecipientPersonalisation } from "@/components/RecipientPersonalisation";
import type { CircleGroup } from "@/types/hold";

const SUGGESTED_CIRCLES = ["Work", "Book Club"];

interface GroupPickerProps {
  selectedGroupIds: string[];
  onToggle: (group: CircleGroup) => Promise<void>;
}

export function GroupPicker({ selectedGroupIds, onToggle }: GroupPickerProps) {
  const {
    goingQuietRecipients,
    toggleRecipientIncluded,
    setRecipientPersonalisedMessage,
    circleDrafts
  } = useHoldFlow();
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [groups, setGroups] = useState<CircleGroup[]>([]);
  const [creating, setCreating] = useState(false);
  const [newCircleName, setNewCircleName] = useState("");
  const [expandedCircleId, setExpandedCircleId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setGroups(await getGroups());
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  const emptySelectedGroups = groups.filter(
    (group) => selectedGroupIds.includes(group.id) && group.contacts.length === 0
  );

  const addCircle = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;

    let circle = await createGroup(trimmed);

    const picked = await pickContact();
    if (picked) {
      circle = (await addContactToGroup(circle.id, picked)) ?? circle;
    }

    setNewCircleName("");
    setCreating(false);
    await refresh();
    await onToggle(circle);
  };

  const toggleExpanded = (groupId: string) => {
    setExpandedCircleId((current) => (current === groupId ? null : groupId));
  };

  const expandedRecipients = expandedCircleId
    ? goingQuietRecipients.filter((recipient) => recipient.circleId === expandedCircleId)
    : [];

  return (
    <View style={styles.container}>
      <View style={styles.pillWrap}>
        {groups.map((group) => {
          const selected = selectedGroupIds.includes(group.id);
          return (
            <View key={group.id} style={styles.pillGroup}>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
                onPress={() => void onToggle(group)}
                style={[
                  styles.pill,
                  group.isCloseCircle ? styles.pillPrimary : styles.pillSecondary,
                  selected && styles.pillSelected
                ]}
              >
                <Text
                  style={[
                    styles.pillText,
                    group.isCloseCircle ? styles.pillTextPrimary : styles.pillTextSecondary
                  ]}
                >
                  {group.name}
                </Text>
              </Pressable>

              {selected ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${expandedCircleId === group.id ? "Hide" : "Show"} people in ${group.name}`}
                  onPress={() => toggleExpanded(group.id)}
                  style={styles.expandButton}
                >
                  <Text style={styles.expandButtonText}>
                    {expandedCircleId === group.id ? "▲" : "▼"}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          );
        })}
      </View>

      {expandedCircleId && expandedRecipients.length > 0 ? (
        <RecipientPersonalisation
          recipients={expandedRecipients}
          onToggleIncluded={toggleRecipientIncluded}
          onChangePersonalisedMessage={setRecipientPersonalisedMessage}
          defaultMessage={
            circleDrafts.find((draft) => draft.circleId === expandedCircleId)?.message ?? ""
          }
        />
      ) : null}

      {emptySelectedGroups.length > 0 ? (
        <Text style={styles.prompt}>
          {emptySelectedGroups.map((group) => group.name).join(", ")} doesn't have anyone in it
          yet. Add someone from Your Circles in Settings before continuing.
        </Text>
      ) : null}

      {creating ? (
        <View style={styles.newCircle}>
          <Text style={styles.label}>New Circle</Text>

          <View style={styles.suggestionRow}>
            {SUGGESTED_CIRCLES.map((name) => (
              <Pressable
                key={name}
                accessibilityRole="button"
                onPress={() => void addCircle(name)}
                style={({ pressed }) => [styles.suggestionChip, pressed && styles.suggestionPressed]}
              >
                <Text style={styles.suggestionText}>+ {name}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.inputRow}>
            <TextInput
              accessibilityLabel="New Circle name"
              autoCapitalize="words"
              onChangeText={setNewCircleName}
              onSubmitEditing={() => void addCircle(newCircleName)}
              placeholder="Circle name, e.g. Book Club"
              placeholderTextColor={colors.textMuted}
              returnKeyType="done"
              style={styles.input}
              value={newCircleName}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Create Circle"
              disabled={!newCircleName.trim()}
              onPress={() => void addCircle(newCircleName)}
              style={({ pressed }) => [
                styles.addButton,
                pressed && styles.addPressed,
                !newCircleName.trim() && styles.disabled
              ]}
            >
              <Text style={styles.addText}>Add</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          onPress={() => setCreating(true)}
          style={({ pressed }) => [styles.newCirclePill, pressed && styles.newCirclePillPressed]}
        >
          <Text style={styles.newCirclePillText}>+ New Circle</Text>
        </Pressable>
      )}

      <Link href="/settings/circle" asChild>
        <Pressable accessibilityRole="link" style={styles.manageLink}>
          <Text style={styles.manageLinkText}>Manage your Circles</Text>
        </Pressable>
      </Link>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      gap: theme.spacing.md
    },
    pillWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.sm
    },
    pillGroup: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4
    },
    pill: {
      minHeight: 38,
      borderRadius: theme.radius.pill,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: theme.spacing.md
    },
    pillPrimary: {
      backgroundColor: colors.primary
    },
    pillSecondary: {
      backgroundColor: colors.surfaceStrong
    },
    pillSelected: {
      borderWidth: 2,
      borderColor: colors.text
    },
    pillText: {
      fontSize: 14,
      fontWeight: "600"
    },
    pillTextPrimary: {
      color: colors.onPrimary
    },
    pillTextSecondary: {
      color: colors.primary
    },
    expandButton: {
      width: 28,
      height: 28,
      borderRadius: theme.radius.pill,
      borderWidth: 1.5,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center"
    },
    expandButtonText: {
      color: colors.textMuted,
      fontSize: 10
    },
    prompt: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 21
    },
    newCirclePill: {
      alignSelf: "flex-start",
      minHeight: 38,
      borderRadius: theme.radius.pill,
      borderWidth: 1.5,
      borderColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: theme.spacing.md
    },
    newCirclePillPressed: {
      backgroundColor: colors.surface
    },
    newCirclePillText: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: "600"
    },
    newCircle: {
      gap: theme.spacing.sm
    },
    label: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: "600"
    },
    suggestionRow: {
      flexDirection: "row",
      gap: theme.spacing.sm
    },
    suggestionChip: {
      minHeight: 40,
      justifyContent: "center",
      borderRadius: theme.radius.pill,
      backgroundColor: colors.surfaceStrong,
      paddingHorizontal: theme.spacing.md
    },
    suggestionPressed: {
      opacity: 0.7
    },
    suggestionText: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "500"
    },
    inputRow: {
      flexDirection: "row",
      gap: theme.spacing.sm
    },
    input: {
      flex: 1,
      minHeight: 54,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: theme.radius.md,
      paddingHorizontal: theme.spacing.md,
      color: colors.text,
      fontSize: 17,
      backgroundColor: colors.white
    },
    addButton: {
      minWidth: 72,
      minHeight: 54,
      borderRadius: theme.radius.md,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center"
    },
    addPressed: {
      backgroundColor: colors.primaryPressed
    },
    disabled: {
      opacity: 0.4
    },
    addText: {
      color: colors.onPrimary,
      fontSize: 16,
      fontWeight: "600"
    },
    manageLink: {
      minHeight: 44,
      justifyContent: "center"
    },
    manageLinkText: {
      color: colors.primary,
      fontSize: 15,
      fontWeight: "600"
    }
  });
}
