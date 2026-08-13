import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";
import {
  addSuggestedPhrase,
  editSuggestedPhrase,
  getSuggestedPhrases,
  removeSuggestedPhrase
} from "@/services/suggestedPhrasesService";

/**
 * "Suggested phrases" section of Library's Templates tab (2026-08-13) —
 * lets the person view/add/remove/amend the wording of their own
 * sentence-pill set (the same phrases DockedInputBar/DockedFieldPreview
 * offer as tappable pills app-wide). Deliberately self-contained (its own
 * local edit state, a plain TextInput, not wired into library.tsx's own
 * activeField/DockedFieldPreview dispatch) — that dispatch is a large,
 * actively-changing part of this screen, and this editor's own needs
 * (inline add/edit/remove for a flat string list) don't need it. See
 * docs/09-decision-log.md.
 */
export function SuggestedPhrasesEditor() {
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [phrases, setPhrases] = useState<string[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [newPhraseDraft, setNewPhraseDraft] = useState("");

  useEffect(() => {
    void getSuggestedPhrases().then(setPhrases);
  }, []);

  const startEditing = (index: number) => {
    setEditingIndex(index);
    setDraft(phrases[index] ?? "");
  };

  const commitEdit = async () => {
    if (editingIndex === null) return;
    const oldPhrase = phrases[editingIndex];
    if (oldPhrase === undefined) return;

    const next = await editSuggestedPhrase(oldPhrase, draft);
    setPhrases(next);
    setEditingIndex(null);
    setDraft("");
  };

  const remove = async (phrase: string) => {
    const next = await removeSuggestedPhrase(phrase);
    setPhrases(next);
  };

  const addPhrase = async () => {
    if (!newPhraseDraft.trim()) return;
    const next = await addSuggestedPhrase(newPhraseDraft);
    setPhrases(next);
    setNewPhraseDraft("");
  };

  return (
    <View style={styles.list}>
      {phrases.map((phrase, index) => (
        <View key={phrase} style={styles.row}>
          {editingIndex === index ? (
            <TextInput
              autoFocus
              value={draft}
              onChangeText={setDraft}
              onBlur={() => void commitEdit()}
              onSubmitEditing={() => void commitEdit()}
              style={styles.editInput}
            />
          ) : (
            <Pressable accessibilityRole="button" onPress={() => startEditing(index)} style={styles.phraseTouch}>
              <Text style={styles.phraseText}>{phrase}</Text>
            </Pressable>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove "${phrase}"`}
            onPress={() => void remove(phrase)}
            hitSlop={8}
          >
            <Text style={styles.removeText}>✕</Text>
          </Pressable>
        </View>
      ))}

      <View style={styles.row}>
        <TextInput
          value={newPhraseDraft}
          onChangeText={setNewPhraseDraft}
          onSubmitEditing={() => void addPhrase()}
          placeholder="Add a phrase"
          placeholderTextColor={colors.textMuted}
          style={styles.editInput}
        />
        <Pressable accessibilityRole="button" accessibilityLabel="Add phrase" onPress={() => void addPhrase()} hitSlop={8}>
          <Text style={styles.addText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    list: {
      gap: theme.spacing.sm
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm
    },
    phraseTouch: {
      flex: 1,
      minHeight: 44,
      justifyContent: "center"
    },
    // fontSize 17 — the app-wide established body/accessible text size,
    // matching DockedFieldPreview's own valueText, not a smaller size.
    phraseText: {
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
    }
  });
}
