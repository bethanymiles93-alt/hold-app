import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet } from "react-native";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";

interface DictationMicButtonProps {
  /**
   * Called on every recognition update while dictating, live — `text` is
   * the full transcript-so-far for the current utterance (not a delta), and
   * `isFinal` distinguishes a still-updating interim result from the
   * settled one. The caller should replace whatever it's shown for this
   * dictation session on each call, not append, since each `text` already
   * supersedes the previous one.
   */
  onResult: (text: string, isFinal: boolean) => void;
  /** Fires when dictation starts, before any results arrive — lets the caller snapshot whatever text already existed prior to this dictation session. */
  onStart?: () => void;
}

/**
 * On-device dictation only (`requiresOnDeviceRecognition: true`) — matches
 * Hold's privacy stance; nothing spoken is sent anywhere for this feature.
 * Wraps iOS's SFSpeechRecognizer / Android's SpeechRecognizer via
 * expo-speech-recognition, not a third-party cloud STT service. See
 * docs/09-decision-log.md, 2026-08-10.
 *
 * On-device recognition availability varies by Android manufacturer/OS
 * version — this deliberately does not fall back to cloud recognition if
 * on-device isn't available, since that would silently break the privacy
 * guarantee; it just fails (the `error` event resets `listening`), same as
 * any other feature this app declines to weaken for the sake of coverage.
 */
export function DictationMicButton({ onResult, onStart }: DictationMicButtonProps) {
  const { colors } = useAppTheme("normal");
  const styles = createStyles(colors);
  const [listening, setListening] = useState(false);

  useSpeechRecognitionEvent("start", () => {
    setListening(true);
    onStart?.();
  });
  useSpeechRecognitionEvent("end", () => setListening(false));
  useSpeechRecognitionEvent("result", (event) => {
    const transcript = event.results[0]?.transcript;
    if (transcript) onResult(transcript, event.isFinal);
  });
  useSpeechRecognitionEvent("error", () => setListening(false));

  const toggle = async () => {
    if (listening) {
      ExpoSpeechRecognitionModule.stop();
      return;
    }

    const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permission.granted) return;

    ExpoSpeechRecognitionModule.start({
      lang: "en-US",
      requiresOnDeviceRecognition: true,
      interimResults: true
    });
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={listening ? "Stop dictation" : "Start dictation"}
      onPress={() => void toggle()}
      style={({ pressed }) => [styles.button, listening && styles.listening, pressed && styles.pressed]}
    >
      <Ionicons
        name={listening ? "mic" : "mic-outline"}
        size={26}
        color={listening ? colors.onPrimary : colors.textMuted}
      />
    </Pressable>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    button: {
      width: 44,
      height: 44,
      borderRadius: theme.radius.pill,
      alignItems: "center",
      justifyContent: "center"
    },
    listening: {
      backgroundColor: colors.primary
    },
    pressed: {
      opacity: 0.7
    }
  });
}
