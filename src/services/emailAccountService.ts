import type { EmailAccount, EmailProvider } from "@/types/hold";

export interface ConnectAccountResult {
  ok: boolean;
  reason?: "work-blocked";
}

/**
 * Product boundary for future email provider integration.
 *
 * Mocked for now — no real account is ever contacted, and there is no way to
 * genuinely detect an organisation's access policy without real OAuth. The
 * work/personal choice in the UI stands in for that detection so the blocked
 * path can still be demoed honestly.
 *
 * Replace with genuine Gmail/Outlook API calls (OAuth, then their
 * out-of-office/vacation-responder endpoints) only after the same review this
 * project already requires for any new integration: privacy review,
 * data-retention rules, content minimisation, user disclosure, and safe
 * failure behaviour.
 */
export async function connectEmailAccount(
  provider: EmailProvider,
  isWork: boolean
): Promise<ConnectAccountResult> {
  if (isWork) {
    return { ok: false, reason: "work-blocked" };
  }

  return { ok: true };
}

/** Mocked: activating out-of-office is a no-op until real providers are wired up. */
export async function activateOutOfOffice(accounts: EmailAccount[]): Promise<void> {
  return;
}

export function createEmailAccountId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
