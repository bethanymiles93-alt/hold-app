# Product bible: motion and colour

This is the durable reference for how Hold behaves emotionally through motion and colour — not a record of a single implementation pass, but the standing rule future changes should be checked against. See `docs/09-decision-log.md` for the dated decision that established this.

## Core design principle

Action screens are responsive. State screens are restful.

Tapping something (Going quiet, Reconnect) is a factual, almost mechanical act — it should feel quick and certain, not emotionally loaded in the moment. The emotional character of a transition belongs to the screen the user lands on and stays with, not to the transition itself. Nothing in this app should ask the user to sit through a slow, meaningful animation before it lets them do the next thing.

## Motion language

Motion draws on natural metaphors: settling, breathing, drawing inward, opening outward, sunrise, sunset. It never draws on technical or system metaphors: offline, disconnected, inactive, back online. If a proposed animation or piece of copy would read equally well describing a Wi-Fi icon, it's wrong for this app.

## Circle behaviour

The circle is, and stays, a single filled geometric shape. It does not open, split apart, turn into a scribble, or hug itself. State is communicated only through the values already available to a plain circle — scale, opacity, weight, and slow motion — never through changing what kind of shape it is.

## Going quiet

A short (200–350ms) inward settle: the circle scales down towards its resting Taking Time size. There is no long pause before navigation — the tap and the resulting screen change read as one continuous, quick motion.

## Taking time

The circle should read as settled, not shrunk-and-abandoned. Its resting scale is a single named constant (`QUIET_CIRCLE_SCALE`, currently `0.75` in `app/index.tsx`) — retuning the resting size is a one-line change, not a redesign. While resting, the circle carries an extremely subtle continuous breathing motion (a few percent of scale, slow, no sharp edges). Breathing is decorative, never load-bearing: Reduce Motion removes it entirely and nothing about understanding the app's state depends on it.

## Reconnect

Mirrors Going quiet: a gentle expand back to full size, in the same short duration. The feeling is "breathing out" or a sunrise, not an arrival — there is no bounce, overshoot, confetti, or celebration of any kind. Coming back is not an achievement to be congratulated; it's a return to normal.

## Colour system

There are two palettes layered over light/dark mode: **normal** (the app's everyday colours) and **quiet** (used while Taking Time — subtly warmer and richer, a golden-hour feeling, never orange or sepia-toned). The shift between them is a separate, slower transition from the tap animations above, triggered by arriving at or leaving the resting state rather than stapled to a tap — it should feel almost subconscious, like noticing the light changed, not like a UI repaint. Reconnect fades the same way, back towards daytime.

## Accessibility

- All four palette combinations (light-normal, light-quiet, dark-normal, dark-quiet) meet WCAG AA contrast: 4.5:1 for normal text, 3:1 for large text and UI elements.
- Both Light and Dark Mode are supported at the token level.
- Reduce Motion is respected everywhere: tap animations skip straight to navigation, the breathing loop doesn't start, and the colour fade becomes an instant snap instead of a transition.
- No animation is ever the only way to understand what state the app is in — text labels ("Taking time", "Going quiet") always carry that meaning on their own.
