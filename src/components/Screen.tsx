import type { PropsWithChildren } from "react";
import { useMemo } from "react";
import {
  Keyboard,
  ScrollView,
  type StyleProp,
  StyleSheet,
  TouchableWithoutFeedback,
  type ViewStyle
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";

interface ScreenProps extends PropsWithChildren {
  contentContainerStyle?: StyleProp<ViewStyle>;
}

export function Screen({ children, contentContainerStyle }: ScreenProps) {
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <SafeAreaView style={styles.safe} edges={["bottom", "left", "right"]}>
      {/* Dismisses the keyboard on tap outside an interactive child (a button,
          an input) — the only dismiss method, since InputAccessoryView's
          "Done" bar doesn't render under the New Architecture (Fabric).
          keyboardShouldPersistTaps "handled" on the ScrollView means those
          children still get their own tap first, so this only fires on
          genuinely empty space. */}
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        {/* ScrollView's own keyboard-inset handling, not KeyboardAvoidingView —
            KeyboardAvoidingView's height is only established via onLayout,
            which reliably settles when a keyboard actually shows; on
            screens with no (or minimal) text input, that layout pass never
            gets a reason to fire, and the ScrollView beneath it can lock in
            an incorrect initial bound and never scroll. Confirmed on-device:
            input-heavy screens (Going Quiet, Reconnect) scrolled fine,
            input-light ones (Hold+, Research) didn't — this removes the
            shared cause instead of patching each screen individually. */}
        <ScrollView
          style={styles.flex}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={[styles.content, contentContainerStyle]}
        >
          {children}
        </ScrollView>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.background
    },
    flex: {
      flex: 1
    },
    content: {
      flexGrow: 1,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.lg
    }
  });
}
