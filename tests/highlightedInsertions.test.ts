import { describe, expect, it } from "vitest";
import {
  buildSegments,
  insertBlock,
  rangesAfterEdit,
  removeBlock,
  type HighlightRange
} from "../src/utils/highlightedInsertions";

describe("insertBlock", () => {
  it("inserts into an empty field with no separator", () => {
    const result = insertBlock("", [], "Hello there", "a");
    expect(result.value).toBe("Hello there");
    expect(result.ranges).toEqual([{ id: "a", start: 0, end: 11 }]);
  });

  it("appends after existing text with a newline separator, tracked as its own range", () => {
    const result = insertBlock("My own words", [], "Template text", "a");
    expect(result.value).toBe("My own words\nTemplate text");
    expect(result.ranges).toEqual([{ id: "a", start: 13, end: 26 }]);
  });

  it("tracks a second block independently of an existing one", () => {
    const first = insertBlock("", [], "Block one", "a");
    const second = insertBlock(first.value, first.ranges, "Block two", "b");
    expect(second.value).toBe("Block one\nBlock two");
    expect(second.ranges).toEqual([
      { id: "a", start: 0, end: 9 },
      { id: "b", start: 10, end: 19 }
    ]);
  });

  it("generates a unique id when none is given", () => {
    const result = insertBlock("", [], "Some text");
    expect(result.id).toBeTruthy();
    expect(result.ranges[0]?.id).toBe(result.id);
  });
});

describe("rangesAfterEdit", () => {
  it("reverts a block when the edit happens inside it", () => {
    const value = "hello\nworld";
    const ranges: HighlightRange[] = [{ id: "a", start: 6, end: 11 }];
    const next = rangesAfterEdit(value, "hello\nworxld", ranges);
    expect(next).toEqual([]);
  });

  it("reverts the whole block for a single-character edit anywhere inside it, not just the touched part", () => {
    const value = "prefix\nABCDEFG";
    const ranges: HighlightRange[] = [{ id: "a", start: 7, end: 14 }];
    // Delete the "D" in the middle of the block.
    const next = rangesAfterEdit(value, "prefix\nABCEFG", ranges);
    expect(next).toEqual([]);
  });

  it("shifts an unrelated block forward when typing before it, keeping its id", () => {
    const value = "own words\ntemplate block";
    const ranges: HighlightRange[] = [{ id: "a", start: 10, end: 24 }];
    const next = rangesAfterEdit(value, "own words extra\ntemplate block", ranges);
    // Inserted " extra" (6 chars) before the block.
    expect(next).toEqual([{ id: "a", start: 16, end: 30 }]);
  });

  it("leaves a block untouched when the edit happens after it", () => {
    const value = "template block\nmore";
    const ranges: HighlightRange[] = [{ id: "a", start: 0, end: 14 }];
    const next = rangesAfterEdit(value, "template block\nmore words", ranges);
    expect(next).toEqual([{ id: "a", start: 0, end: 14 }]);
  });

  it("only reverts the block actually touched, leaving a second block intact", () => {
    const value = "AAAA\nBBBB";
    const ranges: HighlightRange[] = [
      { id: "a", start: 0, end: 4 },
      { id: "b", start: 5, end: 9 }
    ];
    const next = rangesAfterEdit(value, "AAXA\nBBBB", ranges);
    expect(next).toEqual([{ id: "b", start: 5, end: 9 }]);
  });

  it("reverts a block when the edit deletes across its boundary", () => {
    const value = "own words\ntemplate";
    const ranges: HighlightRange[] = [{ id: "a", start: 10, end: 18 }];
    // Select from just before the block through partway into it, delete.
    const next = rangesAfterEdit(value, "own worate", ranges);
    expect(next).toEqual([]);
  });
});

describe("removeBlock", () => {
  it("removes the block and its leading separator", () => {
    const value = "own words\ntemplate block";
    const range: HighlightRange = { id: "a", start: 10, end: 24 };
    const result = removeBlock(value, [range], range);
    expect(result.value).toBe("own words");
    expect(result.ranges).toEqual([]);
  });

  it("removes a block from the middle and shifts a later block back", () => {
    const value = "first\nsecond\nthird";
    const ranges: HighlightRange[] = [
      { id: "a", start: 0, end: 5 },
      { id: "b", start: 6, end: 12 },
      { id: "c", start: 13, end: 18 }
    ];
    const result = removeBlock(value, ranges, ranges[1]!);
    expect(result.value).toBe("first\nthird");
    expect(result.ranges).toEqual([
      { id: "a", start: 0, end: 5 },
      { id: "c", start: 6, end: 11 }
    ]);
  });
});

describe("buildSegments", () => {
  it("returns one plain segment for no ranges", () => {
    expect(buildSegments("hello", [])).toEqual([{ text: "hello", green: false }]);
  });

  it("interleaves plain and green segments in order regardless of input order", () => {
    const value = "AAAA\nBBBB\nCCCC";
    const ranges: HighlightRange[] = [
      { id: "b", start: 10, end: 14 },
      { id: "a", start: 0, end: 4 }
    ];
    expect(buildSegments(value, ranges)).toEqual([
      { text: "AAAA", green: true },
      { text: "\nBBBB\n", green: false },
      { text: "CCCC", green: true }
    ]);
  });
});
