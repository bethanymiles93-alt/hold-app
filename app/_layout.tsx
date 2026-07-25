import { Stack, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Pressable, StyleSheet } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AboutIcon } from "@/components/AboutIcon";
import { HoldFlowProvider } from "@/context/HoldFlowContext";
import { theme } from "@/constants/theme";

function HeaderAboutButton() {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="About"
      onPress={() => router.push("/about")}
      style={styles.headerButton}
    >
      <AboutIcon size={20} />
    </Pressable>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <HoldFlowProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShadowVisible: false,
            headerTintColor: theme.colors.text,
            headerStyle: { backgroundColor: theme.colors.background },
            contentStyle: { backgroundColor: theme.colors.background },
            headerBackTitle: "Back",
            animation: "fade",
            headerRight: () => <HeaderAboutButton />
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="welcome" options={{ headerShown: false, gestureEnabled: false }} />
          <Stack.Screen
            name="create/people"
            options={{ title: "Going Quiet", animationDuration: 450 }}
          />
          <Stack.Screen name="create/review" options={{ title: "Review" }} />
          <Stack.Screen name="create/done" options={{ headerShown: false, gestureEnabled: false }} />
          <Stack.Screen
            name="return/transition"
            options={{ headerShown: false, gestureEnabled: false, animationDuration: 450 }}
          />
          <Stack.Screen name="return/reconnect" options={{ title: "Reconnect" }} />
          <Stack.Screen name="return/conversations" options={{ title: "Conversations" }} />
          <Stack.Screen name="return/update" options={{ title: "Send an update" }} />
          <Stack.Screen name="return/reply/index" options={{ title: "Conversations" }} />
          <Stack.Screen name="return/reply/edit" options={{ title: "Personalise" }} />
          <Stack.Screen name="return/done" options={{ headerShown: false, gestureEnabled: false }} />
          <Stack.Screen name="about" options={{ title: "About", headerRight: () => null }} />
          <Stack.Screen
            name="settings/history/index"
            options={{ title: "Hold history" }}
          />
          <Stack.Screen name="settings/circle/index" options={{ title: "Your Circles" }} />
          <Stack.Screen name="settings/circle/detail" options={{ title: "Circle" }} />
        </Stack>
      </HoldFlowProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  headerButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center"
  }
});
