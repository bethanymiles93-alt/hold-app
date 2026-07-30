import { useCallback, useMemo, useState } from "react";
import { Link, useFocusEffect } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";
import { addContactToGroup, createGroup, getGroups } from "@/services/circleService";
import { pickContact } from "@/services/contactPickerService";
import type { CircleGroup } from "@/types/hold";

const SUGGESTED_CIRCLES = ["Work", "Book Club"];

interface GroupPickerProps {
  selectedGroupIds: string[];
  onToggle: (group: CircleGroup) => Promise<void>;
}

/**
 * Pure Circle picker — selection only. Per-person detail (include/exclude,
 * remove, personalise) lives permanently in the merged Going Quiet screen's
 * own per-Circle cards now, not behind a second expand-on-demand mechanism
 * here, so there's exactly one place that interaction happens.
 */
export function GroupPicker({ selectedGroupIds, onToggle }: GroupPickerProps) {
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [groups, setGroups] = useState<CircleGroup[]>([]);
  const [creating, setCreating] = useState(false);
  const [newCircleName, setNewCircleName] = useState("");

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

  const allSelected = groups.length > 0 && groups.every((group) => selectedGroupIds.includes(group.id));

  const toggleAll = async () => {
    for (const group of groups) {
      if (allSelected === selectedGroupIds.includes(group.id)) {
        await onToggle(group);
      }
    }
  };

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

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pillWrap}
      >
        {groups.length > 0 ? (
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: allSelected }}
            onPress={() => void toggleAll()}
            style={[styles.pill, styles.pillSecondary, allSelected && styles.pillSelected]}
          >
            <Text style={[styles.pillText, styles.pillTextSecondary]}>All</Text>
          </Pressable>
        ) : null}
        {groups.map((group) => {
          const selected = selectedGroupIds.includes(group.id);
          return (
            <Pressable
              key={group.id}
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
          );
        })}
      </ScrollView>

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
      gap: theme.spacing.sm
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
      backgroundColor: colors.surface
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
