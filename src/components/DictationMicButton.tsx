import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet } from "react-native";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";

interface DictationMicButtonProps {
  /** Called with the final recognised phrase once dictation stops — the caller decides how to merge it into the current text (e.g. append with a space). */
  onResult: (text: string) => void;
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
export function DictationMicButton({ onResult }: DictationMicButtonProps) {
  const { colors } = useAppTheme("normal");
  const styles = createStyles(colors);
  const [listening, setListening] = useState(false);

  useSpeechRecognitionEvent("start", () => setListening(true));
  useSpeechRecognitionEvent("end", () => setListening(false));
  useSpeechRecognitionEvent("result", (event) => {
    const transcript = event.results[0]?.transcript;
    if (transcript) onResult(transcript);
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
      interimResults: false
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
        size={20}
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
