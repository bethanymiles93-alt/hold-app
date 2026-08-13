import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { HeaderSettingsButton } from "@/components/HeaderSettingsButton";
import { SettingsBackButton } from "@/components/SettingsBackButton";
import { SettingsDrawer } from "@/components/SettingsDrawer";
import { HoldFlowProvider } from "@/context/HoldFlowContext";
import { QuietPaletteProvider } from "@/context/QuietPaletteContext";
import { SettingsDrawerProvider } from "@/context/SettingsDrawerContext";
import { useAppTheme } from "@/hooks/useAppTheme";
import { clearStaleFriendMessagesOnLaunch } from "@/services/replyStorageService";

export default function RootLayout() {
  const { colors, isDark } = useAppTheme("normal");

  useEffect(() => {
    void clearStaleFriendMessagesOnLaunch();
  }, []);

  return (
    <SafeAreaProvider>
      {/* Required by react-native-keyboard-controller (DockedInputBar's
          KeyboardStickyView) — must wrap anything using its hooks/components,
          as high as the tree allows. */}
      <KeyboardProvider>
        <HoldFlowProvider>
          <QuietPaletteProvider>
          <SettingsDrawerProvider>
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
              <Stack.Screen name="create/people" options={{ title: "Going Quiet" }} />
              <Stack.Screen name="create/done" options={{ headerShown: false, gestureEnabled: false }} />
              <Stack.Screen
                name="return/transition"
                options={{ headerShown: false, gestureEnabled: false, animationDuration: 450 }}
              />
              <Stack.Screen name="return/reconnect" options={{ title: "Reconnect" }} />
              <Stack.Screen name="return/update" options={{ title: "Send an update" }} />
              <Stack.Screen name="return/done" options={{ headerShown: false, gestureEnabled: false }} />
              <Stack.Screen name="settings/mission" options={{ title: "Our Mission" }} />
              <Stack.Screen name="settings/privacy" options={{ title: "Privacy Policy" }} />
              <Stack.Screen name="settings/hold-plus" options={{ title: "Hold+" }} />
              <Stack.Screen name="settings/sending-channel" options={{ title: "Sending channel" }} />
              <Stack.Screen name="settings/circle/index" options={{ title: "Your Circles" }} />
            </Stack>
            <SettingsDrawer />
          </SettingsDrawerProvider>
          </QuietPaletteProvider>
        </HoldFlowProvider>
      </KeyboardProvider>
    </SafeAreaProvider>
  );
}
