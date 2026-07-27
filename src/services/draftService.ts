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
 * Product boundary for future AI support.
 *
 * Replace this implementation with a call to a server-side endpoint only after:
 * - privacy review;
 * - data-retention rules;
 * - content minimisation;
 * - user disclosure;
 * - safe failure behaviour; and
 * - a non-AI route remaining available.
 */
export async function createDraft(request: DraftRequest): Promise<string> {
  return createLocalDraft(request);
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

/**
 * Product boundary for future AI support, matching createDraft above.
 *
 * Replace this implementation with a call to a server-side endpoint only after:
 * - privacy review;
 * - data-retention rules;
 * - content minimisation;
 * - user disclosure;
 * - safe failure behaviour; and
 * - a non-AI route remaining available.
 */
export async function createReplyDraft(style: ReturnStyle): Promise<string> {
  return createLocalReplyDraft(style);
}
