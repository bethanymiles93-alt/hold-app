import type { PropsWithChildren, ReactNode } from "react";
import { useMemo } from "react";
import {
  Keyboard,
  ScrollView,
  View,
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
  /**
   * Renders fixed below the scrollable content, inside the same safe area —
   * never requires scrolling to reach, regardless of how tall the scrollable
   * content grows (a longer subtitle, a larger accessibility text size,
   * etc). Use for a screen's primary action on short, fixed-content
   * "arrival/completion" screens where reaching that action should never
   * depend on content length — not a substitute for genuinely long,
   * variable content (many Circles, expanded messages), where scrolling to
   * reach Send is expected, not a bug. See docs/09-decision-log.md,
   * 2026-08-10, for why padding/size tuning alone kept failing here.
   */
  footer?: ReactNode;
  /**
   * A DockedInputBar instance, docked directly above the keyboard via
   * KeyboardStickyView rather than fixed to the screen bottom like `footer`
   * — renders only while a field on this screen is actively being edited.
   * Mutually exclusive with `footer` in practice (a screen composing text
   * doesn't also have a one-time completion action visible at the same
   * moment), though nothing enforces that structurally.
   */
  dockedInput?: ReactNode;
}

export function Screen({ children, contentContainerStyle, footer, dockedInput }: ScreenProps) {
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
        <View style={styles.flex}>
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
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </View>
      </TouchableWithoutFeedback>
      {dockedInput}
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
    },
    footer: {
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.md,
      paddingBottom: theme.spacing.lg
    }
  });
}
