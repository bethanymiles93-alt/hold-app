import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Screen } from "@/components/Screen";
import { StepHeader } from "@/components/StepHeader";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";
import {
  addWiderWorldPlatform,
  getWiderWorldPlatforms,
  removeWiderWorldPlatform,
  renameWiderWorldPlatform
} from "@/services/widerWorldSettingsService";
import type { WiderWorldPlatform } from "@/types/hold";

/**
 * "Your Wider World" — the platform list Going Quiet's "Where did you post
 * this?" step and Reconnect's own taken-down checklist both read from.
 * Deliberately no built-in default list (Instagram/WhatsApp/etc. aren't
 * hardcoded anywhere) — nothing configured here means neither of those
 * screens shows any pills at all, rather than guessing at platforms the
 * person may not even use. Same simple add/rename/remove list pattern as
 * Library's own SuggestedPhrasesEditor, a genuinely equivalent piece of UI
 * (a short flat list of user-owned text), not reimplemented from scratch.
 * See docs/09-decision-log.md, 2026-08-21.
 */
export default function WiderWorldSettingsScreen() {
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [platforms, setPlatforms] = useState<WiderWorldPlatform[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [newPlatformDraft, setNewPlatformDraft] = useState("");

  useEffect(() => {
    void getWiderWorldPlatforms().then(setPlatforms);
  }, []);

  const startEditing = (platform: WiderWorldPlatform) => {
    setEditingId(platform.id);
    setDraft(platform.name);
  };

  const commitEdit = async () => {
    if (!editingId) return;
    if (!draft.trim()) {
      setEditingId(null);
      return;
    }

    const next = await renameWiderWorldPlatform(editingId, draft);
    setPlatforms(next);
    setEditingId(null);
    setDraft("");
  };

  const remove = async (id: string) => {
    const next = await removeWiderWorldPlatform(id);
    setPlatforms(next);
  };

  const addPlatform = async () => {
    if (!newPlatformDraft.trim()) return;
    const next = await addWiderWorldPlatform(newPlatformDraft);
    setPlatforms(next);
    setNewPlatformDraft("");
  };

  return (
    <Screen>
      <StepHeader body="Which platforms should show up as options when you post a status update — at Going Quiet's 'Where did you post this?' step, and on Reconnect's own take-down checklist." />

      <View style={styles.list}>
        {platforms.map((platform) => (
          <View key={platform.id} style={styles.row}>
            {editingId === platform.id ? (
              <TextInput
                autoFocus
                value={draft}
                onChangeText={setDraft}
                onBlur={() => void commitEdit()}
                onSubmitEditing={() => void commitEdit()}
                style={styles.editInput}
              />
            ) : (
              <Pressable accessibilityRole="button" onPress={() => startEditing(platform)} style={styles.platformTouch}>
                <Text style={styles.platformText}>{platform.name}</Text>
              </Pressable>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove ${platform.name}`}
              onPress={() => void remove(platform.id)}
              hitSlop={8}
            >
              <Text style={styles.removeText}>✕</Text>
            </Pressable>
          </View>
        ))}

        <View style={styles.row}>
          <TextInput
            value={newPlatformDraft}
            onChangeText={setNewPlatformDraft}
            onSubmitEditing={() => void addPlatform()}
            placeholder="Add a platform, e.g. Instagram"
            placeholderTextColor={colors.textMuted}
            style={styles.editInput}
          />
          <Pressable accessibilityRole="button" accessibilityLabel="Add platform" onPress={() => void addPlatform()} hitSlop={8}>
            <Text style={styles.addText}>+</Text>
          </Pressable>
        </View>

        {platforms.length === 0 ? (
          <Text style={styles.empty}>
            Nothing added yet — the status step won't offer any platform pills until you add some
            here.
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    list: {
      marginTop: theme.spacing.xl,
      gap: theme.spacing.sm
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm
    },
    platformTouch: {
      flex: 1,
      minHeight: 44,
      justifyContent: "center"
    },
    platformText: {
      color: colors.text,
      fontSize: 17
    },
    editInput: {
      flex: 1,
      minHeight: 44,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: theme.radius.md,
      paddingHorizontal: theme.spacing.sm,
      color: colors.text,
      fontSize: 17,
      backgroundColor: colors.surface
    },
    removeText: {
      color: colors.textMuted,
      fontSize: 17
    },
    addText: {
      color: colors.primary,
      fontSize: 22,
      fontWeight: "700"
    },
    empty: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 20
    }
  });
}
