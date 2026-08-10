import {
  buildSystemPrompt,
  buildUserMessage,
  parseDraftResponse,
  type DraftContext,
  type ParsedDraft,
  type PromptSurface
} from "./prompts";
import { checkAndIncrement } from "./rateLimit";
import { checkViaClassifier } from "./safeguarding";

export interface Env {
  AI_USAGE: KVNamespace;
  ANTHROPIC_API_KEY: string;
  APP_CLIENT_KEY: string;
  /** Not a free-tier allowance — see wrangler.toml. A per-install monthly safety cap. */
  MONTHLY_DRAFT_SAFETY_CAP: string;
  /** Safeguarding classifier's own cap, separate from drafting — see wrangler.toml. */
  SAFEGUARD_CHECK_SAFETY_CAP: string;
}

interface DraftRequestBody {
  installId?: string;
  surface?: PromptSurface;
  context?: DraftContext;
  /** Only sent when the user has explicitly opted into AI memory's Layer 1 — see docs/03-privacy-model.md. */
  memoryCaptureEnabled?: boolean;
}

interface SafeguardCheckRequestBody {
  installId?: string;
  text?: string;
}

const ANTHROPIC_MODEL = "claude-sonnet-5";
const ANTHROPIC_TIMEOUT_MS = 20_000;
const VALID_SURFACES: PromptSurface[] = [
  "going-quiet",
  "reassurance",
  "reconnect",
  "conversations-reply",
  "email-ooo",
  "wider-world-status",
  "template"
];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

async function callAnthropic(
  env: Env,
  surface: PromptSurface,
  context: DraftContext,
  memoryCaptureEnabled: boolean
): Promise<ParsedDraft> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ANTHROPIC_TIMEOUT_MS);

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
        model: ANTHROPIC_MODEL,
        max_tokens: 300,
        temperature: 0.4,
        system: buildSystemPrompt(surface, Boolean(context.existingMessage), memoryCaptureEnabled),
        messages: [{ role: "user", content: buildUserMessage(context) }]
      })
    });

    if (!response.ok) {
      throw new Error(`provider_error:${response.status}`);
    }

    const data = (await response.json()) as { content?: Array<{ type: string; text?: string }> };
    const text = data.content?.find((block) => block.type === "text")?.text;
    if (!text) {
      throw new Error("provider_error:empty_response");
    }

    return parseDraftResponse(text);
  } finally {
    clearTimeout(timeout);
  }
}

async function handleDraft(request: Request, env: Env): Promise<Response> {
  let body: DraftRequestBody;
  try {
    body = await request.json();
  } catch {
    return json({ error: "bad_request" }, 400);
  }

  const { installId, surface, context, memoryCaptureEnabled } = body;

  if (!installId || !surface || !VALID_SURFACES.includes(surface)) {
    return json({ error: "bad_request" }, 400);
  }

  const limit = Number.parseInt(env.MONTHLY_DRAFT_SAFETY_CAP, 10) || 20;
  const rateLimit = await checkAndIncrement(env.AI_USAGE, "draft", installId, limit);

  if (!rateLimit.allowed) {
    return json({ error: "rate_limited", used: rateLimit.used, limit: rateLimit.limit }, 429);
  }

  try {
    const { draft, memoryNote } = await callAnthropic(
      env,
      surface,
      context ?? {},
      Boolean(memoryCaptureEnabled)
    );
    return json({ draft, memoryNote, used: rateLimit.used, limit: rateLimit.limit });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";

    if (message === "timeout" || (error instanceof DOMException && error.name === "AbortError")) {
      return json({ error: "timeout" }, 504);
    }

    return json({ error: "provider_error" }, 502);
  }
}

/**
 * PLACEHOLDER content behind this route — see safeguarding.ts. The app only
 * ever calls this route from a __DEV__-gated code path (hold-app's
 * safeguardingService.ts), but the Worker endpoint itself has no way to
 * verify that from a plain HTTP request, so this stays real, rate-limited
 * infrastructure regardless — never assume the client-side gate alone is
 * sufficient protection here.
 */
async function handleSafeguardCheck(request: Request, env: Env): Promise<Response> {
  let body: SafeguardCheckRequestBody;
  try {
    body = await request.json();
  } catch {
    return json({ error: "bad_request" }, 400);
  }

  const { installId, text } = body;

  if (!installId || !text) {
    return json({ error: "bad_request" }, 400);
  }

  const limit = Number.parseInt(env.SAFEGUARD_CHECK_SAFETY_CAP, 10) || 60;
  const rateLimit = await checkAndIncrement(env.AI_USAGE, "safeguard", installId, limit);

  if (!rateLimit.allowed) {
    return json({ error: "rate_limited", used: rateLimit.used, limit: rateLimit.limit }, 429);
  }

  try {
    const triggered = await checkViaClassifier(env, text);
    return json({ triggered });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";

    if (message === "timeout" || (error instanceof DOMException && error.name === "AbortError")) {
      return json({ error: "timeout" }, 504);
    }

    return json({ error: "provider_error" }, 502);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method !== "POST" || (url.pathname !== "/draft" && url.pathname !== "/safeguard-check")) {
      return json({ error: "not_found" }, 404);
    }

    // Basic app-level check, not a strong secret on its own — the monthly
    // cap below is the real protection. See wrangler.toml's comment.
    if (request.headers.get("x-hold-client-key") !== env.APP_CLIENT_KEY) {
      return json({ error: "unauthorized" }, 401);
    }

    if (url.pathname === "/safeguard-check") {
      return handleSafeguardCheck(request, env);
    }

    return handleDraft(request, env);
  }
};
