import type { HoldIntent, ReturnStyle } from "@/types/hold";

export const HOLD_INTENTS: Array<{
  id: HoldIntent;
  title: string;
  description: string;
}> = [
  {
    id: "unwell",
    title: "I’m unwell",
    description: "Say that your capacity is lower than usual."
  },
  {
    id: "quiet",
    title: "I need some quiet",
    description: "Set a simple boundary without giving a reason."
  },
  {
    id: "overwhelmed",
    title: "Feeling a little overwhelmed",
    description: "Explain that you are overwhelmed without going into detail."
  },
  {
    id: "custom",
    title: "Write my own",
    description: "Start with a blank message."
  }
];

export const QUICK_RECONNECT_MESSAGES: Array<{
  id: string;
  title: string;
  text: string;
}> = [
  {
    id: "doing-a-little-better",
    title: "Doing a little better",
    text: "I’m doing a little better, but I don’t quite have the energy for a proper reply yet. I’ll message properly soon x"
  },
  {
    id: "getting-there",
    title: "Getting there",
    text: "Getting there, will try to reply properly soon."
  },
  {
    id: "here-now",
    title: "Just saying hello",
    text: "I’m here again. More soon."
  }
];

export const DEFAULT_TAKING_TIME_UPDATE =
  "I’m still taking some time and can’t properly message yet, but I’m thinking of you.";

// "Add to Going Quiet" — sent immediately to someone new who reaches out while away.
export const ADD_TO_GOING_QUIET_MESSAGE =
  "I’m not feeling very well and need to take some time. I’ll get back to you when I can.";

export const REPLY_STYLES: Array<{
  id: ReturnStyle;
  title: string;
  description: string;
}> = [
  {
    id: "open-door",
    title: "Keep it brief",
    description: "A short, warm reply without much detail."
  },
  {
    id: "acknowledge",
    title: "Acknowledge the wait",
    description: "Name that time passed, gently."
  },
  {
    id: "explain-little",
    title: "Explain a little",
    description: "Share a little about where you’ve been."
  },
  {
    id: "custom",
    title: "Write my own",
    description: "Start with a blank reply."
  }
];

/** "What they sent" — someone else's words, cheapest to lose, cleared soonest. */
export const FRIEND_MESSAGE_RETENTION_HOURS = 4;

/** "Your reply" and unsaved Going Quiet/Reconnect edits — the effortful, hard-to-recreate content. */
export const DRAFT_REPLY_RETENTION_HOURS = 48;

/**
 * Safeguarding detection layer — see hold-book 06-privacy-security/03-safeguarding.md.
 * Only ever shown behind the __DEV__ gate in safeguardingService.ts. The resource
 * numbers/services themselves are real (Samaritans, Shout, 999, 111) and match
 * hold-book's spec directly. The grounding prompt and notify-message wording below
 * are PLACEHOLDER — not clinically reviewed, must not ship — real wording is a
 * clinical/legal sign-off item, not a copy decision made here.
 */
export const SAFEGUARDING_RESOURCES: Array<{
  id: string;
  label: string;
  detail: string;
  action: { type: "tel" | "sms"; value: string; body?: string };
}> = [
  {
    id: "samaritans",
    label: "Samaritans",
    detail: "116 123 — free, 24/7, any crisis",
    action: { type: "tel", value: "116123" }
  },
  {
    id: "shout",
    label: "Shout",
    detail: "Text SHOUT to 85258 — free, 24/7, text-based",
    action: { type: "sms", value: "85258", body: "SHOUT" }
  },
  {
    id: "emergency",
    label: "999",
    detail: "Immediate danger to life",
    action: { type: "tel", value: "999" }
  },
  {
    id: "nhs-111",
    label: "111, option 2",
    detail: "Urgent mental health crisis (NHS)",
    action: { type: "tel", value: "111" }
  }
];

/** PLACEHOLDER wording — not clinically reviewed, must not ship. */
export const SAFEGUARDING_GROUNDING_PROMPT_PLACEHOLDER =
  "Right now, try naming one thing you can see, one thing you can hear, and one thing you can feel.";

/** PLACEHOLDER wording — not clinically reviewed, must not ship. Sent to Close Circle if the user taps "notify now." */
export const SAFEGUARDING_NOTIFY_MESSAGE_PLACEHOLDER =
  "I need extra support right now. Can you reach out to me?";
