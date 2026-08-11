function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const value = parseInt(clean, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function channelToHex(channel: number): string {
  return Math.round(Math.min(255, Math.max(0, channel)))
    .toString(16)
    .padStart(2, "0");
}

/**
 * Linear RGB blend of two hex colours — `ratio` is how much of `hexA` shows
 * through (1 = pure hexA, 0 = pure hexB). Used to derive a fill that visually
 * bridges two existing theme tokens (e.g. the docked bar's background,
 * blending the pale chip green toward a neutral gray) rather than inventing
 * a new standalone colour. See docs/09-decision-log.md, 2026-08-11.
 */
export function mixColors(hexA: string, hexB: string, ratio: number): string {
  const [r1, g1, b1] = hexToRgb(hexA);
  const [r2, g2, b2] = hexToRgb(hexB);
  const r = r1 * ratio + r2 * (1 - ratio);
  const g = g1 * ratio + g2 * (1 - ratio);
  const b = b1 * ratio + b2 * (1 - ratio);
  return `#${channelToHex(r)}${channelToHex(g)}${channelToHex(b)}`;
}
