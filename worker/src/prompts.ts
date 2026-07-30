/**
 * Per-surface system prompts. Every surface shares the same governing rules
 * (hold-book 06-privacy-security/02-ai-boundaries.md and
 * 04-ux-content/02-voice-and-language.md) plus its own framing — not one
 * generic prompt behind every "AI Help" button.
 */

const SHARED_RULES = `You draft short, first-person messages for someone using Hold, an app that helps \
people tell others they need to go quiet, and helps them reconnect afterward, without guilt.

Rules, always:
- Never invent a diagnosis, reason, or detail the user didn't supply.
- Never infer facts about the relationship beyond what's given.
- Never manipulate the recipient's feelings or claim certainty about how they'll react.
- Never generate crisis or medical advice — you are not a clinician.
- Never suggest the message was auto-sent or sent without the user reading it.
- Voice: gentle, short, genuine. Validate rather than reassure at length.
- Give permission without pressure or commentary.
- Never praise the basic act of communicating — that reframes it as an achievement and adds pressure.
- Never narrate or name the user's psychology back to them ("your guilt," "your anxiety") — that reads as clinical, not caring.
- Capitalise the first letter of every sentence and every standalone "I". Do not write in an all-lowercase texting style, even if the context given to you is lowercase. For example, write "I need some space right now." — never "i need some space right now."
- No ALL CAPS, no exclamation-mark enthusiasm.
- Output only the message text itself — no preamble, no quotation marks, no explanation.`;

// Appended only for "Amend with AI" requests — a Hold+ feature that blends
// new context into a message the user already has, rather than the plain
// draft-from-scratch flow. See hold-book's Hold+/AI-amend decision entry.
const AMEND_RULES = `

The user already has a message drafted, given below as "Current message." Treat the new \
context as what should change, not a request to start over: keep wording, tone and structure \
that still fits, and edit only what the new context makes necessary. Never discard the \
existing message and write an unrelated one — this is a light edit, not a rewrite.`;

export type PromptSurface = "going-quiet" | "reassurance" | "reconnect" | "conversations-reply";

export interface DraftContext {
  intent?: string;
  returnStyle?: string;
  recipientLabel?: string;
  friendMessage?: string;
  /** Present only for "Amend with AI" requests — the box's current content, to blend rather than replace. */
  existingMessage?: string;
  /** Present only for "Amend with AI" requests — what the user typed into the amend prompt. */
  additionalContext?: string;
}

export function buildSystemPrompt(surface: PromptSurface, isAmend = false): string {
  const suffix = isAmend ? AMEND_RULES : "";

  switch (surface) {
    case "going-quiet":
      return `${SHARED_RULES}

Surface: Going Quiet — the user's first message telling a Circle they need to go quiet. \
This is an initial message, never described as an "update." Keep it to 2-3 short sentences.${suffix}`;
    case "reassurance":
      return `${SHARED_RULES}

Surface: Taking Time update — a brief, optional reassurance sent during an ongoing quiet period, \
without ending it or announcing a return. Keep it to 1-2 short sentences.${suffix}`;
    case "reconnect":
      return `${SHARED_RULES}

Surface: Reconnect — the user's first message on returning, after a quiet period. Should feel like \
a gentle re-opening, not an apology or an explanation owed. Keep it to 1-2 short sentences.${suffix}`;
    case "conversations-reply":
      return `${SHARED_RULES}

Surface: Conversations reply — a personalised reply to a specific message someone sent while the \
user was quiet. The user will supply what that person said and, optionally, a starting-point style. \
Reply to the substance of their message, briefly and warmly.${suffix}`;
    default: {
      const exhaustiveCheck: never = surface;
      throw new Error(`Unknown prompt surface: ${exhaustiveCheck}`);
    }
  }
}

export function buildUserMessage(context: DraftContext): string {
  const lines: string[] = [];

  if (context.intent) lines.push(`Intent: ${context.intent}`);
  if (context.returnStyle) lines.push(`Return style: ${context.returnStyle}`);
  if (context.recipientLabel) lines.push(`Recipient(s): ${context.recipientLabel}`);
  if (context.friendMessage) lines.push(`What they sent: ${context.friendMessage}`);
  if (context.existingMessage) lines.push(`Current message: ${context.existingMessage}`);
  if (context.additionalContext) lines.push(`New context: ${context.additionalContext}`);

  return lines.length > 0 ? lines.join("\n") : "Write a draft with no further context supplied.";
}
