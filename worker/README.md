# hold-ai-proxy

Server-side proxy for Hold's AI-assisted drafting (Hold+-only — gated
client-side in `draftService.ts`, never a free allowance). Holds the real
Anthropic API key, applies the per-surface system prompts from
`hold-book/06-privacy-security/02-ai-boundaries.md`, and enforces a
per-install monthly safety cap against runaway cost — none of which can
safely live in the mobile app itself.

Decision record: `hold-book/08-decisions/01-decision-log.md`.

## One-time setup

1. `npm install` (from this `worker/` directory).
2. `npx wrangler login` — opens a browser to link your Cloudflare account. Only you can do this step.
3. Get an Anthropic API key from console.anthropic.com (with billing set up) — never paste it into any file that gets committed.
4. `npm run kv:create` — creates the `AI_USAGE` KV namespace. Copy the resulting `id` into `wrangler.toml`'s `[[kv_namespaces]]` block.
5. Local dev secrets: copy `.dev.vars.example` to `.dev.vars` (gitignored) and fill in the real values.
6. Production secrets, once ready to deploy for real:
   - `npx wrangler secret put ANTHROPIC_API_KEY`
   - `npx wrangler secret put APP_CLIENT_KEY` (any long random string — generate one, don't reuse a password)

## Running locally

```
npm run dev
```

Serves on a local URL `wrangler` prints — point the app's dev config at it to test end-to-end before deploying.

## Deploying

```
npm run deploy
```

## What this does and doesn't do

- Does: receive `{ installId, surface, context }`, check that install's monthly count in KV, call Claude with the right system prompt for that surface, return `{ draft }`.
- Does not: log or persist message content anywhere, know who the user is (installId is a random per-install UUID, no name/phone number ever reaches this layer), or handle safeguarding/crisis-content classification (that's a separate, not-yet-built piece — see `06-privacy-security/03-safeguarding.md`).

## API

`POST /draft`, header `X-Hold-Client-Key: <APP_CLIENT_KEY>`, body:

```json
{
  "installId": "uuid",
  "surface": "going-quiet" | "reassurance" | "reconnect" | "conversations-reply",
  "context": { "intent": "...", "returnStyle": "...", "recipientLabel": "...", "friendMessage": "..." }
}
```

Responses: `{ draft, used, limit }` on success; `{ error: "rate_limited" | "timeout" | "provider_error" | "bad_request" | "unauthorized" }` otherwise, with the same non-AI local-template fallback in the app kicking in on any error.
