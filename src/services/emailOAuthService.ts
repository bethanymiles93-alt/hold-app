import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import * as SecureStore from "expo-secure-store";
import type { EmailProvider } from "@/types/hold";

WebBrowser.maybeCompleteAuthSession();

/**
 * Real OAuth + provider settings-API integration for email out-of-office,
 * behind the same "configured or not" gate `aiProxyClient.ts` already
 * established for the AI proxy (`isAiProxyConfigured`) — a real client id
 * per provider, read from `.env` (EXPO_PUBLIC_*, never committed), same
 * convention. **Neither client id is provisioned yet, so this stays
 * unreachable until they are** — that provisioning is an external, user-side
 * action (a Google Cloud Console project + OAuth consent screen, plus
 * Google's own CASA security-assessment verification process for the
 * restricted `gmail.settings.basic` scope; an Azure AD app registration for
 * `MailboxSettings.ReadWrite`), not something buildable from inside this
 * sandbox. Every function here is otherwise real, not mocked — correct
 * against each provider's documented REST API — so wiring up real client ids
 * later needs no further code change, just the two env vars set. See
 * docs/09-decision-log.md, 2026-08-21.
 */

const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID;
const MICROSOFT_CLIENT_ID = process.env.EXPO_PUBLIC_MICROSOFT_OAUTH_CLIENT_ID;

const TOKEN_KEY_PREFIX = "hold.email.oauth.token.";
const TOKEN_INDEX_KEY = "hold.email.oauth.token.index";

interface StoredToken {
  accessToken: string;
  refreshToken?: string;
  /** Epoch ms. */
  expiresAt: number;
  provider: EmailProvider;
}

interface ProviderConfig {
  clientId: string | undefined;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  scopes: string[];
}

const PROVIDER_CONFIG: Record<EmailProvider, ProviderConfig> = {
  gmail: {
    clientId: GOOGLE_CLIENT_ID,
    authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenEndpoint: "https://oauth2.googleapis.com/token",
    // Restricted scope under Google's own classification — requires the
    // app to pass Google's CASA (App Defense Alliance) security assessment
    // before this works for anyone beyond the project's own registered
    // test users. See the module comment above.
    scopes: ["https://www.googleapis.com/auth/gmail.settings.basic"]
  },
  outlook: {
    clientId: MICROSOFT_CLIENT_ID,
    authorizationEndpoint: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenEndpoint: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    scopes: ["https://graph.microsoft.com/MailboxSettings.ReadWrite", "offline_access"]
  }
};

/**
 * Whether real OAuth can even be attempted for this provider — false until
 * a real client id is supplied. Callers fall back to a manual, draft-text
 * account (no real linking) whenever this is false, exactly the same
 * honest behaviour the fully-mocked version always had.
 */
export function isEmailOAuthConfigured(provider: EmailProvider): boolean {
  return Boolean(PROVIDER_CONFIG[provider].clientId);
}

function tokenKey(accountId: string): string {
  return `${TOKEN_KEY_PREFIX}${accountId}`;
}

async function readTokenIndex(): Promise<string[]> {
  const raw = await SecureStore.getItemAsync(TOKEN_INDEX_KEY);
  return raw ? (JSON.parse(raw) as string[]) : [];
}

async function writeTokenIndex(accountIds: string[]): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_INDEX_KEY, JSON.stringify(accountIds));
}

async function readToken(accountId: string): Promise<StoredToken | null> {
  const raw = await SecureStore.getItemAsync(tokenKey(accountId));
  return raw ? (JSON.parse(raw) as StoredToken) : null;
}

async function writeToken(accountId: string, token: StoredToken): Promise<void> {
  await SecureStore.setItemAsync(tokenKey(accountId), JSON.stringify(token));

  // EmailAccount records themselves are Going Quiet's own local, per-session
  // state, never durably listed anywhere — without this index, a real
  // OAuth token written here would have nothing to enumerate it by account
  // id later, making a complete "Delete my data" wipe impossible for
  // anything already linked. See docs/09-decision-log.md, 2026-08-21.
  const ids = await readTokenIndex();
  if (!ids.includes(accountId)) {
    await writeTokenIndex([...ids, accountId]);
  }
}

/**
 * Every account id this device holds a real OAuth token for, with its
 * provider — the token index is the only durable record of a real link
 * that predates the 2026-08-30 migration to durable EmailAccountRecord
 * storage (see emailAccountService.ts's migrateLinkedEmailAccounts).
 * Deliberately returns id+provider only, never the token itself.
 */
export async function getLinkedEmailAccountIds(): Promise<{ accountId: string; provider: EmailProvider }[]> {
  const ids = await readTokenIndex();
  const tokens = await Promise.all(ids.map((id) => readToken(id)));
  return ids
    .map((accountId, index) => ({ accountId, provider: tokens[index]?.provider }))
    .filter((entry): entry is { accountId: string; provider: EmailProvider } => entry.provider !== undefined);
}

/**
 * Best-effort real email address for a linked account, used purely as a
 * sensible default label when migrating a pre-2026-08-30 linked account
 * that never had a durable label stored anywhere. Returns null on any
 * failure (expired/unrefreshable token, network error, unexpected
 * response shape) — the caller falls back to a generic provider-name
 * label rather than treating this as fatal.
 */
