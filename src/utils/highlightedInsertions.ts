export interface HighlightRange {
  /** Stable per-block id, survives shifting (which creates new start/end objects) — lets a caller track "is the block I inserted still green" without relying on object identity. */
  id: string;
  start: number;
  end: number;
  /**
   * Bold in addition to green, until edited (2026-09-01) — distinct
   * purpose from the app's own "no bold-only signalling for selection
   * state" rule (that's about state indication; this marks inserted-vs-
   * edited text, a different question). Opt-in per block, not every
   * insertion — a last-sent-message insert wants it, a plain Template/
   * suggestion-pill insert doesn't, so this is a caller choice at
   * insertBlock time, not a blanket behaviour change.
   */
  bold?: boolean;
}

export interface TextSegment {
  text: string;
  green: boolean;
  bold?: boolean;
}

/**
 * Pure logic behind the green-highlight insertion mechanic (2026-08-13) —
 * separated from `useHighlightedInsertions`'s `useState` wrapper so it's
 * directly unit-testable without a React renderer (this project has no
 * @testing-library/react-native or react-test-renderer installed). This
 * is the one piece of the whole feature this session can actually verify
 * without on-device testing, so it's tested directly — see
 * tests/highlightedInsertions.test.ts.
 */

/**
 * Diffs the old value against a freshly-typed new value via common
 * prefix/suffix — the standard technique for isolating "what actually
 * changed" between two strings without a full diff library — then, for
 * each tracked range: drops it entirely if the edit overlaps it at all
 * (the given rule: any edit touching a block reverts the WHOLE block, no
 * partial tracking), shifts it if the edit happened earlier in the
 * string, or leaves it untouched if the edit happened later.
 */
export function rangesAfterEdit(oldValue: string, newValue: string, ranges: HighlightRange[]): HighlightRange[] {
  const maxPrefix = Math.min(oldValue.length, newValue.length);
  let prefixLen = 0;
  while (prefixLen < maxPrefix && oldValue[prefixLen] === newValue[prefixLen]) prefixLen++;

  const maxSuffix = Math.min(oldValue.length, newValue.length) - prefixLen;
  let suffixLen = 0;
  while (
    suffixLen < maxSuffix &&
    oldValue[oldValue.length - 1 - suffixLen] === newValue[newValue.length - 1 - suffixLen]
  ) {
    suffixLen++;
  }

  const oldEditStart = prefixLen;
  const oldEditEnd = oldValue.length - suffixLen;
  const delta = newValue.length - oldValue.length;

  const next: HighlightRange[] = [];
  for (const range of ranges) {
    const overlapsEdit = oldEditStart < range.end && oldEditEnd > range.start;
    if (overlapsEdit) continue;

    if (oldEditEnd <= range.start) {
      next.push({ id: range.id, start: range.start + delta, end: range.end + delta });
    } else {
      next.push(range);
    }
  }

  return next;
}

let nextBlockId = 0;

/** A fresh id for a new block — not cryptographic, just needs to be unique among concurrently-tracked ranges. */
export function generateBlockId(): string {
  nextBlockId += 1;
  return `block-${Date.now().toString(36)}-${nextBlockId}`;
}

/** Appends `text` as a new tracked-green block — alongside/below existing text, never a destructive replace. `bold` is opt-in per call, see HighlightRange's own doc comment. */
export function insertBlock(
  value: string,
  ranges: HighlightRange[],
  text: string,
  id: string = generateBlockId(),
  bold = false
): { value: string; ranges: HighlightRange[]; id: string } {
  const needsSeparator = value.trim().length > 0;
  const insertion = needsSeparator ? `\n${text}` : text;
  const start = value.length + (needsSeparator ? 1 : 0);
  const end = start + text.length;

  return {
    value: value + insertion,
    ranges: [...ranges, bold ? { id, start, end, bold } : { id, start, end }],
    id
  };
}

/** Removes exactly one still-green block as a single unit, including a single leading separator so it doesn't leave a stray blank line. */
export function removeBlock(
  value: string,
  ranges: HighlightRange[],
  range: HighlightRange
): { value: string; ranges: HighlightRange[] } {
  let removeStart = range.start;
  if (removeStart > 0 && (value[removeStart - 1] === "\n" || value[removeStart - 1] === " ")) {
    removeStart -= 1;
  }
  const delta = removeStart - range.end;
  const newValue = value.slice(0, removeStart) + value.slice(range.end);

  const nextRanges = ranges
    .filter((existing) => existing.id !== range.id)
    .map((existing) =>
      existing.start >= range.end ? { id: existing.id, start: existing.start + delta, end: existing.end + delta } : existing
    );

  return { value: newValue, ranges: nextRanges };
}

/** Splits `value` into green/normal segments for rendering, given non-overlapping (possibly unsorted) ranges. */
export function buildSegments(value: string, ranges: HighlightRange[]): TextSegment[] {
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const result: TextSegment[] = [];
  let cursor = 0;
  for (const range of sorted) {
    if (range.start > cursor) result.push({ text: value.slice(cursor, range.start), green: false });
    result.push({ text: value.slice(range.start, range.end), green: true, bold: range.bold });
    cursor = range.end;
  }
  if (cursor < value.length) result.push({ text: value.slice(cursor), green: false });
  return result;
}
