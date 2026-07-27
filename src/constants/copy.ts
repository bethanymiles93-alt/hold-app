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
