import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useDockedAiAmend } from "@/hooks/useDockedAiAmend";
import { DictationMicButton } from "@/components/DictationMicButton";
import type { AiDraftContext, AiSurface } from "@/services/aiProxyClient";

interface DockedInputBarProps {
  value: string;
  onChangeText: (text: string) => void;
  /** Commits and closes the bar — the field this bar is currently bound to has already been saving live via onChangeText, so this is just "I'm done," not a separate save step. */
  onDone: () => void;
  placeholder?: string;
  accessibilityLabel: string;
  /**
   * Present only for message-shaped content — omit for short label fields
   * (a Circle name, an account nickname), where AI-amend and dictation add
   * more friction than value. See docs/09-decision-log.md, 2026-08-10.
   */
  aiAmend?: { surface: AiSurface; context?: AiDraftContext; initialPrompt?: string };
}

/**
 * The single, app-wide place free text is typed or edited — replaces every
 * screen's own in-page TextInput. Docked directly above the keyboard via
 * react-native-keyboard-controller's KeyboardStickyView (RN's own
 * InputAccessoryView doesn't render under this app's New Architecture
 * setup — see Screen.tsx). A screen renders exactly one of these, bound to
 * whichever field is currently "active" (see DockedFieldPreview) — the bar
 * itself is stateless about *what* it's editing, just how.
 *
 * Also where the Hold+-gated AI-assist trigger now lives, superseding the
 * old standalone AmendWithAI panel that sat inline below each message box
 * (2026-08-10 — see decision log for the explicit supersession).
 */
export function DockedInputBar({
  value,
  onChangeText,
  onDone,
  placeholder,
  accessibilityLabel,
  aiAmend
}: DockedInputBarProps) {
  const { colors } = useAppTheme("normal");
  const styles = createStyles(colors);
  const amend = useDockedAiAmend(
    aiAmend?.surface,
    aiAmend?.context,
    value,
    onChangeText,
    aiAmend?.initialPrompt
  );

  const appendDictated = (text: string) => {
    onChangeText(value.trim() ? `${value.trim()} ${text}` : text);
  };

  return (
    <KeyboardStickyView>
      <SafeAreaView edges={["bottom", "left", "right"]} style={styles.safe}>
        {amend.open ? (
          <View style={styles.amendRow}>
            <TextInput
              accessibilityLabel="Context for AI amend"
              onChangeText={amend.setPrompt}
              placeholder="Add context for AI, or leave blank"
              placeholderTextColor={colors.textMuted}
              style={styles.amendInput}
              value={amend.prompt}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={amend.status === "loading" ? "Generating" : "Generate with AI"}
              disabled={amend.status === "loading"}
              onPress={() => void amend.generate()}
              style={({ pressed }) => [
                styles.amendGo,
                amend.status === "loading" && styles.amendGoDisabled,
                pressed && styles.pressed
              ]}
            >
              <Ionicons name="sparkles" size={16} color={colors.onPrimary} />
            </Pressable>
          </View>
        ) : null}

        {amend.status === "error" ? (
          <Text style={styles.errorText}>Couldn't reach AI right now — try again.</Text>
        ) : null}

        <View style={styles.row}>
          {amend.available ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={amend.open ? "Close AI amend" : "Amend with AI"}
              accessibilityState={{ expanded: amend.open }}
              onPress={amend.toggle}
              style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
            >
              <Ionicons
                name={amend.open ? "sparkles" : "sparkles-outline"}
                size={20}
                color={amend.open ? colors.primary : colors.textMuted}
              />
            </Pressable>
          ) : null}

          <TextInput
            accessibilityLabel={accessibilityLabel}
            autoFocus
            multiline
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            value={value}
          />

          <DictationMicButton onResult={appendDictated} />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Done"
            onPress={onDone}
            style={({ pressed }) => [styles.doneButton, pressed && styles.pressed]}
          >
            <Ionicons name="checkmark" size={20} color={colors.onPrimary} />
          </Pressable>
        </View>
      </SafeAreaView>
    </KeyboardStickyView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    safe: {
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingHorizontal: theme.spacing.sm,
      paddingTop: theme.spacing.sm,
      gap: theme.spacing.xs
    },
    row: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: theme.spacing.xs,
      paddingBottom: theme.spacing.sm
    },
    input: {
      flex: 1,
      maxHeight: 120,
      minHeight: 44,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: theme.radius.lg,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      color: colors.text,
      fontSize: 16,
      lineHeight: 22,
      backgroundColor: colors.background
    },
    iconButton: {
      width: 44,
      height: 44,
      alignItems: "center",
      justifyContent: "center"
    },
    doneButton: {
      width: 44,
      height: 44,
      borderRadius: theme.radius.pill,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center"
    },
    pressed: {
      opacity: 0.7
    },
    amendRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
      paddingTop: theme.spacing.xs
    },
    amendInput: {
      flex: 1,
      minHeight: 40,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: theme.radius.sm,
      paddingHorizontal: theme.spacing.sm,
      color: colors.text,
      fontSize: 14,
      backgroundColor: colors.background
    },
    amendGo: {
      width: 40,
      height: 40,
      borderRadius: theme.radius.pill,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center"
    },
    amendGoDisabled: {
      opacity: 0.5
    },
    errorText: {
      color: colors.error,
      fontSize: 13,
      paddingHorizontal: theme.spacing.xs
    }
  });
}
