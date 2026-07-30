import { useCallback, useMemo, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Screen } from "@/components/Screen";
import { StepHeader } from "@/components/StepHeader";
import { SwipeableRow } from "@/components/SwipeableRow";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";
import { createGroup, deleteGroup, getGroups } from "@/services/circleService";
import type { CircleGroup } from "@/types/hold";

const SUGGESTED_GROUPS = ["Work", "Book Club"];

function memberSummary(group: CircleGroup): string {
  if (group.contacts.length === 0) return "No one added yet";
  return group.contacts.map((contact) => contact.name).join(", ");
}

export default function CircleIndexScreen() {
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [groups, setGroups] = useState<CircleGroup[]>([]);
  const [newGroupName, setNewGroupName] = useState("");

  const refresh = useCallback(async () => {
    setGroups(await getGroups());
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  const openGroup = (id: string) => {
    router.push({ pathname: "/settings/circle/detail", params: { id } });
  };

  const removeGroup = async (id: string) => {
    await deleteGroup(id);
    setGroups((current) => current.filter((group) => group.id !== id));
  };

  const addGroup = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;

    const group = await createGroup(trimmed);
    setNewGroupName("");
    openGroup(group.id);
  };

  return (
    <Screen contentContainerStyle={styles.content}>
      <StepHeader body="Saved Circles you can text directly, without retyping names each time." />

      <View style={styles.list}>
        {groups.map((group) => (
          <SwipeableRow
            key={group.id}
            disabled={group.isCloseCircle}
            onDelete={() => void removeGroup(group.id)}
          >
            <Pressable
              accessibilityRole="button"
              onPress={() => openGroup(group.id)}
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            >
              <Text style={styles.cardTitle}>{group.name}</Text>
              <Text style={styles.cardBody}>{memberSummary(group)}</Text>
            </Pressable>
          </SwipeableRow>
        ))}
      </View>

      <View style={styles.newGroup}>
        <Text style={styles.label}>New Circle</Text>

        <View style={styles.suggestionRow}>
          {SUGGESTED_GROUPS.map((name) => (
            <Pressable
              key={name}
              accessibilityRole="button"
              onPress={() => void addGroup(name)}
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
            onChangeText={setNewGroupName}
            onSubmitEditing={() => void addGroup(newGroupName)}
            placeholder="Circle name, e.g. School friends"
            placeholderTextColor={colors.textMuted}
            returnKeyType="done"
            style={styles.input}
            value={newGroupName}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Create Circle"
            disabled={!newGroupName.trim()}
            onPress={() => void addGroup(newGroupName)}
            style={({ pressed }) => [
              styles.addButton,
              pressed && styles.addPressed,
              !newGroupName.trim() && styles.disabled
            ]}
          >
            <Text style={styles.addText}>Add</Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  content: {
    gap: theme.spacing.xl
  },
  list: {
    gap: theme.spacing.md
  },
  card: {
    gap: theme.spacing.xs,
    borderRadius: theme.radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: theme.spacing.md
  },
  cardPressed: {
    backgroundColor: colors.surface
  },
  cardTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "600"
  },
  cardBody: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22
  },
  newGroup: {
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
  }
  });
}
