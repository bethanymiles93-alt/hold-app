/** Strips emoji (and the variation-selector/ZWJ characters used to combine them) from OS-contact-sourced names before they render in a pill. */
export function stripEmoji(text: string): string {
  return text
    .replace(
      /[\u{1F1E6}-\u{1F1FF}\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2300}-\u{23FF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu,
      ""
    )
    .replace(/\s{2,}/g, " ")
    .trim();
}
