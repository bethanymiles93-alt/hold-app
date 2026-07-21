import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { HoldFlowProvider } from "@/context/HoldFlowContext";
import { theme } from "@/constants/theme";

export default function RootLayout() {
  return (
    <HoldFlowProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShadowVisible: false,
          headerTintColor: theme.colors.text,
          headerStyle: { backgroundColor: theme.colors.background },
          contentStyle: { backgroundColor: theme.colors.background },
          headerBackTitle: "Back",
          animation: "fade"
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="create/people" options={{ title: "Create a Hold" }} />
        <Stack.Screen name="create/intent" options={{ title: "Create a Hold" }} />
        <Stack.Screen name="create/review" options={{ title: "Review" }} />
        <Stack.Screen name="create/done" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="return/people" options={{ title: "Return from Hold" }} />
        <Stack.Screen name="return/style" options={{ title: "Return from Hold" }} />
        <Stack.Screen name="return/review" options={{ title: "Review" }} />
        <Stack.Screen name="return/done" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="privacy" options={{ title: "Privacy" }} />
      </Stack>
    </HoldFlowProvider>
  );
}
