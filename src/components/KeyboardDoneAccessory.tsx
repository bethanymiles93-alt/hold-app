import { useMemo } from "react";
import { InputAccessoryView, Keyboard, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";

export const KEYBOARD_DONE_ACCESSORY_ID = "hold-keyboard-done";

/**
 * iOS-only "Done" bar pinned above the keyboard, shared by every TextInput
 * that sets inputAccessoryViewID={KEYBOARD_DONE_ACCESSORY_ID}. Mounted once
 * at the root so every screen gets it without adding its own instance.
 * Android has no InputAccessoryView equivalent — tap-outside-to-dismiss
 * (Screen.tsx) is the primary way to close the keyboard there.
 */
export function KeyboardDoneAccessory() {
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (Platform.OS !== "ios") return null;

  return (
    <InputAccessoryView nativeID={KEYBOARD_DONE_ACCESSORY_ID}>
      <View style={styles.bar}>
        <Pressable accessibilityRole="button" onPress={() => Keyboard.dismiss()} style={styles.button}>
          <Text style={styles.label}>Done</Text>
        </Pressable>
      </View>
    </InputAccessoryView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    bar: {
      flexDirection: "row",
      justifyContent: "flex-end",
      backgroundColor: colors.surfaceStrong,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingHorizontal: 12,
      paddingVertical: 8
    },
    button: {
      minHeight: 32,
      minWidth: 56,
      alignItems: "center",
      justifyContent: "center"
    },
    label: {
      color: colors.link,
      fontSize: 16,
      fontWeight: "600"
    }
  });
}
