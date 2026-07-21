import type { HoldIntent, ReturnStyle } from "@/types/hold";

export const HOLD_INTENTS: Array<{
  id: HoldIntent;
  title: string;
  description: string;
}> = [
  {
    id: "quiet",
    title: "I need quiet",
    description: "Set a simple boundary without giving a reason."
  },
  {
    id: "unwell",
    title: "I’m unwell",
    description: "Say that your capacity is lower than usual."
  },
  {
    id: "overwhelmed",
    title: "Life is a lot right now",
    description: "Explain that you are overwhelmed without going into detail."
  },
  {
    id: "time",
    title: "I need some time",
    description: "Let them know you may be slower to respond."
  },
  {
    id: "custom",
    title: "Write my own",
    description: "Start with a blank message."
  }
];

export const RETURN_STYLES: Array<{
  id: ReturnStyle;
  title: string;
  description: string;
}> = [
  {
    id: "open-door",
    title: "Just open the door",
    description: "A small hello without a full explanation."
  },
  {
    id: "acknowledge",
    title: "Acknowledge the silence",
    description: "Name the gap gently and reconnect."
  },
  {
    id: "explain-little",
    title: "Explain a little",
    description: "Share that your capacity was low."
  },
  {
    id: "custom",
    title: "Write my own",
    description: "Start with a blank message."
  }
];
