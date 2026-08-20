import { StyleSheet, Text, View } from "react-native";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";
import { AdaptiveCircleChip } from "@/components/AdaptiveCircleChip";

export interface LinkedClusterMember {
  circleId: string;
  circleName: string;
  isSelected: boolean;
  hasSentThisSession?: boolean;
  notYetSent?: boolean;
  newlyAdded?: boolean;
  isExpanded: boolean;
}

interface LinkedCircleClusterProps {
  members: LinkedClusterMember[];
  /** Toggles every member together — a cluster is one unit, never partially selected by a chip tap. */
  onToggle: () => void;
  onToggleArrow: (circleId: string) => void;
}

/**
 * Two or more overlapping Circle chips joined by a connecting line —
 * Olympic-rings style — for Circles that received one combined message
 * together. **Extracted 2026-08-21** from `TakingTimeUpdateDrawer.tsx`,
 * where this was first built and, until now, lived inline as a private
 * `LinkedCluster` function — now shared across Going Quiet (creates the
 * link), Reconnect's instant-message screen, and Conversations (both
 * consume it), not just Taking Time's own "Send an Update". Takes already-
 * resolved per-member display props rather than a raw domain type, since
 * each caller's own Circle representation differs slightly (Reconnect's
 * `AudienceCircle` carries `hasSentThisSession`/`notYetSent`/`newlyAdded`
 * concepts Going Quiet's own selection type doesn't need) — resolving that
 * upstream keeps this component itself free of any one screen's data
 * shape. Instant snap, no animation, per the original direct instruction
 * this carries forward unchanged — a future calm separation animation (no
 * bounce, respecting Reduce Motion) is still just a logged design idea,
 * not built. See docs/09-decision-log.md.
 */
export function LinkedCircleCluster({ members, onToggle, onToggleArrow }: LinkedCircleClusterProps) {
  const { colors } = useAppTheme("normal");
  const styles = createStyles(colors);
  const isSelected = members.every((member) => member.isSelected);

  return (
    <View style={styles.clusterUnit}>
      <View style={clusterLineStyle(colors, isSelected)} />
      <View style={styles.clusterRow}>
        {members.map((member, index) => (
          <View key={member.circleId} style={[styles.clusterChip, index > 0 && styles.clusterChipOverlap]}>
            <AdaptiveCircleChip
              label={member.circleName}
              isSelected={member.isSelected}
              hasSentThisSession={member.hasSentThisSession}
              notYetSent={member.notYetSent}
              newlyAdded={member.newlyAdded}
              onPress={onToggle}
              accessibilityRole="button"
            />
            <Text accessibilityRole="button" onPress={() => onToggleArrow(member.circleId)} style={styles.arrow}>
              {member.isExpanded ? "▲" : "▼"}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

interface LinkGroupToggleProps {
  /** Whether this cluster is currently grouped — label shows the action, not the state ("Ungroup" while grouped, "Group" while ungrouped). */
  grouped: boolean;
  onPress: () => void;
}

/**
 * The contextual Group/Ungroup toggle — appears in the space between the
 * circle row and the full recipient pill list, only when a linked cluster
 * is currently selected. See docs/09-decision-log.md, 2026-08-21 (confirmed
 * this belongs only where a linked cluster can actually appear — Taking
 * Time's Update screen, Reconnect's instant-message screen — never Going
 * Quiet, which only ever creates a link, and never Conversations, which has
 * no per-Circle selection surface of its own to toggle).
 */
export function LinkGroupToggle({ grouped, onPress }: LinkGroupToggleProps) {
  const { colors } = useAppTheme("normal");
  const styles = createStyles(colors);
  return (
    <Text accessibilityRole="button" style={styles.groupToggle} onPress={onPress}>
      {grouped ? "Ungroup" : "Group"}
    </Text>
  );
}

/**
 * A plain inline style object, not a StyleSheet.create entry — it needs a
 * runtime argument (whether this cluster is currently grouped), which
 * StyleSheet.create's static registration doesn't support.
 */
function clusterLineStyle(colors: ThemeColors, grouped: boolean) {
  return {
    position: "absolute" as const,
    top: 45,
    left: 20,
    right: 20,
    height: 2,
    backgroundColor: grouped ? colors.primary : colors.border,
    opacity: grouped ? 1 : 0.5
  };
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    clusterUnit: {
      alignItems: "center"
    },
    clusterRow: {
      flexDirection: "row",
      alignItems: "center"
    },
    clusterChip: {
      alignItems: "center",
      gap: 2
    },
    clusterChipOverlap: {
      marginLeft: -18
    },
    arrow: {
      fontSize: 12,
      color: colors.textMuted,
      textAlign: "center"
    },
    groupToggle: {
      alignSelf: "flex-start",
      color: colors.link,
      fontSize: 13,
      fontWeight: "600"
    }
  });
}
