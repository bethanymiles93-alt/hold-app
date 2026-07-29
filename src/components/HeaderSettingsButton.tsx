import { Pressable, StyleSheet } from "react-native";
import { HamburgerIcon } from "@/components/HamburgerIcon";
import { useSettingsDrawer } from "@/context/SettingsDrawerContext";

export function HeaderSettingsButton() {
  const { open } = useSettingsDrawer();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Settings"
      onPress={open}
      android_ripple={{ color: "transparent", borderless: true }}
      style={({ pressed }) => [styles.headerButton, pressed && styles.headerButtonPressed]}
    >
      <HamburgerIcon size={20} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  headerButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent"
  },
  headerButtonPressed: {
    backgroundColor: "transparent",
    opacity: 0.6
  }
});
