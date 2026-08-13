import { Tabs } from "expo-router";
import { HeaderSettingsButton } from "@/components/HeaderSettingsButton";
import { LibraryBackButton } from "@/components/LibraryBackButton";
import { useAppTheme } from "@/hooks/useAppTheme";

export default function TabsLayout() {
  const { colors } = useAppTheme("normal");

  return (
    <Tabs
      // The nav bar itself moved to a root-level overlay (2026-08-13) so it
      // can also show on root-stack screens (Settings) outside this
      // navigator entirely — this Tabs instance no longer renders one of
      // its own. See src/components/BottomTabBar.tsx.
      tabBar={() => null}
      screenOptions={{
        headerShadowVisible: false,
        headerTintColor: colors.text,
        headerStyle: { backgroundColor: colors.background },
        headerRight: () => <HeaderSettingsButton />
      }}
    >
      <Tabs.Screen name="index" options={{ headerShown: false, title: "Home" }} />
      <Tabs.Screen
        name="library"
        options={{ title: "Library", headerLeft: () => <LibraryBackButton /> }}
      />
      <Tabs.Screen name="history" options={{ title: "History" }} />
    </Tabs>
  );
}
