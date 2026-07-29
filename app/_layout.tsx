import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { HeaderSettingsButton } from "@/components/HeaderSettingsButton";
import { SettingsDrawer } from "@/components/SettingsDrawer";
import { HoldFlowProvider } from "@/context/HoldFlowContext";
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
      <HoldFlowProvider>
        <SettingsDrawerProvider>
          <StatusBar style={isDark ? "light" : "dark"} />
          <Stack
            screenOptions={{
              headerShadowVisible: false,
              headerTintColor: colors.text,
              headerStyle: { backgroundColor: colors.background },
              contentStyle: { backgroundColor: colors.background },
              headerBackTitle: "Back",
              animation: "fade",
              headerRight: () => <HeaderSettingsButton />
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="welcome" options={{ headerShown: false, gestureEnabled: false }} />
            <Stack.Screen
              name="create/people"
              options={{ title: "Going Quiet", animationDuration: 450 }}
            />
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
            <Stack.Screen name="settings/research" options={{ title: "Research" }} />
            <Stack.Screen name="settings/hold-plus" options={{ title: "Hold+" }} />
            <Stack.Screen name="settings/circle/index" options={{ title: "Your Circles" }} />
            <Stack.Screen name="settings/circle/detail" options={{ title: "Circle" }} />
          </Stack>
          <SettingsDrawer />
        </SettingsDrawerProvider>
      </HoldFlowProvider>
    </SafeAreaProvider>
  );
}
