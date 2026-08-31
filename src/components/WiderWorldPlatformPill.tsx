import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";
import { WiderWorldPlatformIcon } from "@/components/WiderWorldPlatformIcon";
import type { WiderWorldPresetPlatform } from "@/constants/widerWorldPresets";

interface WiderWorldPlatformPillProps {
  name: string;
  icon?: WiderWorldPresetPlatform["icon"];
  isSelected: boolean;
  onPress: () => void;
}

/**
 * Icon + text label pill for a Wider World platform — deliberately not
 * AdaptiveCircleChip (that component's true-circle-if-fits sizing exists
 * for name pills with no icon slot and doesn't fit an icon+label pair well)
 * but its selected-state TOKENS are copied precisely, per direct
 * instruction — never AdaptiveCircleChip's dark-green `chipSent` fill,
 * which already means "sent" elsewhere in the app, since this pill has no
 * "sent" concept at all (Wider World platforms are self-reported, not
 * tracked). **Updated 2026-08-31 alongside AdaptiveCircleChip's own
 * hollow/solid redesign**, since this component explicitly mirrors its
 * tokens: default is now hollow (no fill, thin border) rather than a
 * constant `colors.surfaceStrong` fill, matching `chipSecondary`/
 * `chipSelected` exactly. See docs/09-decision-log.md.
 */
export function WiderWorldPlatformPill({ name, icon, isSelected, onPress }: WiderWorldPlatformPillProps) {
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isSelected }}
      accessibilityLabel={isSelected ? `${name}, selected. Tap to remove.` : `${name}. Tap to select.`}
      onPress={onPress}
      style={({ pressed }) => [styles.pill, isSelected && styles.pillSelected, pressed && styles.pillPressed]}
    >
      {icon ? (
        <View style={styles.icon}>
          <WiderWorldPlatformIcon icon={icon} size={16} color={colors.text} />
        </View>
      ) : null}
      <Text style={styles.label}>{name}</Text>
    </Pressable>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    pill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      minHeight: 40,
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.radius.pill,
      backgroundColor: "transparent",
      borderWidth: 1.5,
      borderColor: colors.border
    },
    pillSelected: {
      borderWidth: 3,
      borderColor: colors.text
    },
    pillPressed: {
      opacity: 0.7
    },
    icon: {
      alignItems: "center",
      justifyContent: "center"
    },
    label: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "600"
    }
  });
}
