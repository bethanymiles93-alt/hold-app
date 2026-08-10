/**
 * PLACEHOLDER — not clinically reviewed, must not ship. See
 * hold-book/06-privacy-security/03-safeguarding.md. The real classification
 * criteria must come from a clinical safety consultant directly, not be
 * approximated here. Only ever reachable when the app-side __DEV__ gate
 * (src/services/safeguardingService.ts in hold-app) is open, i.e. local dev
 * builds only — never TestFlight, beta testers, or production.
 */
const PLACEHOLDER_SAFEGUARDING_SYSTEM_PROMPT = `You are a safety classifier, not a conversational assistant. \
Given a short piece of free text someone typed while drafting a personal message, decide whether it contains \
language suggesting suicide, self-harm, or abuse risk to the person writing it or someone else.

Respond with exactly one word, no punctuation, no explanation: "true" if such language is present, "false" \
otherwise. Err toward "false" for ambiguous, historical, or third-party (e.g. discussing media, a book, a past \
event with no current risk) mentions — this is a coarse, low-stakes-if-wrong-in-this-direction placeholder \
check, not the reviewed version.`;

const HAIKU_MODEL = "claude-haiku-4-5";
const CLASSIFIER_TIMEOUT_MS = 8_000;

export interface SafeguardingEnv {
  ANTHROPIC_API_KEY: string;
}

/** Returns true if the placeholder classifier judges the text as triggering. Throws on any provider/network failure — caller decides the fail mode. */
export async function checkViaClassifier(env: SafeguardingEnv, text: string): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CLASSIFIER_TIMEOUT_MS);

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: HAIKU_MODEL,
        max_tokens: 5,
        temperature: 0,
        system: PLACEHOLDER_SAFEGUARDING_SYSTEM_PROMPT,
        messages: [{ role: "user", content: text }]
      })
    });

    if (!response.ok) {
      throw new Error(`provider_error:${response.status}`);
    }

    const data = (await response.json()) as { content?: Array<{ type: string; text?: string }> };
    const raw = data.content?.find((block) => block.type === "text")?.text;
    if (!raw) {
      throw new Error("provider_error:empty_response");
    }

    return raw.trim().toLowerCase().startsWith("true");
  } finally {
    clearTimeout(timeout);
  }
}
