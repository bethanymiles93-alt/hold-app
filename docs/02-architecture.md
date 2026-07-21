# Architecture

## Current shape

```text
Expo Router screens
        ↓
HoldFlowContext
        ↓
Draft service / Share service
        ↓
Local templates / Native OS share sheet
```

## Why local-first

The earliest version can test the product's core behaviour without accounts, backend storage or live AI. This reduces privacy risk and implementation cost.

## Boundaries

### Draft service

`src/services/draftService.ts` owns message-generation logic.

Current provider:
- curated local templates

Future provider:
- a secure server endpoint that calls an AI model

The screen must not call a model provider directly.

### Share service

`src/services/shareService.ts` owns OS sharing.

The app must not state that a message was delivered unless the platform can genuinely confirm it.

### Flow state

`HoldFlowContext` stores temporary in-session data.

Do not persist message content by default until a retention and encryption decision has been made.

## Future backend decision

Supabase remains a reasonable option for:

- authentication
- encrypted-at-rest database storage
- row-level security
- server-side functions
- account deletion workflows

It is intentionally absent from this MVP.

## Future services

Add only after validation:

- AI drafting endpoint
- optional secure sync
- subscriptions through RevenueCat
- privacy-preserving analytics
- crash reporting with content redaction
