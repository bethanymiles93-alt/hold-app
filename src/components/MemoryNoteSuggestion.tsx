import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";
import { SecondaryButton } from "@/components/SecondaryButton";
import { deleteMemoryNote, getSuggestedNote, markNoteUsed, type MemoryNote } from "@/services/aiMemoryService";

interface MemoryNoteSuggestionProps {
  /**
   * Inserts the note's text as a highlighted, revert-on-edit block into
   * whichever compose box is currently active — the same mechanic
   * Template's own insert uses (see DockedInputBar's `pendingInsert` prop),
   * not a silently pre-filled AI-amend prompt. **Corrected 2026-08-21**: a
   * memory note can be weeks stale (e.g. a capacity note that's no longer
   * accurate), so it must never load as the box's raw starting content or
   * an unreviewed AI prompt — same "tap-to-insert-only" principle Template
   * already follows. Only reachable once the person has explicitly
   * expanded and read the note first, not from the collapsed state.
   */
  onUseIt: (text: string) => void;
}

/**
 * Surfaces the single oldest not-yet-used AI memory note, if any (Layer 1
 * must be on — see aiMemoryService). A calmer-moment suggestion, never an
 * in-the-moment interruption during Going Quiet: only rendered on
 * Reconnect. Collapsed by default — the note's own text stays hidden until
 * a manual tap on the down-arrow, never auto-shown; "Use it"/"Don't
 * remember" only appear once expanded, so nothing here can be acted on
 * without first being read. See docs/09-decision-log.md, 2026-08-21.
 */
export function MemoryNoteSuggestion({ onUseIt }: MemoryNoteSuggestionProps) {
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [note, setNote] = useState<MemoryNote | null>(null);
  const [expanded, setExpanded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void getSuggestedNote().then(setNote);
      // A fresh visit starts collapsed again, even if a previous visit left
      // it open — re-reading isn't free just because it was read before.
      setExpanded(false);
    }, [])
  );

  if (!note) return null;

  const useIt = () => {
    void markNoteUsed(note.id);
    onUseIt(note.text);
    setNote(null);
    setExpanded(false);
  };

  const dontRemember = () => {
    void deleteMemoryNote(note.id);
    setNote(null);
    setExpanded(false);
  };

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`You mentioned, last time. ${expanded ? "Hide" : "Show"} what you said.`}
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((current) => !current)}
        style={styles.header}
      >
        <Text style={styles.label}>You mentioned, last time</Text>
        <Text style={styles.chevron}>{expanded ? "▲" : "▼"}</Text>
      </Pressable>
      {expanded ? (
        <>
          <Text style={styles.text}>{note.text}</Text>
          <View style={styles.actions}>
            <SecondaryButton label="Use it" onPress={useIt} />
            <Pressable accessibilityRole="button" onPress={dontRemember}>
              <Text style={styles.dismissText}>Don't remember</Text>
            </Pressable>
          </View>
        </>
      ) : null}
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
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between"
    },
    label: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 0.3
    },
    chevron: {
      color: colors.textMuted,
      fontSize: 13
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
