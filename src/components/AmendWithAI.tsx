import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";
import { SecondaryButton } from "@/components/SecondaryButton";
import { isHoldPlusActive } from "@/services/holdPlusService";
import { requestAiDraft, type AiDraftContext, type AiSurface } from "@/services/aiProxyClient";
import { captureMemoryNote, isMemoryEnabled } from "@/services/aiMemoryService";
import { useSafeguardingCheck } from "@/hooks/useSafeguardingCheck";
import { SafeguardingBanner } from "@/components/SafeguardingBanner";

interface AmendWithAIProps {
  surface: AiSurface;
  currentMessage: string;
  onApply: (text: string) => void;
  context?: AiDraftContext;
  /** A suggested note the user chose "Use it" on — opens the panel pre-filled with it. */
  initialPrompt?: string;
}

type Status = "idle" | "loading" | "error";

/**
 * Hold+-gated light-touch AI edit: blends the box's current content with new
 * context the user types in, rather than regenerating from scratch. Same
 * position everywhere it appears — directly below the message box, above
 * Send. Absent entirely for free users, not greyed out or locked.
 *
 * Also the AI memory Layer 2 capture point: when Layer 1 is on, the same
 * generate request asks the model for an optional note, stored quietly here
 * with no interruption — see docs/03-privacy-model.md, "AI memory."
 */
export function AmendWithAI({ surface, currentMessage, onApply, context, initialPrompt }: AmendWithAIProps) {
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [available, setAvailable] = useState(false);
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [draft, setDraft] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const safeguardingTriggered = useSafeguardingCheck(prompt);

  useFocusEffect(
    useCallback(() => {
      void isHoldPlusActive().then(setAvailable);
    }, [])
  );

  useEffect(() => {
    if (!initialPrompt) return;
    setPrompt(initialPrompt);
    setOpen(true);
  }, [initialPrompt]);

  const reset = () => {
    setOpen(false);
    setPrompt("");
    setDraft(null);
    setStatus("idle");
  };

  const generate = async () => {
    setStatus("loading");
    try {
      const memoryCaptureEnabled = await isMemoryEnabled();
      const result = await requestAiDraft(
        surface,
        {
          ...context,
          existingMessage: currentMessage,
          additionalContext: prompt.trim() || undefined
        },
        memoryCaptureEnabled
      );
      setDraft(result.draft);
      setStatus("idle");
      if (result.memoryNote) {
        void captureMemoryNote(surface, result.memoryNote);
      }
    } catch {
      setDraft(null);
      setStatus("error");
    }
  };

  const done = () => {
    if (draft) onApply(draft);
    reset();
  };

  if (!available) return null;

  if (!open) {
    return (
      <Pressable accessibilityRole="button" onPress={() => setOpen(true)} style={styles.openLink}>
        <Text style={styles.openLinkText}>Amend with AI</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.panel}>
      <Text style={styles.promptLabel}>What's going on, if you want to share?</Text>
      <TextInput
        accessibilityLabel="Context for AI amend"
        multiline
        onChangeText={setPrompt}
        placeholder="Optional — anything that would help it fit better"
        placeholderTextColor={colors.textMuted}
        style={styles.promptInput}
        textAlignVertical="top"
        value={prompt}
      />

      <SafeguardingBanner visible={safeguardingTriggered} />

      <View style={styles.actionsRow}>
        <SecondaryButton
          label={draft ? "Regenerate" : "Generate"}
          disabled={status === "loading"}
          onPress={() => void generate()}
        />
        <Pressable accessibilityRole="button" onPress={reset}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </View>

      {status === "error" ? (
        <Text style={styles.errorText}>Couldn't reach AI right now — try again.</Text>
      ) : null}

      {draft ? (
        <View style={styles.draftBlock}>
          <Text style={styles.draftText}>{draft}</Text>
          <SecondaryButton label="Done" onPress={done} />
        </View>
      ) : null}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    openLink: {
      alignSelf: "flex-start",
      minHeight: 32,
      justifyContent: "center"
    },
    openLinkText: {
      color: colors.link,
      fontSize: 14,
      fontWeight: "600"
    },
    panel: {
      gap: theme.spacing.sm,
      padding: theme.spacing.md,
      borderRadius: theme.radius.md,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surface
    },
    promptLabel: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: "600"
    },
    promptInput: {
      minHeight: 60,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: theme.radius.sm,
      padding: theme.spacing.sm,
      color: colors.text,
      fontSize: 15,
      lineHeight: 21,
      backgroundColor: colors.background
    },
    actionsRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md
    },
    cancelText: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: "600"
    },
    errorText: {
      color: colors.error,
      fontSize: 14
    },
    draftBlock: {
      gap: theme.spacing.sm,
      paddingTop: theme.spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.border
    },
    draftText: {
      color: colors.text,
      fontSize: 15,
      lineHeight: 22
    }
  });
}
