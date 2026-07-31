import { useCallback, useMemo, useState } from "react";
import { Link, useFocusEffect } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";
import { CirclePill } from "@/components/CirclePill";
import { getGroups } from "@/services/circleService";
import { pickContact, type PickedContact } from "@/services/contactPickerService";
import type { CircleGroup } from "@/types/hold";

const SUGGESTED_CIRCLES = ["Work", "Book Club"];

export interface PendingNewCircle {
  /** Local-only id, used to key this session's flow state — never a real circleService id. */
  tempId: string;
  circleName: string;
  contact: PickedContact;
}

interface GroupPickerProps {
  selectedGroupIds: string[];
  onToggle: (group: CircleGroup) => Promise<void>;
  /**
   * Fired when a Circle is "created" mid-flow via a picked contact — nothing
   * is written to real, persisted storage here at all (a Circle can't be
   * saved with zero contacts, so creating the empty container first isn't
   * an option either). The whole thing — name and first contact — stays a
   * local, in-memory object included in this session's send only. The
   * screen using GroupPicker is responsible for offering to make it
   * permanent afterward, creating the real Circle and adding the contact
   * as one atomic action.
   */
  onPendingContact?: (pending: PendingNewCircle) => void;
}

/**
 * Pure Circle picker — selection only. Per-person detail (include/exclude,
 * remove, personalise) lives permanently in the merged Going Quiet screen's
 * own per-Circle cards now, not behind a second expand-on-demand mechanism
 * here, so there's exactly one place that interaction happens.
 */
export function GroupPicker({ selectedGroupIds, onToggle, onPendingContact }: GroupPickerProps) {
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

  // A pending new Circle is never in `groups` (nothing's been persisted yet),
  // so it can't accidentally trip this storage-backed "empty" check.
  const emptySelectedGroups = groups.filter(
    (group) => selectedGroupIds.includes(group.id) && group.contacts.length === 0
  );

  // An empty Circle can never actually be sent to, so "All" only ever
  // gathers/releases the Circles that genuinely have someone in them —
  // otherwise a stray empty Circle (e.g. an unused Close Circle) would get
  // swept in and permanently block Send, which defeats the point of "All"
  // as a shortcut. Individually tapping an empty Circle's own pill still
  // works as before, surfacing the "doesn't have anyone in it yet" prompt.
  const nonEmptyGroups = groups.filter((group) => group.contacts.length > 0);
  const allSelected =
    nonEmptyGroups.length > 0 && nonEmptyGroups.every((group) => selectedGroupIds.includes(group.id));

  const toggleAll = async () => {
    for (const group of nonEmptyGroups) {
      if (allSelected === selectedGroupIds.includes(group.id)) {
        await onToggle(group);
      }
    }
  };

  const addCircle = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;

    const picked = await pickContact();
    if (!picked) {
      // A Circle can't be created or saved with zero contacts — without a
      // contact there's nothing valid to create, staged or otherwise.
      return;
    }

    const tempId = `pending-${Date.now()}`;
    const pendingCircle: CircleGroup = {
      id: tempId,
      name: trimmed,
      isCloseCircle: false,
      contacts: [{ id: `${tempId}-contact`, name: picked.name, phoneNumber: picked.phoneNumber }]
    };

    setNewCircleName("");
    setCreating(false);
    onPendingContact?.({ tempId, circleName: trimmed, contact: picked });
    await onToggle(pendingCircle);
  };

  return (
    <View style={styles.container}>
      <View style={styles.pinnedRow}>
        {groups.length > 0 ? (
          <CirclePill label="All" selected={allSelected} onPress={() => void toggleAll()} />
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: creating }}
          onPress={() => setCreating((current) => !current)}
          style={({ pressed }) => [styles.newCirclePill, pressed && styles.newCirclePillPressed]}
        >
          <Text style={styles.newCirclePillText}>+ New Circle</Text>
        </Pressable>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pillWrap}
          style={styles.pillScroll}
        >
          {groups.map((group) => (
            <CirclePill
              key={group.id}
              label={group.name}
              selected={selectedGroupIds.includes(group.id)}
              isPrimary={group.isCloseCircle}
              onPress={() => void onToggle(group)}
            />
          ))}
        </ScrollView>
      </View>

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
      ) : null}

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
    // "All" and "+ New Circle" are fixed, non-scrolling members of this row;
    // only the named-Circle pills inside the nested ScrollView scroll, so the
    // whole thing still reads as one continuous line.
    pinnedRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm
    },
    pillScroll: {
      flex: 1
    },
    pillWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm
    },
    prompt: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 21
    },
    newCirclePill: {
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
