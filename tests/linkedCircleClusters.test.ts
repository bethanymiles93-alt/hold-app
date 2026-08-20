import { describe, expect, it } from "vitest";
import { resolveLinkedClusters, sortByLinkedClusterAdjacency } from "../src/utils/linkedCircleClusters";

describe("resolveLinkedClusters", () => {
  it("returns nothing when there are no sets", () => {
    expect(resolveLinkedClusters([], new Set(["a", "b"]))).toEqual([]);
  });

  it("ignores single-Circle sets", () => {
    const sets = [{ combinationKey: "a", circleIds: ["a"], updatedAt: 1 }];
    expect(resolveLinkedClusters(sets, new Set(["a"]))).toEqual([]);
  });

  it("resolves one combined-send record into one cluster", () => {
    const sets = [{ combinationKey: "a_b", circleIds: ["a", "b"], updatedAt: 1 }];
    expect(resolveLinkedClusters(sets, new Set(["a", "b"]))).toEqual([["a", "b"]]);
  });

  it("drops a set referencing a Circle outside the given audience", () => {
    const sets = [{ combinationKey: "a_b", circleIds: ["a", "b"], updatedAt: 1 }];
    expect(resolveLinkedClusters(sets, new Set(["a"]))).toEqual([]);
  });

  it("a Circle's own most recent combined send wins over an older one it also appears in", () => {
    // "a" itself resolves to its newer set (a_c) — that's the "most recent
    // wins per Circle" rule this exists for. "b" only ever appeared in the
    // older set, so it still contributes that cluster too — matching
    // Taking Time's own existing behaviour exactly, not a new edge case
    // introduced here. A caller renders audienceCircles in order and skips
    // anything already rendered, so this ambiguity for "a" never surfaces
    // as a double-render in practice.
    const sets = [
      { combinationKey: "a_b", circleIds: ["a", "b"], updatedAt: 1 },
      { combinationKey: "a_c", circleIds: ["a", "c"], updatedAt: 2 }
    ];
    const clusters = resolveLinkedClusters(sets, new Set(["a", "b", "c"]));
    expect(clusters).toContainEqual(["a", "c"]);
    expect(clusters).toContainEqual(["a", "b"]);
  });

  it("keeps two independent clusters that don't share a Circle", () => {
    const sets = [
      { combinationKey: "a_b", circleIds: ["a", "b"], updatedAt: 1 },
      { combinationKey: "c_d", circleIds: ["c", "d"], updatedAt: 2 }
    ];
    const clusters = resolveLinkedClusters(sets, new Set(["a", "b", "c", "d"]));
    expect(clusters).toHaveLength(2);
    expect(clusters).toContainEqual(["a", "b"]);
    expect(clusters).toContainEqual(["c", "d"]);
  });
});

describe("sortByLinkedClusterAdjacency", () => {
  const person = (id: string, circleId: string | null) => ({ id, circleId });

  it("leaves order untouched when there are no linked sets", () => {
    const people = [person("1", "a"), person("2", null), person("3", "b")];
    expect(sortByLinkedClusterAdjacency(people, [], [])).toEqual(people);
  });

  it("pulls a still-grouped cluster's members adjacent, at the earliest member's position", () => {
    // b (circle "b") and d (circle "a") are linked; interleaved with
    // unrelated people c and e in the original order.
    const people = [person("a1", "a"), person("c", null), person("b1", "b"), person("e", null)];
    const sets = [{ combinationKey: "a_b", circleIds: ["a", "b"], updatedAt: 1 }];
    const sorted = sortByLinkedClusterAdjacency(people, sets, []);
    expect(sorted.map((p) => p.id)).toEqual(["a1", "b1", "c", "e"]);
  });

  it("does not move an explicitly ungrouped cluster's members", () => {
    const people = [person("a1", "a"), person("c", null), person("b1", "b")];
    const sets = [{ combinationKey: "a_b", circleIds: ["a", "b"], updatedAt: 1 }];
    const sorted = sortByLinkedClusterAdjacency(people, sets, ["a_b"]);
    expect(sorted.map((p) => p.id)).toEqual(["a1", "c", "b1"]);
  });

  it("leaves ungrouped (no circleId) people exactly where they were", () => {
    const people = [person("x", null), person("a1", "a"), person("y", null), person("b1", "b")];
    const sets = [{ combinationKey: "a_b", circleIds: ["a", "b"], updatedAt: 1 }];
    const sorted = sortByLinkedClusterAdjacency(people, sets, []);
    expect(sorted.map((p) => p.id)).toEqual(["x", "a1", "b1", "y"]);
  });
});
