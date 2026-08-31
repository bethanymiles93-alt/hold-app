import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";
import { AdaptiveCircleChip } from "@/components/AdaptiveCircleChip";
import { DropdownArrowBadge } from "@/components/DropdownArrowBadge";

export interface LinkedClusterMember {
  circleId: string;
  circleName: string;
  isSelected: boolean;
  hasSentThisSession?: boolean;
  notYetSent?: boolean;
  newlyAdded?: boolean;
}

interface LinkedCircleClusterProps {
  members: LinkedClusterMember[];
  /** Toggles every member together — a cluster is one unit, never partially selected by a chip tap. */
  onToggle: () => void;
  /** Cluster-level now, not per-member (2026-08-31) — one dropdown for the whole cluster, showing every member's people together, not one per circle. See docs/09-decision-log.md. */
  isExpanded: boolean;
  onToggleArrow: () => void;
  /** Whether this cluster is currently combined (vs. ungrouped back to independent circles). */
  grouped: boolean;
  onToggleGroup: () => void;
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
 *
 * **Redesigned 2026-08-31**: one shared dropdown arrow for the whole
 * cluster, not one per member — several expandable things doing the same
 * underlying job read as confusing/overwhelming for what's visually
 * presented as one linked group. Right-anchored on the last (topmost,
 * highest-zIndex) chip, same right-side convention every standalone
 * circle uses — this also resolves the old left-side placement, which
 * existed only to dodge the next chip's overlap; with a single arrow for
 * the whole cluster there's nothing left to overlap. The group/ungroup
 * control moved in from the separate `LinkGroupToggle` text link below
 * the row (now removed, no other callers) to a small chain-link icon
 * beside the arrow, always visible whenever a cluster exists — no longer
 * gated behind first selecting every member. Icon over text specifically
 * for compactness: this needs to stay small enough that the row still
 * reads as one continuous scrollable line, not one broken up by a wide
 * control between chips.
 */
export function LinkedCircleCluster({
  members,
  onToggle,
  isExpanded,
  onToggleArrow,
  grouped,
  onToggleGroup
}: LinkedCircleClusterProps) {
  const { colors } = useAppTheme("normal");
  const styles = createStyles(colors);
  const isSelected = members.every((member) => member.isSelected);
  const allSent = members.every((member) => member.hasSentThisSession);
  const sentLook = allSent && !isSelected;
  const clusterLabel = members.map((member) => member.circleName).join(" & ");

  return (
    <View style={styles.clusterUnit}>
      <View style={clusterLineStyle(colors, isSelected)} />
      <View style={styles.clusterRow}>
        {members.map((member, index) => (
          <View
            key={member.circleId}
            style={[styles.clusterChip, index > 0 && styles.clusterChipOverlap, { zIndex: index }]}
          >
            <AdaptiveCircleChip
              label={member.circleName}
              isSelected={member.isSelected}
              hasSentThisSession={member.hasSentThisSession}
              notYetSent={member.notYetSent}
              newlyAdded={member.newlyAdded}
              clusterSeam
              onPress={onToggle}
              accessibilityRole="button"
            />
          </View>
        ))}
      </View>

      <View style={styles.clusterControls}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={grouped ? `Ungroup ${clusterLabel}` : `Group ${clusterLabel}`}
          hitSlop={8}
          onPress={onToggleGroup}
        >
          {({ pressed }) => (
            <Ionicons
              name={grouped ? "link-outline" : "unlink-outline"}
              size={16}
              color={colors.link}
              style={pressed ? styles.pressed : undefined}
            />
          )}
        </Pressable>
        <DropdownArrowBadge
          expanded={isExpanded}
          checked={sentLook}
          onPress={onToggleArrow}
          accessibilityLabel={
            sentLook
              ? `${clusterLabel}, already sent. ${isExpanded ? "Hide" : "Show"} people.`
              : `${clusterLabel}, ${isExpanded ? "hide" : "show"} people`
          }
        />
      </View>
    </View>
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
      alignItems: "center",
      position: "relative"
    },
    clusterRow: {
      flexDirection: "row",
      alignItems: "center"
    },
    clusterChip: {
      position: "relative",
      alignItems: "center"
    },
    clusterChipOverlap: {
      marginLeft: -18
    },
    clusterControls: {
      position: "absolute",
      right: 10,
      bottom: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 6
    },
    pressed: {
      opacity: 0.6
    }
  });
}
