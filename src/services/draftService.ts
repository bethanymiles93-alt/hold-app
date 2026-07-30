import { requestAiDraft } from "@/services/aiProxyClient";
import type { DraftRequest, ReturnStyle } from "@/types/hold";

const HOLD_DRAFTS = {
  quiet:
    "I need some quiet time at the moment. This isn’t about you, and you don’t need to fix anything. I care about you and I’ll reach out when I can.",
  unwell:
    "I’m unwell and my capacity is low, so I may be quiet for a while. I care about you. You don’t need to fix anything, and I’ll reply when I can.",
  overwhelmed:
    "Life is a lot for me right now and I don’t have my usual capacity to talk. My quietness isn’t about you. I care about you and I’ll reconnect when I can.",
  custom: ""
} as const;

const RETURN_DRAFTS = {
  "open-door":
    "I’m starting to resurface. I’m not fully back, but I wanted to say hello.",
  acknowledge:
    "I know I’ve been quiet. I cared even when I couldn’t reply, and I’d like to reconnect gently.",
  "explain-little":
    "My capacity was very low for a while, which made communicating difficult. I’m beginning to come back and wanted to reach out without waiting for the perfect words.",
  custom: ""
} as const;

export function createLocalDraft(request: DraftRequest): string {
  if (request.mode === "hold") {
    return request.intent ? HOLD_DRAFTS[request.intent] : "";
  }

  return request.returnStyle ? RETURN_DRAFTS[request.returnStyle] : "";
}

/**
 * Tries the AI proxy (worker/) first; falls back to the local template on
 * any failure — unconfigured proxy, network error, rate limit, timeout, or
 * provider error. The local route is never removed, per the privacy-review
 * boundary this replaces: see docs/03-privacy-model.md and
 * hold-book/06-privacy-security/02-ai-boundaries.md.
 */
export async function createDraft(request: DraftRequest): Promise<string> {
  try {
    if (request.mode === "hold") {
      return (await requestAiDraft("going-quiet", { intent: request.intent ?? undefined })).draft;
    }
    return (await requestAiDraft("reconnect", { returnStyle: request.returnStyle ?? undefined })).draft;
  } catch {
    return createLocalDraft(request);
  }
}

const REPLY_DRAFTS = {
  "open-door":
    "Thanks for your message. I saw it. I’m starting to resurface and wanted to say hello.",
  acknowledge:
    "Thanks for reaching out. I know it’s been a while since I replied. I cared even when I was quiet, and I’m glad to hear from you.",
  "explain-little":
    "Thanks for your message. My capacity was low for a while, which made replying hard. I’m coming back now and wanted to reach out properly.",
  custom: ""
} as const;

export function createLocalReplyDraft(style: ReturnStyle): string {
  return REPLY_DRAFTS[style];
}

/** Matches createDraft above — AI proxy first, local template fallback always available. */
export async function createReplyDraft(style: ReturnStyle): Promise<string> {
  try {
    return (await requestAiDraft("conversations-reply", { returnStyle: style })).draft;
  } catch {
    return createLocalReplyDraft(style);
  }
}
