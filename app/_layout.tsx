import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { HeaderSettingsButton } from "@/components/HeaderSettingsButton";
import { SettingsBackButton } from "@/components/SettingsBackButton";
import { SettingsDrawer } from "@/components/SettingsDrawer";
import { BottomTabBar } from "@/components/BottomTabBar";
import { HoldFlowProvider } from "@/context/HoldFlowContext";
import { QuietPaletteProvider } from "@/context/QuietPaletteContext";
import { ComposingProvider } from "@/context/ComposingContext";
import { SettingsDrawerProvider } from "@/context/SettingsDrawerContext";
import { DisplaySettingsProvider } from "@/context/DisplaySettingsContext";
import { useAppTheme } from "@/hooks/useAppTheme";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      {/* Required by react-native-keyboard-controller (DockedInputBar's
          KeyboardStickyView) — must wrap anything using its hooks/components,
          as high as the tree allows. */}
      <KeyboardProvider>
        <DisplaySettingsProvider>
        <HoldFlowProvider>
          <QuietPaletteProvider>
          <ComposingProvider>
          <SettingsDrawerProvider>
            <RootLayoutNav />
          </SettingsDrawerProvider>
          </ComposingProvider>
          </QuietPaletteProvider>
        </HoldFlowProvider>
        </DisplaySettingsProvider>
      </KeyboardProvider>
    </SafeAreaProvider>
  );
}

/**
 * Split from RootLayout so useAppTheme (and, through it, useDisplaySettings)
 * can be called from inside DisplaySettingsProvider — RootLayout itself
 * renders the provider tree, so it can't consume its own context.
 */
function RootLayoutNav() {
  const { colors, isDark } = useAppTheme("normal");

  return (
    <>
            <StatusBar style={isDark ? "light" : "dark"} />
            <Stack
              screenOptions={{
                headerShadowVisible: false,
                headerTintColor: colors.text,
                headerStyle: { backgroundColor: colors.background },
                contentStyle: { backgroundColor: colors.background },
                animation: "fade",
                headerLeft: ({ canGoBack }) => (canGoBack ? <SettingsBackButton /> : null),
                headerRight: () => <HeaderSettingsButton />,
                // iOS 26 wraps custom headerLeft/headerRight views in a UIBarButtonItem
                // that gets the system "Liquid Glass" shared pill background by default,
                // regardless of the component's own (fully transparent) styles. The
                // unstable_headerLeftItems/RightItems API is the only way to opt a
                // custom element out of that shared background on iOS; headerLeft/
                // headerRight above remain as the Android fallback, since these
                // "items" props are iOS-only and override them there.
                unstable_headerLeftItems: ({ canGoBack }) =>
                  canGoBack
                    ? [{ type: "custom", element: <SettingsBackButton />, hidesSharedBackground: true }]
                    : [],
                unstable_headerRightItems: () => [
                  { type: "custom", element: <HeaderSettingsButton />, hidesSharedBackground: true }
                ]
              }}
            >
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="welcome" options={{ headerShown: false, gestureEnabled: false }} />
              {/* gestureEnabled: false unconditionally, not composition-gated
                  (2026-08-13) — matches the nav bar's own Tier 1 "hidden
                  throughout, no exceptions" framing for these same active-
                  flow screens; an inconsistent swipe-back would undercut
                  the same accidental-exit protection. The explicit back
                  button (SettingsBackButton, headerLeft above) is
                  untouched — this only removes the gestural path. See
                  docs/09-decision-log.md. */}
              {/* animation: "none" (2026-08-30) — Going Quiet is the
                  lowest-friction, most time-sensitive entry point in the
                  app; the inherited default "fade" read as a noticeably
                  slow transition on-device, working against everything
                  else stripped down tonight to reduce friction at the
                  moment someone's trying to act. See
                  docs/09-decision-log.md. */}
              <Stack.Screen
                name="create/people"
                options={{ title: "Going Quiet", gestureEnabled: false, animation: "none" }}
              />
              <Stack.Screen name="create/done" options={{ headerShown: false, gestureEnabled: false }} />
              <Stack.Screen
                name="return/transition"
                options={{ headerShown: false, gestureEnabled: false, animationDuration: 450 }}
              />
              {/* animation: "none" (2026-08-30) — same reasoning as
                  create/people above; Reconnect is the other lowest-
                  friction, time-sensitive entry point. See
                  docs/09-decision-log.md. */}
              <Stack.Screen
                name="return/reconnect"
                options={{ title: "Reconnect", gestureEnabled: false, animation: "none" }}
              />
              <Stack.Screen name="return/done" options={{ headerShown: false, gestureEnabled: false }} />
              <Stack.Screen name="settings/mission" options={{ title: "Our Mission" }} />
              <Stack.Screen name="settings/privacy" options={{ title: "Privacy Policy" }} />
              <Stack.Screen name="settings/hold-plus" options={{ title: "Hold+" }} />
              <Stack.Screen name="settings/manage-purchases" options={{ title: "Manage Purchases" }} />
              <Stack.Screen name="settings/language-location" options={{ title: "Language & Location" }} />
              <Stack.Screen name="settings/sending-channel" options={{ title: "Sending channel" }} />
              <Stack.Screen name="settings/circle/index" options={{ title: "Your Circles" }} />
              <Stack.Screen name="settings/wider-world" options={{ title: "Your Wider World" }} />
              <Stack.Screen name="settings/accessibility-display" options={{ title: "Accessibility & Display" }} />
            </Stack>
      {/* Sibling to the Stack, not inside it — a root-level overlay so
          it can show over any screen regardless of which navigator
          owns it (Settings and Going Quiet/Reconnect/Transition are
          all pushed root-stack screens, outside the Tabs group
          entirely). Rendered before SettingsDrawer so an open drawer
          visually covers it, matching the existing z-order between
          screen content and the drawer. See docs/09-decision-log.md,
          2026-08-13. */}
      <BottomTabBar />
      <SettingsDrawer />
    </>
  );
}
