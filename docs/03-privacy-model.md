# MVP privacy model

## Data used in the current build

- display names, either typed manually ("Thoughtful reply") or drawn from a saved Circle
- selected intent
- editable draft text
- selected return style

These values are held in application memory for the current flow. Circle membership itself is persisted — see "Your Circle" below, which is a distinct, more sensitive exception from everything else on this page.

## Data not collected

- full contact book
- email addresses
- conversation histories
- diagnoses
- location
- recipient activity
- message-open status
- advertising identifiers
- account credentials

Phone numbers were originally on this list, but are no longer accurate as a blanket claim: see "Your Circle" below for the one narrow, explicit-selection exception, and how it differs from bulk collection.

## Sharing

The app passes the reviewed text to the operating system's share sheet. The user then chooses the destination.

## Known limitation

A name entered in Hold is a planning aid; the native share sheet does not automatically map that name to a recipient. The user must still select the intended recipient in the destination app.

## Thoughtful reply: a narrow, time-boxed exception

The default Return experience (Instant message) follows the same in-memory-only rule as the rest of this document — nothing is saved.

"Thoughtful reply" is the one deliberate exception, because its content must survive the user leaving Hold to paste and send a reply in another app. This is a suspension bridge, not a saved-drafts feature, and it is scoped narrowly:

- **What's stored:** the pasted-in message from the other person, the drafted reply, and the recipient's display name — only for messages the user has actively chosen to draft via "Thoughtful reply."
- **Where:** device-level encrypted storage (Keychain on iOS, Keystore-backed encrypted storage on Android, via `expo-secure-store`), never transmitted off-device.
- **How long:** a user-chosen bridge window, 1–13 hours, defaulting to 8.
- **Deletion:** removed automatically the moment the user marks that message as sent, or the moment its window expires — whichever happens first. In the current build, expiry is checked when the app is opened or brought to the foreground, not by a guaranteed background timer, so an expired record may remain at rest (still encrypted) until the app is next opened.
- **Confirmation:** a calm on-screen notice ("Cleared from your device.") appears once a message is removed, whether by user action or expiry.
- **Independence:** each message is tracked and deleted separately — clearing one never affects any other in-progress reply.

This exception does not loosen the "Before adding persistence" checklist below for any *other* persistence feature. By design, it already satisfies some of that checklist on its own — retention schedule (the window itself), deletion design (the two triggers above), and plain-language user notice (this section plus the in-app confirmation copy) — but a data map, lawful-basis analysis, processor review, threat model and DPIA screening specific to this feature are still worth a lightweight pass before wider release.

## Quiet History: a deliberate, indefinite-retention exception

Unlike "Thoughtful reply," this one does not self-clear — that's the point of it. It is a separate persistence decision, made explicitly at the product owner's direction, and it is exactly the kind of thing `docs/06-roadmap.md` flags under "not on roadmap without new evidence" ("recipient tracking"). It's recorded here in full rather than folded into the Thoughtful-reply exception above, so the gap between what this document originally scoped and what the app now does stays honest and visible.

- **What's stored:** for each completed Hold period — the recipient names entered when that Hold was created (frozen at that moment, not linked to any later edits), and the start and end timestamps.
- **Why:** so the user can notice their own patterns if they choose to. The app performs no correlation, tagging, labelling, or interpretation of this data — it is a plain factual record, nothing more.
- **Where:** the same device-level encrypted storage as "Thoughtful reply" (`expo-secure-store`), never transmitted off-device.
- **When a period starts and ends:** a period starts the moment a Hold message is actually shared, and ends the moment the user actually completes a return — sending the instant message, or marking a Thoughtful reply as sent. Merely opening "Return from Hold" does not end it, so the Home screen correctly still shows "Taking time" if the user backs out of that flow without sending anything.
- **Retention:** indefinite. There is no automatic expiry. The user can delete individual entries from Settings → Your Hold history; there is currently no "clear all" action.
- **Known limitation:** if a new Hold is started while a previous one is still open (never returned from), the earlier one is not automatically closed and will not appear in history until it is.

This exception does **not** meet the "Before adding persistence" checklist below on its own — retention is open-ended by design, so there is no fixed retention schedule to point to, and no lawful-basis, data-map, threat-model or DPIA work has been done for it. It is being shipped ahead of that work at explicit product direction, not because the checklist has been satisfied.

## Your Circle: real contact details, and why this one is different

Everything documented above is either transient or a planning aid — a name typed by the user is not linked to any real person's record. Your Circle breaks that pattern: it stores **real names and real phone numbers**, taken from the user's actual address book, so a saved Circle can be texted directly. That makes this **meaningfully more sensitive than anything else Hold currently stores**, and it is called out on its own rather than folded into the exceptions above.

- **What's stored:** for each contact added to a saved Circle — their name and phone number, exactly as returned by the system contact picker. Nothing else the picker or the OS could offer (email, photo, notes, birthday, other numbers not chosen) is ever read or stored.
- **How it's obtained:** only via the native system contact picker (`CNContactPickerViewController` on iOS, wrapped by `expo-contacts`' picker-only API). The picker hands the picked contact's data straight back to Hold as part of presenting its own system UI — Hold's code never calls `requestPermissionsAsync()` and never gets standing, bulk, or ongoing access to the address book. Each contact is added one at a time, by explicit user action.
- **Where:** the same device-level encrypted storage as the exceptions above (`expo-secure-store`), never transmitted off-device.
- **Retention:** indefinite, same as Quiet History — a contact stays in a Circle until the user removes them, and a Circle stays until the user deletes it (Close Circle itself can't be deleted, only emptied). There is no automatic expiry.
- **Why it exists:** to let the user text a saved Circle directly from Hold instead of retyping names and manually addressing a message every time.
- **Known platform nuance:** on Android, `expo-contacts`' config plugin declares `READ_CONTACTS`/`WRITE_CONTACTS` manifest permissions even though Hold's own code never requests them at runtime — worth flagging in any store-listing/data-safety review, since a manifest permission and an actual runtime request read very differently to a reviewer.

**This must not go live publicly without a dedicated privacy/DPIA review that specifically covers stored contact data** — not just a pass through the general checklist below. Real names and phone numbers tied to real people carry different legal and harm considerations than the planning-aid text and self-reported history elsewhere in this document, and deserve their own sign-off before wider release, independent of whether the rest of the app has cleared its checklist.

## Before adding persistence

Complete:

- data map
- lawful-basis analysis
- retention schedule
- deletion design
- processor review
- threat model
- DPIA screening
- plain-language user notice

The three exceptions above (Thoughtful reply, Quiet History, Your Circle) were each shipped ahead of this checklist being fully satisfied, at explicit product direction — see each section for exactly what is and isn't covered. Your Circle in particular should be treated as blocked on a dedicated review, not just noted, before any public release.