export async function fetchLinkedEmailAddress(accountId: string, provider: EmailProvider): Promise<string | null> {
  const accessToken = await getValidAccessToken(accountId);
  if (!accessToken) return null;

  try {
    if (provider === "gmail") {
      const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (!response.ok) return null;
      const body = (await response.json()) as { emailAddress?: string };
      return body.emailAddress ?? null;
    }

    const response = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { mail?: string; userPrincipalName?: string };
    return body.mail ?? body.userPrincipalName ?? null;
  } catch {
    return null;
  }
}

/** Part of "Delete my data", and cleanup when a person cancels the label step right after a real link succeeded. */
export async function deleteEmailOAuthToken(accountId: string): Promise<void> {
  await SecureStore.deleteItemAsync(tokenKey(accountId));
  const ids = await readTokenIndex();
  await writeTokenIndex(ids.filter((id) => id !== accountId));
}

/** Every real OAuth token this device holds, wiped — "Delete my data"'s own completeness for email linking specifically, since no other list of linked account ids exists anywhere to enumerate them by otherwise. */
export async function deleteAllEmailOAuthTokens(): Promise<void> {
  const ids = await readTokenIndex();
  await Promise.all(ids.map((id) => SecureStore.deleteItemAsync(tokenKey(id))));
  await SecureStore.deleteItemAsync(TOKEN_INDEX_KEY);
}

export interface OAuthLinkResult {
  ok: boolean;
}

/**
 * The real PKCE authorization-code flow: opens the system browser via
 * `expo-web-browser`/`expo-auth-session`, exchanges the returned code for
 * tokens, and stores them keyed by `accountId` (generated by the caller
 * before this runs, so a token can be keyed to it immediately). Returns
 * `{ ok: false }` on cancellation, denial, or if this provider isn't
 * configured — never throws for those cases, since "the person backed out"
 * isn't an error state.
 */
export async function linkEmailAccount(provider: EmailProvider, accountId: string): Promise<OAuthLinkResult> {
  const config = PROVIDER_CONFIG[provider];
  if (!config.clientId) return { ok: false };

  const redirectUri = AuthSession.makeRedirectUri({ scheme: "hold" });
  const discovery = { authorizationEndpoint: config.authorizationEndpoint, tokenEndpoint: config.tokenEndpoint };

  const request = new AuthSession.AuthRequest({
    clientId: config.clientId,
    scopes: config.scopes,
    redirectUri,
    responseType: AuthSession.ResponseType.Code,
    usePKCE: true
  });

  const result = await request.promptAsync(discovery);
  if (result.type !== "success" || !result.params.code) return { ok: false };

  try {
    const tokenResult = await AuthSession.exchangeCodeAsync(
      {
        clientId: config.clientId,
        code: result.params.code,
        redirectUri,
        extraParams: request.codeVerifier ? { code_verifier: request.codeVerifier } : undefined
      },
      discovery
    );

    if (!tokenResult.accessToken) return { ok: false };

    await writeToken(accountId, {
      accessToken: tokenResult.accessToken,
      refreshToken: tokenResult.refreshToken,
      expiresAt: tokenResult.expiresIn ? Date.now() + tokenResult.expiresIn * 1000 : Date.now() + 55 * 60 * 1000,
      provider
    });

    return { ok: true };
  } catch {
    return { ok: false };
  }
}

/** Refreshes an expired access token in place if a refresh token was granted. Null if there's nothing usable (no token, no refresh token, or the refresh call itself failed) — every caller below treats that as "nothing to do," not an error to surface. */
async function getValidAccessToken(accountId: string): Promise<string | null> {
  const token = await readToken(accountId);
  if (!token) return null;
  if (Date.now() < token.expiresAt - 60_000) return token.accessToken;
  if (!token.refreshToken) return null;

  const config = PROVIDER_CONFIG[token.provider];
  if (!config.clientId) return null;

  try {
    const refreshed = await AuthSession.refreshAsync(
      { clientId: config.clientId, refreshToken: token.refreshToken },
      { tokenEndpoint: config.tokenEndpoint }
    );
    if (!refreshed.accessToken) return null;

    await writeToken(accountId, {
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken ?? token.refreshToken,
      expiresAt: refreshed.expiresIn ? Date.now() + refreshed.expiresIn * 1000 : Date.now() + 55 * 60 * 1000,
      provider: token.provider
    });
    return refreshed.accessToken;
  } catch {
    return null;
  }
}

/**
 * Sets a linked account's real out-of-office/vacation-responder state via
 * the provider's own settings API — Gmail's `users.settings.updateVacation`,
 * Microsoft Graph's `mailboxSettings.automaticRepliesSetting`. A silent
 * no-op (not an error) if this account has no usable token — a manual-only
 * account never has one, and this is exactly what makes it correctly fall
 * back to "nothing happens automatically" rather than a thrown exception
 * breaking the Done/turn-off flow around it.
 */
export async function setRealAutoReply(
  accountId: string,
  provider: EmailProvider,
  enabled: boolean,
  message: string
): Promise<void> {
  const accessToken = await getValidAccessToken(accountId);
  if (!accessToken) return;

  if (provider === "gmail") {
    await fetch("https://gmail.googleapis.com/gmail/v1/users/me/settings/vacation", {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        enableAutoReply: enabled,
        responseSubject: "Away",
        responseBodyPlainText: message,
        restrictToContacts: false,
        restrictToDomain: false
      })
    });
    return;
  }

  await fetch("https://graph.microsoft.com/v1.0/me/mailboxSettings", {
    method: "PATCH",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      automaticRepliesSetting: {
        status: enabled ? "AlwaysEnabled" : "Disabled",
        internalReplyMessage: message,
        externalReplyMessage: message
      }
    })
  });
}
