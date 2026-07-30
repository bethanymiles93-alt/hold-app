import { Tabs } from "expo-router";
import { HeaderSettingsButton } from "@/components/HeaderSettingsButton";
import { BottomTabBar } from "@/components/BottomTabBar";
import { useAppTheme } from "@/hooks/useAppTheme";

export default function TabsLayout() {
  const { colors } = useAppTheme("normal");

  return (
    <Tabs
      tabBar={(props) => <BottomTabBar {...props} />}
      screenOptions={{
        headerShadowVisible: false,
        headerTintColor: colors.text,
        headerStyle: { backgroundColor: colors.background },
        headerRight: () => <HeaderSettingsButton />
      }}
    >
      <Tabs.Screen name="index" options={{ headerShown: false, title: "Home" }} />
      <Tabs.Screen name="library" options={{ title: "Library" }} />
      <Tabs.Screen name="history" options={{ title: "History" }} />
    </Tabs>
  );
}
