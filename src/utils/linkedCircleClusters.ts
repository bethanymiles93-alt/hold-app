import { combinationKey } from "@/services/templateService";
import type { LinkedCircleSet } from "@/types/hold";

/**
 * Resolves a period's full, never-pruned `linkedCircleSets` history down to
 * "the current clusters" — extracted from logic that used to live inline in
 * `TakingTimeUpdateDrawer.tsx` (built first there, now shared across Going
 * Quiet/Reconnect/Conversations too). A Circle can only ever belong to one
 * displayed cluster at a time: its most-recently-updated combined-send wins
 * if it appears in more than one record, same "most recent wins, no merge"
 * rule Taking Time's own reading already used. `audienceCircleIds` scopes
 * results to Circles actually present in the caller's current audience —
 * a linked set can otherwise reference a Circle that's since been removed
 * from this particular screen's audience view.
 */
export function resolveLinkedClusters(sets: LinkedCircleSet[], audienceCircleIds: Set<string>): string[][] {
  const byCircle = new Map<string, { key: string; circleIds: string[]; updatedAt: number }>();

  for (const set of sets) {
    if (set.circleIds.length < 2) continue;
    if (!set.circleIds.every((id) => audienceCircleIds.has(id))) continue;

    for (const circleId of set.circleIds) {
      const existing = byCircle.get(circleId);
      if (!existing || existing.updatedAt < set.updatedAt) {
        byCircle.set(circleId, { key: set.combinationKey, circleIds: set.circleIds, updatedAt: set.updatedAt });
      }
    }
  }

  const seen = new Set<string>();
  const clusters: string[][] = [];
  for (const entry of byCircle.values()) {
    if (seen.has(entry.key)) continue;
    seen.add(entry.key);
    clusters.push(entry.circleIds);
  }
  return clusters;
}

/**
 * Which still-grouped cluster (by combinationKey) each Circle belongs to,
 * if any — the shared lookup both `sortByLinkedClusterAdjacency` and
 * Conversations' own explicit visual marker (ConversationsView.tsx) build
 * on, so "is this Circle part of a currently-grouped cluster" is resolved
 * exactly once, the same way, everywhere it's asked. Ungrouped Circles and
 * Circles with no cluster at all simply have no entry.
 */
export function resolveClusterKeyByCircle(
  linkedCircleSets: LinkedCircleSet[],
  ungroupedLinkKeys: string[],
  audienceCircleIds: Set<string>
): Map<string, string> {
  const clusters = resolveLinkedClusters(linkedCircleSets, audienceCircleIds);
  const ungrouped = new Set(ungroupedLinkKeys);
  const map = new Map<string, string>();
  for (const circleIds of clusters) {
    const key = combinationKey(circleIds);
    if (ungrouped.has(key)) continue;
    for (const circleId of circleIds) map.set(circleId, key);
  }
  return map;
}

/**
 * Reorders a flat list of people so members of a still-grouped linked
 * cluster sit adjacent to each other, inserted at the position of that
 * cluster's earliest-appearing member — everyone else keeps their own
 * original relative position. This is Conversations' own way of
 * "reflecting whatever grouped/ungrouped state was left at Reconnect's
 * instant-message stage": there's no per-Circle selection surface in
 * Conversations' own flat person-card list to attach a Group/Ungroup
 * toggle to (that's Reconnect's own circle row), so the choice already
 * made there shows up here as adjacency instead — no new toggle, no new
 * visual chrome invented for this. Generic over the minimal shape needed
 * (`circleId`) rather than importing `ConversationPerson` here, keeping
 * this file free of any one service's own types. See
 * docs/09-decision-log.md, 2026-08-21.
 */
export function sortByLinkedClusterAdjacency<T extends { circleId: string | null }>(
  items: T[],
  linkedCircleSets: LinkedCircleSet[],
  ungroupedLinkKeys: string[]
): T[] {
  const audienceCircleIds = new Set(items.map((item) => item.circleId).filter((id): id is string => id !== null));
  const keyByCircle = resolveClusterKeyByCircle(linkedCircleSets, ungroupedLinkKeys, audienceCircleIds);
  if (keyByCircle.size === 0) return items;

  const clusterIndexByCircleId = new Map<string, number>();
  const indexByKey = new Map<string, number>();
  for (const [circleId, key] of keyByCircle) {
    let clusterIndex = indexByKey.get(key);
    if (clusterIndex === undefined) {
      clusterIndex = indexByKey.size;
      indexByKey.set(key, clusterIndex);
    }
    clusterIndexByCircleId.set(circleId, clusterIndex);
  }

  const indexed = items.map((item, index) => ({ item, index }));
  const sortKeyForCluster = new Map<number, number>();
  for (const { item, index } of indexed) {
    const clusterIndex = item.circleId ? clusterIndexByCircleId.get(item.circleId) : undefined;
    if (clusterIndex !== undefined && !sortKeyForCluster.has(clusterIndex)) {
      sortKeyForCluster.set(clusterIndex, index);
    }
  }

  return indexed
    .map(({ item, index }) => {
      const clusterIndex = item.circleId ? clusterIndexByCircleId.get(item.circleId) : undefined;
      const primary = clusterIndex !== undefined ? (sortKeyForCluster.get(clusterIndex) ?? index) : index;
      return { item, primary, index };
    })
    .sort((a, b) => (a.primary !== b.primary ? a.primary - b.primary : a.index - b.index))
    .map((entry) => entry.item);
}
