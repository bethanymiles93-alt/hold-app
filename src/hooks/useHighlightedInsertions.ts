import { useState } from "react";
import {
  buildSegments,
  insertBlock as insertBlockPure,
  rangesAfterEdit,
  removeBlock as removeBlockPure,
  type HighlightRange
} from "@/utils/highlightedInsertions";

/**
 * `useState` wrapper around the pure logic in `src/utils/highlightedInsertions.ts`
 * (kept separate so that logic is directly unit-testable — see
 * tests/highlightedInsertions.test.ts). Deliberately NOT built into
 * DockedInputBar's own value/onChangeText — every screen already owns its
 * own message state independently (Going Quiet, Reconnect, the Taking
 * Time drawers, Personalise...), and retrofitting all of them onto a new
 * shared state-owning hook would be a much larger, more invasive change
 * than this feature calls for. Instead this hook is self-contained inside
 * DockedInputBar: it wraps the `onChangeText` DockedInputBar already
 * receives from its caller, so callers keep working exactly as before and
 * know nothing about ranges. See docs/09-decision-log.md, 2026-08-13.
 */
export function useHighlightedInsertions(value: string, onChangeText: (text: string) => void) {
  const [ranges, setRanges] = useState<HighlightRange[]>([]);

  const handleChangeText = (newValue: string) => {
    setRanges(rangesAfterEdit(value, newValue, ranges));
    onChangeText(newValue);
  };

  /** Returns the new block's id, so a caller (e.g. the Template button) can later check `isBlockGreen(id)`. */
  const insertBlock = (text: string, id?: string): string => {
    const result = insertBlockPure(value, ranges, text, id);
    setRanges(result.ranges);
    onChangeText(result.value);
    return result.id;
  };

  const removeBlock = (range: HighlightRange) => {
    const result = removeBlockPure(value, ranges, range);
    setRanges(result.ranges);
    onChangeText(result.value);
  };

  const findBlock = (id: string): HighlightRange | undefined => ranges.find((range) => range.id === id);

  return {
    ranges,
    segments: buildSegments(value, ranges),
    handleChangeText,
    insertBlock,
    removeBlock,
    findBlock
  };
}
