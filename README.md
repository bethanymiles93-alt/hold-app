# Hold App

A calm, low-capacity communication app for protecting relationships when someone temporarily cannot communicate normally.

## What this repository contains

This is both:

1. a runnable Expo/React Native MVP scaffold; and
2. the app-specific technical specification needed to implement and test that MVP.

The broader product philosophy, market research, pricing research, design rationale and long-term strategy belong in the separate `hold-book` repository.

## MVP promise

- **Before:** Your people know.
- **During:** You can rest.
- **After:** Hold helps you return.

## Included journeys

### Create a Hold

1. Add the people who need to know.
2. Choose what they need to understand.
3. Review and edit a short message.
4. Open the device share sheet.
5. Finish with a calm completion state.

### Return from Hold

1. Add the people you want to reconnect with.
2. Choose how much you want to say.
3. Review and edit the message.
4. Open the device share sheet.
5. Finish without guilt or “overdue” language.

## Deliberately not included yet

- User accounts
- Cloud sync
- Automatic messaging
- Reading private conversations
- Contact-book upload
- Subscriptions
- Push notifications
- Analytics
- Live AI calls
- Relationship scores
- Clinical or crisis functionality

The first build uses local draft templates. A clearly bounded drafting service can later call a secure server-side AI endpoint without rewriting the user journey.

## Stack

- Expo SDK 57
- React Native 0.86
- React 19.2
- TypeScript
- Expo Router
- AsyncStorage for non-sensitive local draft state
- React Native's native `Share` API

## Requirements

- Node.js 22.13 or later
- npm
- Expo Go, an iOS simulator, or an Android emulator

## Run locally

```bash
npm install
npx expo start
```

Then scan the QR code with Expo Go or select a simulator.

## Quality checks

```bash
npm run typecheck
npm test
```

## Repository map

```text
app/                 File-based screens and navigation
src/components/      Reusable interface components
src/constants/       Copy, tokens and template choices
src/context/         Temporary flow state
src/services/        Drafting and sharing boundaries
src/storage/         Local persistence
src/types/           Shared TypeScript models
docs/                MVP, architecture, privacy and release notes
tests/               Pure logic tests
```

## Build rule

The app must pass the Hold Test before a feature ships:

- Does it reduce cognitive or emotional effort?
- Does it preserve or repair connection?
- Does it increase trust?
- Does it preserve user choice?
- Can someone use it at very low capacity?
- Is every collected datum necessary?
