# MVP privacy model

## Data used in the current build

- manually entered display names
- selected intent
- editable draft text
- selected return style

These values are held in application memory for the current flow.

## Data not collected

- full contact book
- phone numbers
- email addresses
- conversation histories
- diagnoses
- location
- recipient activity
- message-open status
- advertising identifiers
- account credentials

## Sharing

The app passes the reviewed text to the operating system's share sheet. The user then chooses the destination.

## Known limitation

A name entered in Hold is a planning aid; the native share sheet does not automatically map that name to a recipient. The user must still select the intended recipient in the destination app.

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
