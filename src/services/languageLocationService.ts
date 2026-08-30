import * as SecureStore from "expo-secure-store";

const LANGUAGE_KEY = "hold.languageLocation.language";
const REGION_KEY = "hold.languageLocation.region";

/**
 * Only "en" is real — no translation system exists in this codebase yet
 * (every screen's copy is English-only, confirmed by inspection, not
 * assumed). The rest are named so the intended set is visible without
 * inventing a language nobody's translated, same "Coming later" honesty
 * convention as Display theme's own unbuilt options
 * (accessibility-display.tsx). See docs/09-decision-log.md, 2026-08-31.
 */
export type Language = "en" | "es" | "fr" | "de";

/**
 * The "core six" markets hold-book's own safeguarding research
 * (06-privacy-security/03-safeguarding.md, "International crisis
 * resources") verified against official sources — every other market is
 * explicitly flagged there as not yet researched to a reliable standard,
 * so this list is deliberately not larger than what's actually backed by
 * verified data. "other" shows generic guidance rather than an invented
 * number for an unresearched country.
 */
export type Region = "uk" | "ie" | "us" | "ca" | "au" | "nz" | "other";

export interface LanguageLocationSettings {
  language: Language;
  region: Region;
}

const DEFAULTS: LanguageLocationSettings = {
  language: "en",
  region: "uk"
};

export async function getLanguageLocationSettings(): Promise<LanguageLocationSettings> {
  const [languageRaw, regionRaw] = await Promise.all([
    SecureStore.getItemAsync(LANGUAGE_KEY),
    SecureStore.getItemAsync(REGION_KEY)
  ]);

  const language: Language =
    languageRaw === "es" || languageRaw === "fr" || languageRaw === "de" ? languageRaw : DEFAULTS.language;
  const region: Region =
    regionRaw === "ie" || regionRaw === "us" || regionRaw === "ca" || regionRaw === "au" || regionRaw === "nz" || regionRaw === "other"
      ? regionRaw
      : DEFAULTS.region;

  return { language, region };
}

export async function setLanguage(value: Language): Promise<void> {
  await SecureStore.setItemAsync(LANGUAGE_KEY, value);
}

export async function setRegion(value: Region): Promise<void> {
  await SecureStore.setItemAsync(REGION_KEY, value);
}

/** Same "app state, not content" reasoning as displaySettingsService's own deleteAllDisplaySettings — not wired into "Delete my data". */
export async function deleteAllLanguageLocationSettings(): Promise<void> {
  await Promise.all([SecureStore.deleteItemAsync(LANGUAGE_KEY), SecureStore.deleteItemAsync(REGION_KEY)]);
}
