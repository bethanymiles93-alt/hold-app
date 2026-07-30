import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";
import { SecondaryButton } from "@/components/SecondaryButton";
import { deleteMemoryNote, getSuggestedNote, markNoteUsed, type MemoryNote } from "@/services/aiMemoryService";

interface MemoryNoteSuggestionProps {
  /** Called with the note's text when the user taps "Use it" — feed straight into AmendWithAI's initialPrompt. */
  onUseIt: (text: string) => void;
}

/**
 * Surfaces the single oldest not-yet-used AI memory note, if any (Layer 1
 * must be on — see aiMemoryService). A calmer-moment suggestion, never an
 * in-the-moment interruption during Going Quiet: only rendered on Taking
 * Time's update and Reconnect. "Don't remember" deletes the note outright.
 */
export function MemoryNoteSuggestion({ onUseIt }: MemoryNoteSuggestionProps) {
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [note, setNote] = useState<MemoryNote | null>(null);

  useFocusEffect(
    useCallback(() => {
      void getSuggestedNote().then(setNote);
    }, [])
  );

  if (!note) return null;

  const useIt = () => {
    void markNoteUsed(note.id);
    onUseIt(note.text);
    setNote(null);
  };

  const dontRemember = () => {
    void deleteMemoryNote(note.id);
    setNote(null);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>You mentioned, last time</Text>
      <Text style={styles.text}>{note.text}</Text>
      <View style={styles.actions}>
        <SecondaryButton label="Use it" onPress={useIt} />
        <Pressable accessibilityRole="button" onPress={dontRemember}>
          <Text style={styles.dismissText}>Don't remember</Text>
        </Pressable>
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      gap: theme.spacing.xs,
      padding: theme.spacing.md,
      borderRadius: theme.radius.md,
      backgroundColor: colors.surfaceStrong
    },
    label: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 0.3
    },
    text: {
      color: colors.text,
      fontSize: 15,
      lineHeight: 21
    },
    actions: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
      marginTop: theme.spacing.xs
    },
    dismissText: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: "600"
    }
  });
}
