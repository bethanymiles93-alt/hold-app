import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "expo-router";
import { isHoldPlusActive } from "@/services/holdPlusService";
import { requestAiDraft, type AiDraftContext, type AiSurface } from "@/services/aiProxyClient";
import { captureMemoryNote, isMemoryEnabled } from "@/services/aiMemoryService";

export type DockedAiAmendStatus = "idle" | "loading" | "error";

export interface DockedAiAmend {
  /** False for free users, or when this docked bar instance has no AI-amend surface at all. */
  available: boolean;
  open: boolean;
  toggle: () => void;
  prompt: string;
  setPrompt: (text: string) => void;
  status: DockedAiAmendStatus;
  generate: () => Promise<void>;
}

/**
 * Powers the AI-assist button living inside DockedInputBar itself — the
 * Hold+-gated blend-not-replace amend, now built into the docked bar rather
 * than a separate collapsible panel below the message box. Supersedes the
 * standalone AmendWithAI component (see docs/09-decision-log.md,
 * 2026-08-10).
 */
export function useDockedAiAmend(
  surface: AiSurface | undefined,
  context: AiDraftContext | undefined,
  currentValue: string,
  onApply: (text: string) => void,
  /** A suggested memory note the user chose "Use it" on — opens pre-filled with it, same as AmendWithAI's own initialPrompt did. */
  initialPrompt?: string
): DockedAiAmend {
  const [available, setAvailable] = useState(false);
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState<DockedAiAmendStatus>("idle");

  useFocusEffect(
    useCallback(() => {
      if (!surface) {
        setAvailable(false);
        return;
      }
      void isHoldPlusActive().then(setAvailable);
    }, [surface])
  );

  useEffect(() => {
    if (!surface) setOpen(false);
  }, [surface]);

  useEffect(() => {
    if (!initialPrompt) return;
    setPrompt(initialPrompt);
    setOpen(true);
  }, [initialPrompt]);

  const toggle = () => {
    setOpen((current) => !current);
    setStatus("idle");
  };

  const generate = async () => {
    if (!surface) return;

    setStatus("loading");
    try {
      const memoryCaptureEnabled = await isMemoryEnabled();
      const result = await requestAiDraft(
        surface,
        {
          ...context,
          existingMessage: currentValue,
          additionalContext: prompt.trim() || undefined
        },
        memoryCaptureEnabled
      );
      onApply(result.draft);
      if (result.memoryNote) {
        void captureMemoryNote(surface, result.memoryNote);
      }
      setStatus("idle");
      setOpen(false);
      setPrompt("");
    } catch {
      setStatus("error");
    }
  };

  return { available, open, toggle, prompt, setPrompt, status, generate };
}
