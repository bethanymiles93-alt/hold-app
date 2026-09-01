import type { PropsWithChildren, ReactNode, RefObject } from "react";
import { useMemo } from "react";
import { Keyboard, Pressable, ScrollView, View, type StyleProp, StyleSheet, type ViewStyle } from "react-native";
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
        {/* **Corrected 2026-09-01, second attempt at this same bug — the
            first correction (removing automaticallyAdjustKeyboardInsets/
            contentInsetAdjustmentBehavior) was verified wrong on-device,
            confirmed genuinely fresh, not stale cache.** The real clue came
            from Patterns (history.tsx) scrolling inconsistently/"stickily"
            rather than being fully frozen like Research/Hold+/Our
            Mission/History — different severity of the same symptom, not a
            separate bug, since Patterns renders inside this exact same
            Screen/ScrollView instance. That points at gesture-responder
            contention, not a ScrollView layout/inset problem: this used to
            wrap the ScrollView in TouchableWithoutFeedback (below,
            removed) so tapping empty space would dismiss the keyboard.
            TouchableWithoutFeedback is built on RN's legacy Touchable
            responder system, which negotiates for touch ownership the same
            way a ScrollView's own pan responder does — wrapping a
            ScrollView in one is a well-documented RN gotcha, producing
            exactly this "stuck, need a very specific spot to register"
            symptom as the two responders contend for the gesture, worse
            the more nested touchable children compete (explaining why
            History's own List/Calendar content, with more Pressables, was
            completely frozen while Patterns' simpler content only stuck
            intermittently). Replaced with onScrollBeginDrag={Keyboard.dismiss}
            directly on the ScrollView — a native scroll event, not a
            competing responder — which covers "starts scrolling dismisses
            the keyboard." Tap-on-genuinely-empty-space-without-scrolling no
            longer dismisses on its own; none of the custom-built screens
            (Welcome, Home, Reconnect, Going Quiet) have that behaviour
            either, so this isn't a regression relative to the rest of the
            app. Still not empirically gesture-tested (no Accessibility
            permission for UI automation here) — needs on-device
            confirmation. See docs/09-decision-log.md. */}
        <View style={styles.flex}>
          <ScrollView
            ref={scrollRef}
            style={styles.flex}
            keyboardShouldPersistTaps="handled"
            onScrollBeginDrag={Keyboard.dismiss}
            contentContainerStyle={[
              styles.content,
              contentContainerStyle,
              reserveNavBarSpace && !footer ? { paddingBottom: NAV_BAR_RESERVED_HEIGHT } : null
            ]}
          >
            {/* **Urgent fix, 2026-09-01**: a tap intended only to dismiss the
                keyboard was reaching through to trigger a real Send —
                confirmed dangerous, not a cosmetic bug. `dockedInput` (below)
                renders as a sibling AFTER this ScrollView in the tree, so it
                visually overlays this content wherever they spatially
                overlap (later siblings paint on top, absent explicit
                z-index) — but its own non-Pressable background areas don't
                necessarily block touches from passing through to whatever
                sits underneath. Removing the old TouchableWithoutFeedback
                wrapper around the whole ScrollView (earlier tonight, fixed
                real scroll-gesture contention) closed one hole but opened
                this one: a tap on DockedInputBar's own empty background
                could fall all the way through to a Pressable in this
                content underneath it — a Circle chip, Send being the worst
                case if one happened to sit in that exact spot.
                Wrapping the CONTENT (not the ScrollView itself) in a
                Pressable that only dismisses the keyboard closes that hole
                without reintroducing the gesture-contention bug: this
                Pressable is a child of the ScrollView, not a wrapper around
                it, so the ScrollView's own vertical pan responder is
                unaffected: a tap lands here (dismiss, nothing else) rather
                than falling through further; a drag still scrolls normally.
                Not empirically confirmed against a real device — reasoned
                from the exact mechanism, treated as urgent given the safety
                stakes rather than held for full on-device verification
                first. See docs/09-decision-log.md. */}
            <Pressable onPress={Keyboard.dismiss} accessible={false} style={styles.flex}>
              {children}
            </Pressable>
          </ScrollView>
          {footer ? (
            <View style={[styles.footer, reserveNavBarSpace ? { paddingBottom: NAV_BAR_RESERVED_HEIGHT } : null]}>
              {footer}
            </View>
          ) : null}
        </View>
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
