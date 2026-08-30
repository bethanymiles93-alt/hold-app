export const HAS_SEEN_WELCOME_KEY = "hold.hasSeenWelcome";
export const HAS_SEEN_RETENTION_NOTE_KEY = "hold.hasSeenRetentionNote";
/** First-run-only Core onboarding coach-mark (Going Quiet) — set the moment the hint is dismissed OR a contact is added through it, whichever comes first. Never shown again after. See docs/09-decision-log.md, 2026-08-30. */
export const HAS_SEEN_CORE_ONBOARDING_HINT_KEY = "hold.hasSeenCoreOnboardingHint";
/** Second, sequential first-run coach-mark (Going Quiet) — only ever considered once HAS_SEEN_CORE_ONBOARDING_HINT_KEY is already set, pointing at "+ New Circle" instead of Core. Same one-shot "seen" semantics. See docs/09-decision-log.md, 2026-08-30. */
export const HAS_SEEN_NEW_CIRCLE_ONBOARDING_HINT_KEY = "hold.hasSeenNewCircleOnboardingHint";
/** Anonymous per-install id sent to the AI proxy for the free-tier draft allowance — see docs/03-privacy-model.md. */
export const AI_INSTALL_ID_KEY = "hold.aiInstallId";
