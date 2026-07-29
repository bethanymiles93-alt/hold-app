import { Tabs } from "expo-router";
import { HeaderSettingsButton } from "@/components/HeaderSettingsButton";
import { HoldMark } from "@/components/HoldMark";
import { LibraryIcon } from "@/components/LibraryIcon";
import { HistoryIcon } from "@/components/HistoryIcon";
import { useAppTheme } from "@/hooks/useAppTheme";

export default function TabsLayout() {
  const { colors } = useAppTheme("normal");

  return (
    <Tabs
      screenOptions={{
        headerShadowVisible: false,
        headerTintColor: colors.text,
        headerStyle: { backgroundColor: colors.background },
        headerRight: () => <HeaderSettingsButton />,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "600"
        }
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          headerShown: false,
          title: "Home",
          tabBarIcon: () => <HoldMark size={22} />
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: "Library",
          tabBarIcon: () => <LibraryIcon />
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "History",
          tabBarIcon: () => <HistoryIcon />
        }}
      />
    </Tabs>
  );
}
