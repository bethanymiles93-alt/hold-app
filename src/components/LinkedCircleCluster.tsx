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
 * presented as one linked group. The group/ungroup control moved in from
 * the separate `LinkGroupToggle` text link below the row (now removed, no
 * other callers) to a small chain-link icon beside the arrow, always
 * visible whenever a cluster exists — no longer gated behind first
 * selecting every member. Icon over text specifically for compactness:
 * this needs to stay small enough that the row still reads as one
 * continuous scrollable line, not one broken up by a wide control between
 * chips.
 *
 * **Bug fixed the same day: both controls sat absolutely positioned over
 * the last chip's own corner, not beside the cluster.** Copied the
 * standalone circle's own `arrowButton` treatment (`right: 10, bottom:
 * 12`, correct for a container that wraps exactly one chip) onto a
 * container that wraps *several* overlapping chips — since that
 * container's width is its content's width, "right: 10" landed on the
 * last chip's own corner, overlapping it rather than clearing it. This
 * also broke the chain icon's own tap target: overlapping the last chip's
 * touch area meant taps landed on whichever view actually captured the
 * gesture, reading as "tapping the icon just toggles the circles."
 * Restructured so the chip row and the controls (arrow, then chain icon)
 * sit side by side in normal flow instead — circles → shared arrow →
 * chain icon, left to right, each its own fully separate, non-overlapping
 * tap target.
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
    <View style={styles.clusterOuter}>
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
      </View>

      <View style={styles.clusterControls}>
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
    clusterOuter: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs
    },
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
      flexDirection: "row",
      alignItems: "center",
      gap: 6
    },
    pressed: {
      opacity: 0.6
    }
  });
}
