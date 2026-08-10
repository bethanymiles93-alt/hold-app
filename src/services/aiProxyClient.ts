import * as SecureStore from "expo-secure-store";
import { AI_INSTALL_ID_KEY } from "@/constants/storageKeys";

/**
 * Client for hold-ai-proxy (worker/). Never holds the real Anthropic key —
 * that lives only in the Worker. See worker/README.md and
 * docs/03-privacy-model.md.
 */

export type AiSurface = "going-quiet" | "reassurance" | "reconnect" | "conversations-reply";

export interface AiDraftContext {
  intent?: string;
  returnStyle?: string;
  recipientLabel?: string;
  friendMessage?: string;
  /** Present only for "Amend with AI" requests — the box's current content, to blend rather than replace. */
  existingMessage?: string;
  /** Present only for "Amend with AI" requests — what the user typed into the amend prompt. */
  additionalContext?: string;
}

const PROXY_URL = process.env.EXPO_PUBLIC_AI_PROXY_URL;
const CLIENT_KEY = process.env.EXPO_PUBLIC_AI_CLIENT_KEY;

function createInstallId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

async function getInstallId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(AI_INSTALL_ID_KEY);
  if (existing) return existing;

  const created = createInstallId();
  await SecureStore.setItemAsync(AI_INSTALL_ID_KEY, created);
  return created;
}

/** Whether the AI proxy is configured at all — false in local/unconfigured builds. */
export function isAiProxyConfigured(): boolean {
  return Boolean(PROXY_URL && CLIENT_KEY);
}

/** Part of "Delete my data" — a fresh id gets generated on next AI use, same as a genuine fresh install. */
export async function deleteAiInstallId(): Promise<void> {
  await SecureStore.deleteItemAsync(AI_INSTALL_ID_KEY);
}

export interface AiDraftResult {
  draft: string;
  /** Present only when memoryCaptureEnabled was set and the model found something worth noting. */
  memoryNote: string | null;
}

/** Throws on any failure — callers fall back to the local template draft, always. */
export async function requestAiDraft(
  surface: AiSurface,
  context: AiDraftContext,
  memoryCaptureEnabled = false
): Promise<AiDraftResult> {
  if (!PROXY_URL || !CLIENT_KEY) {
    throw new Error("ai_proxy_not_configured");
  }

  const installId = await getInstallId();

  const response = await fetch(`${PROXY_URL}/draft`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-hold-client-key": CLIENT_KEY
    },
    body: JSON.stringify({ installId, surface, context, memoryCaptureEnabled })
  });

  const data = (await response.json()) as { draft?: string; memoryNote?: string | null; error?: string };

  if (!response.ok || !data.draft) {
    throw new Error(data.error ?? "ai_proxy_error");
  }

  return { draft: data.draft, memoryNote: data.memoryNote ?? null };
}
