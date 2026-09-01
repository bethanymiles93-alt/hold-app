import type { PropsWithChildren, ReactNode, RefObject } from "react";
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
import { usePathname } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";
import { isTier1Route, NAV_BAR_RESERVED_HEIGHT } from "@/utils/navTier";

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
  /**
   * Exposes the internal ScrollView so a screen can scroll itself to a
   * specific child on demand (e.g. History's "tap a date, jump the list to
   * it" — see HistoryCalendar.tsx) — plain RN `ref` prop passthrough, not
   * `forwardRef`/`useImperativeHandle`, since `ScrollView` already accepts
   * a ref directly. Optional; every existing caller is unaffected. See
   * docs/09-decision-log.md, 2026-08-29.
   */
  scrollRef?: RefObject<ScrollView | null>;
}

export function Screen({ children, contentContainerStyle, footer, dockedInput, scrollRef }: ScreenProps) {
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);
  const pathname = usePathname();
  // The floating nav bar (2026-08-13) moved out of the Tabs navigator to a
  // root-level overlay, which lost the automatic bottom-space reservation
  // a navigator-managed tab bar gives its sibling screens for free — this
  // puts it back, but only on the Tier 2 routes where the bar can actually
  // show; Tier 1 screens (Going Quiet, Reconnect, Transition) never show
  // it at all and shouldn't gain unexplained bottom whitespace because of
  // it. See src/utils/navTier.ts and docs/09-decision-log.md.
  const reserveNavBarSpace = !isTier1Route(pathname);

  return (
    // `dockedInput` (a KeyboardStickyView) renders here, OUTSIDE the
    // bottom-inset SafeAreaView below, not as its child — see
    // docs/09-decision-log.md, 2026-08-11. KeyboardStickyView moves its
    // child by exactly the keyboard's own pixel height (translateY) from
    // wherever that child naturally rests when the keyboard is closed. If
    // that resting position sits inside a SafeAreaView that's already
    // padded inward by the bottom safe-area inset (home-indicator
    // clearance), the translateY math doesn't know to compensate — the
    // docked bar ends up stopping short of the keyboard by exactly that
    // inset, a real structural gap, not a colour/fill issue. Keeping this
    // root View plain (no safe-area padding of its own) means
    // KeyboardStickyView's resting position is the screen's true bottom
    // edge, matching what its translateY assumes.
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={["bottom", "left", "right"]}>
        {/* Dismisses the keyboard on tap outside an interactive child (a button,
            an input) — the only dismiss method, since InputAccessoryView's
            "Done" bar doesn't render under the New Architecture (Fabric).
            keyboardShouldPersistTaps "handled" on the ScrollView means those
            children still get their own tap first, so this only fires on
            genuinely empty space. */}
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View style={styles.flex}>
            {/* **Corrected 2026-09-01 — the fix below never actually worked,
                confirmed on a genuinely fresh native build, not stale-cache
                artifacts.** The previous version of this comment claimed
                switching from KeyboardAvoidingView to automaticallyAdjustKeyboardInsets
                + contentInsetAdjustmentBehavior="automatic" fixed input-light
                screens (Hold+, Research) not scrolling — that was never
                actually verified against Going Quiet/Reconnect specifically,
                since neither of those uses this shared Screen component at
                all (they're custom-built), so the "input-heavy scrolled
                fine" comparison was never a real test of this fix. These two
                props are also the one structural difference between every
                screen that uses Screen.tsx (all reported broken once their
                content was long enough to need scrolling: Research, Hold+,
                Our Mission, History) and every screen that scrolls correctly
                (Welcome, Home, Reconnect, Going Quiet — all custom-built, none
                of them use these props). The app wraps everything in
                react-native-keyboard-controller's own KeyboardProvider
                (app/_layout.tsx) already — layering RN's native automatic
                keyboard-inset handling on top of that, on every Screen-based
                page regardless of whether it has any text input at all, is
                the one remaining candidate. Removed; scroll behaviour now
                matches every other screen's plain ScrollView. See
                docs/09-decision-log.md. */}
            <ScrollView
              ref={scrollRef}
              style={styles.flex}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={[
                styles.content,
                contentContainerStyle,
                reserveNavBarSpace && !footer ? { paddingBottom: NAV_BAR_RESERVED_HEIGHT } : null
              ]}
            >
              {children}
            </ScrollView>
            {footer ? (
              <View style={[styles.footer, reserveNavBarSpace ? { paddingBottom: NAV_BAR_RESERVED_HEIGHT } : null]}>
                {footer}
              </View>
            ) : null}
          </View>
        </TouchableWithoutFeedback>
      </SafeAreaView>
      {dockedInput}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background
    },
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
