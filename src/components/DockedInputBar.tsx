import { useEffect, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useDockedAiAmend } from "@/hooks/useDockedAiAmend";
import { useHighlightedInsertions } from "@/hooks/useHighlightedInsertions";
import { DictationMicButton } from "@/components/DictationMicButton";
import { AiIdleNudge } from "@/components/AiIdleNudge";
import { CopyMessageLink } from "@/components/CopyMessageLink";
import { mixColors } from "@/utils/colorMix";
import { getSuggestedPhrases } from "@/services/suggestedPhrasesService";
import type { AiDraftContext, AiSurface } from "@/services/aiProxyClient";

// Reasoned approximations of the stock iOS keyboard's own backdrop colour —
// not sampled from a real device (there's no way to read the live keyboard's
// actual pixel colour from app code). Used only to blend the area outside
// the text pill toward "roughly what a system keyboard looks like" rather
// than the app's own background — confirm on-device whether this reads as
// continuous with the real keyboard, since it's an approximation, not a
// measurement. See docs/09-decision-log.md, 2026-08-11.
const KEYBOARD_BACKDROP_LIGHT = "#D1D3D6";
const KEYBOARD_BACKDROP_DARK = "#2C2C2E";

interface DockedInputBarProps {
  value: string;
  onChangeText: (text: string) => void;
  /** Commits and closes the bar — the field this bar is currently bound to has already been saving live via onChangeText, so this is just "I'm done," not a separate save step. */
  onDone: () => void;
  /**
   * Fires on keyboard-hide or tap-outside dismissal — anything that closes
   * the bar WITHOUT an explicit paper-plane tap. Defaults to `onDone` if not
   * given, matching every field's prior "just close" behaviour. A field that
   * needs dismiss-without-committing (new-Circle naming, where tapping
   * outside shouldn't create a Circle from a half-typed name) passes its own.
   * See docs/09-decision-log.md, 2026-08-11 — removes the old, separate
   * Add/Cancel buttons in favour of one generic mechanism every screen gets
   * for free.
   */
  onDismiss?: () => void;
  placeholder?: string;
  accessibilityLabel: string;
  /**
   * Present only for message-shaped content — omit for short label fields
   * (a Circle name, an account nickname), where AI-amend and dictation add
   * more friction than value. See docs/09-decision-log.md, 2026-08-10.
   */
  aiAmend?: { surface: AiSurface; context?: AiDraftContext; initialPrompt?: string };
  /**
   * Shown as their own row directly above the main input line, only while
   * the field is empty — tapping one submits immediately rather than typing
   * it out. Currently only Going Quiet's new-Circle name uses this. Plain
   * text words, not circles/chips (2026-08-11 correction — see decision
   * log: circle-shaped suggestion chips read as competing with the actual
   * Circle chips they're meant to help create).
   */
  suggestions?: { label: string; onPress: () => void }[];
  /**
   * Context-specific pills shown alongside (not instead of) the person's
   * own general suggested phrases — e.g. the apology wording for messaging
   * someone added via Reconnect's own "+", never the default. Purely
   * additive at render time, not written into suggestedPhrasesService's
   * own user-editable store. See docs/09-decision-log.md, 2026-08-20.
   */
  extraPhrases?: string[];
  /**
   * A Circle's own saved default message — present only where a caller
   * has one to offer (Going Quiet, Reconnect, Send an Update). Powers the
   * "Template"/"Remove template" button (2026-08-13): inserting is
   * non-destructive (alongside/below existing text, not a replace) and
   * renders green until edited, matching sentence-pill insertion exactly
   * — both go through the same `useHighlightedInsertions` mechanic.
   * Supersedes the separate "Change Template" control some screens used
   * to have (cut entirely, per direct instruction — sentence pills now
   * solve the same "I doubt my default wording" need). See
   * docs/09-decision-log.md.
   */
  template?: { text: string };
  /**
   * Mirrors the screen's own "Save to Library"/"Saved" control (left of
   * Template, matching DockedFieldPreview's inline box layout) so it's
   * reachable while actively typing, not only from the closed preview —
   * 2026-08-13, added after on-device testing found it present on the
   * inline box but missing entirely once the bar was open. `isSaved`
   * mirrors the caller's own saved-state check (e.g. `message ===
   * savedDefaultText`); labels default to Going Quiet's own wording,
   * override for a screen with different copy (Reconnect: "Save"/"Save
   * as template", "✓ Saved").
   */
  saveDefault?: {
    isSaved: boolean;
    onSave: () => void;
    unsavedLabel?: string;
    savedLabel?: string;
  };
  /**
   * A one-shot "insert this text as a highlighted, revert-on-edit block the
   * moment the bar is showing it" trigger — the exact same mechanic
   * Template's own button uses (`highlight.insertBlock`), just reachable
   * from outside this component. Fires once per distinct value (mirrors
   * `aiAmend.initialPrompt`'s own one-shot-effect shape). Built for
   * `MemoryNoteSuggestion`'s "Use it" (2026-08-21 correction) — a memory
   * note can be weeks stale, so it must land as clearly-marked,
   * still-editable inserted content, never as a silently pre-filled AI
   * prompt or as the box's raw starting value. See docs/09-decision-log.md.
   */
  pendingInsert?: string;
  /**
   * Bold in addition to the usual green highlight, until edited
   * (2026-09-01) — for a last-sent-message insert specifically ("show it
   * in bold until edited, distinct from the earlier no-bold-only-
   * signalling-for-selection-state rule — that's about state indication,
   * this marks inserted-vs-edited text"). Default false, so every other
   * `pendingInsert` caller (MemoryNoteSuggestion, etc.) is unaffected.
   */
  pendingInsertBold?: boolean;
  /**
   * Renders a "Copy message" secondary link below the Template/Save row —
   * see CopyMessageLink.tsx. Present only where a caller has a real
   * "message that gets sent" (group message, Reconnect message,
   * Personalise reply) — omit for label-shaped fields like a Circle name.
   * See docs/09-decision-log.md, 2026-08-31.
   */
  copyMessage?: boolean;
}

/**
 * The single, app-wide place free text is typed or edited — replaces every
 * screen's own in-page TextInput. Docked directly above the keyboard via
 * react-native-keyboard-controller's KeyboardStickyView (RN's own
 * InputAccessoryView doesn't render under this app's New Architecture
 * setup — see Screen.tsx). A screen renders exactly one of these, bound to
 * whichever field is currently "active" (see DockedFieldPreview) — the bar
 * itself is stateless about *what* it's editing, just how.
 *
 * Also where the Hold+-gated AI-assist trigger now lives, superseding the
 * old standalone AmendWithAI panel that sat inline below each message box
 * (2026-08-10 — see decision log for the explicit supersession).
 *
 * Shape (2026-08-11, corrected same day): one continuous rounded pill holds
 * the text input plus all three of its icons — AI-amend (sparkle, kept as
 * the icon choice: the established cross-industry convention for
 * "AI-powered action"), mic, and send — Instagram-style, not separate
 * elements in a row; AI-amend moved in from outside the pill after an
 * on-device pass found it sitting apart from the other two. Colour is
 * two-tier and was corrected a second time the same day after an on-device
 * pass found the first attempt read as uniformly too dark: inside the pill,
 * a lighter blend anchored to `onPrimary`/`primary` (light mode leans
 * toward white, dark mode toward the vivid accent green) so the pill reads
 * as a clearly lighter accent against its surround, paired with the theme's
 * own text colour (never a fixed white); outside the pill, a blend leaning
 * further toward an approximated keyboard-grey. Neither is a literal,
 * sampled Instagram value — this session has no way to read real pixels
 * from the Instagram app — both are reasoned adjustments targeting specific
 * on-device complaints, flagged as such in the decision log.
 */
export function DockedInputBar({
  value,
  onChangeText,
  onDone,
  onDismiss,
  placeholder,
  accessibilityLabel,
  aiAmend,
  suggestions,
  template,
  saveDefault,
  extraPhrases = [],
  pendingInsert,
  pendingInsertBold = false,
  copyMessage
}: DockedInputBarProps) {
  const { colors, isDark } = useAppTheme("normal");
  const styles = createStyles(colors, isDark);
  const highlight = useHighlightedInsertions(value, onChangeText);
  const inputScrollRef = useRef<ScrollView>(null);
  const amend = useDockedAiAmend(
    aiAmend?.surface,
    aiAmend?.context,
    value,
    onChangeText,
    aiAmend?.initialPrompt
  );

  const dismiss = onDismiss ?? onDone;

  const [savedPhrases, setSavedPhrases] = useState<string[]>([]);

  useFocusEffect(
    // Self-sourced, not a prop — the whole point is that this appears
    // above the docked bar app-wide with no per-screen wiring needed.
    // See docs/09-decision-log.md, 2026-08-13.
    () => {
      void getSuggestedPhrases().then(setSavedPhrases);
    }
  );

  const phrases = [...extraPhrases, ...savedPhrases];

  // Persists across a revert-by-edit (the button stays "Remove template",
  // now disabled) — only cleared by a successful explicit removal while
  // still green, which is the one case that should offer "Template"
  // again. See the docs/09-decision-log.md write-up for the full state
  // table this implements.
  const [templateBlockId, setTemplateBlockId] = useState<string | null>(null);
  const templateBlock = templateBlockId ? highlight.findBlock(templateBlockId) : undefined;
  const hasEverInsertedTemplate = templateBlockId !== null;

  // Typing its own onChangeText handler schedules this same call directly
  // (see the input's onChangeText below) — factored out so Template/pill
  // taps, which go through highlight.insertBlock/removeBlock directly
  // rather than that handler, still keep the newly-inserted text in view
  // instead of leaving it correctly in the data but scrolled out of
  // sight below the 5-line window. See docs/09-decision-log.md, 2026-08-13.
  const scrollToEndSoon = () => {
    requestAnimationFrame(() => inputScrollRef.current?.scrollToEnd({ animated: false }));
  };

  // One-shot: inserts pendingInsert as a highlighted block the moment it's
  // given a value, same path as Template/a pill tap. The effect's own
  // dependency array is what makes this one-shot — it only re-fires when
  // the caller passes a genuinely new string, e.g. a second memory note
  // (mirrors aiAmend.initialPrompt's own identical one-shot-effect shape,
  // same characteristic, never flagged as an issue there either).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!pendingInsert) return;
    highlight.insertBlock(pendingInsert, undefined, pendingInsertBold);
    scrollToEndSoon();
  }, [pendingInsert]);

  const onTemplatePress = () => {
    if (!template) return;

    if (hasEverInsertedTemplate && templateBlock) {
      highlight.removeBlock(templateBlock);
      setTemplateBlockId(null);
    } else if (!hasEverInsertedTemplate) {
      setTemplateBlockId(highlight.insertBlock(template.text));
      scrollToEndSoon();
    }
    // hasEverInsertedTemplate && !templateBlock: reverted-by-edit, button is disabled, no-op.
  };

  const onPillPress = (phrase: string) => {
    const existing = highlight.ranges.find((range) => value.slice(range.start, range.end) === phrase);
    if (existing) {
      highlight.removeBlock(existing);
    } else {
      highlight.insertBlock(phrase);
      scrollToEndSoon();
    }
  };

  // Closes the docked bar itself whenever the keyboard genuinely goes away
  // (scrolling the page away from the field, switching to another app,
  // backgrounding) — without this, a field like new-Circle naming would
  // need its own explicit Cancel button to avoid trapping the user in a
  // half-open bar. **Corrected 2026-09-01 — this comment used to justify
  // the mechanism as "mirrors Screen.tsx's own tap-outside-dismisses-the-
  // keyboard TouchableWithoutFeedback," which no longer exists** (removed
  // the same night, replaced with onScrollBeginDrag — see Screen.tsx and
  // docs/09-decision-log.md): tap-outside no longer dismisses the keyboard
  // at all, so that reasoning was stale, though the bar-closing behaviour
  // itself is still wanted for the cases above.
  //
  // **Real bug found and fixed 2026-09-01: tapping a suggestion pill (or
  // any Pressable inside this bar that isn't the TextInput itself) could
  // blur the TextInput just long enough to fire a real keyboardDidHide,
  // immediately closing the bar mid-tap — the insertion itself still
  // happened, but visually read as "pushes the keyboard down, bar left
  // half-collapsed," the pill looking broken even though highlight.insertBlock
  // ran correctly.** Debounced: a hide only actually closes the bar if no
  // matching show follows within DISMISS_DEBOUNCE_MS — a focus blip from
  // tapping something inside the bar re-shows the keyboard almost
  // immediately (the TextInput never really lost focus for more than a
  // frame or two), cancelling the pending dismiss; a genuine dismiss
  // (scrolled away, backgrounded) has no show event following it at all,
  // so it still closes exactly as before, just ~150ms later.
  //
  // Also still guarded on a real keyboardDidShow having actually fired for
  // THIS mount first (2026-08-30 fix, real on-device bug: "+ New Circle"
  // opened this bar then closed it again within about a second, on every
  // attempt) — this bar mixes react-native-keyboard-controller's own
  // keyboard tracking (KeyboardStickyView below) with React Native's
  // separate legacy Keyboard API for this one listener, a plausible source
  // of an out-of-order or spurious first "hide" right as the keyboard is
  // still animating in on a fresh mount.
  useEffect(() => {
    const DISMISS_DEBOUNCE_MS = 150;
    let hasShownKeyboard = false;
    let pendingDismiss: ReturnType<typeof setTimeout> | null = null;

    const showSubscription = Keyboard.addListener("keyboardDidShow", () => {
      hasShownKeyboard = true;
      if (pendingDismiss) {
        clearTimeout(pendingDismiss);
        pendingDismiss = null;
      }
    });
    const hideSubscription = Keyboard.addListener("keyboardDidHide", () => {
      if (!hasShownKeyboard) return;
      if (pendingDismiss) clearTimeout(pendingDismiss);
      pendingDismiss = setTimeout(() => {
        pendingDismiss = null;
        dismiss();
      }, DISMISS_DEBOUNCE_MS);
    });
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
      if (pendingDismiss) clearTimeout(pendingDismiss);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dismiss]);

  // Tracks the TextInput's real cursor/selection so dictation can insert at
  // wherever it was placed, not just at the end — RN won't respect a
  // position it isn't actively told to hold, so this has to be a controlled
  // `selection` prop, not just something read once.
  const [selection, setSelection] = useState({ start: 0, end: 0 });

  // Snapshotted on dictation start, then held fixed for the whole session:
  // `dictationBaseRef` is the pre-dictation text, `dictationRangeRef` is the
  // [start, end] within it that live results replace (initially the cursor
  // position, or the active selection if one existed — same as typing over
  // a selection would). Each live "result" event (interim or final) always
  // carries the full transcript-so-far for the utterance, not a delta, so
  // it's merged by slicing that same fixed base/range on every call rather
  // than appending. Re-anchored to a fresh collapsed range right after the
  // inserted text on each isFinal result, so a session producing more than
  // one settled phrase (a pause mid-dictation, on some platforms) keeps
  // accumulating forward instead of overwriting what was already settled.
  const dictationBaseRef = useRef("");
  const dictationRangeRef = useRef({ start: 0, end: 0 });

  const handleDictationStart = () => {
    dictationBaseRef.current = value;
    dictationRangeRef.current = selection;
  };

  const handleDictationResult = (text: string, isFinal: boolean) => {
    const base = dictationBaseRef.current;
    const { start, end } = dictationRangeRef.current;
    const merged = base.slice(0, start) + text + base.slice(end);

    // Routed through the highlight hook, not the raw onChangeText prop, so
    // an existing green Template/pill block elsewhere in the text gets its
    // range correctly shifted (rangesAfterEdit) if dictation inserts before
    // or around it — a real edge case pure end-appending never hit, since
    // nothing can sit after "the end."
    highlight.handleChangeText(merged);

    const cursor = start + text.length;
    setSelection({ start: cursor, end: cursor });

    if (isFinal) {
      dictationBaseRef.current = merged;
      dictationRangeRef.current = { start: cursor, end: cursor };
    }
  };

  return (
    <KeyboardStickyView>
      <SafeAreaView edges={["left", "right"]} style={styles.safe}>
        {amend.open ? (
          <View style={styles.amendRow}>
            <TextInput
              accessibilityLabel="Context for AI amend"
              onChangeText={amend.setPrompt}
              placeholder="Add context for AI, or leave blank"
              placeholderTextColor={colors.textMuted}
              style={styles.amendInput}
              value={amend.prompt}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={amend.status === "loading" ? "Generating" : "Generate with AI"}
              disabled={amend.status === "loading"}
              hitSlop={8}
              onPress={() => void amend.generate()}
              style={({ pressed }) => [
                styles.amendGo,
                amend.status === "loading" && styles.amendGoDisabled,
                pressed && styles.pressed
              ]}
            >
              <Ionicons name="sparkles" size={16} color={colors.onPrimary} />
            </Pressable>
          </View>
        ) : null}

        {amend.status === "error" ? (
          <Text style={styles.errorText}>Couldn't reach AI right now — try again.</Text>
        ) : null}

        {/* Free-tier AI-discovery nudge (2026-08-30) — only ever shown
            where an AI-amend surface exists at all (aiAmend present) and
            the person isn't Hold+ (amend.available is false for free
            users; the existing sparkle icon below already covers Hold+
            subscribers, unchanged). See AiIdleNudge's own comment. */}
        {aiAmend && !amend.available ? <AiIdleNudge value={value} /> : null}

        {/* Sentence-suggestion pills — app-wide via this one shared
            component, no per-screen wiring needed (2026-08-13). Tight
            sizing around their own text, matching the app's true-circle/
            pill discipline elsewhere, not stretched ovals. Insertion uses
            the same green-highlight/revert-on-edit mechanic as the
            Template button below the message box — tapping an already-
            inserted-and-still-green pill again removes it cleanly. See
            docs/09-decision-log.md. */}
        {phrases.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.phraseRow}>
            {phrases.map((phrase) => {
              const isInserted = highlight.ranges.some((range) => value.slice(range.start, range.end) === phrase);
              return (
                <Pressable
                  key={phrase}
                  accessibilityRole="button"
                  accessibilityLabel={phrase}
                  onPress={() => onPillPress(phrase)}
                  style={({ pressed }) => [styles.phrasePill, isInserted && styles.phrasePillActive, pressed && styles.pressed]}
                >
                  <Text style={[styles.phrasePillText, isInserted && styles.phrasePillTextActive]}>{phrase}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        {suggestions && suggestions.length > 0 && !value.trim() ? (
          <View style={styles.suggestionsRow}>
            {suggestions.map((suggestion, index) => (
              <View key={suggestion.label} style={styles.suggestionItem}>
                {index > 0 ? <View style={styles.suggestionDivider} /> : null}
                <Pressable
                  accessibilityRole="button"
                  onPress={suggestion.onPress}
                  hitSlop={8}
                  style={({ pressed }) => pressed && styles.pressed}
                >
                  <Text style={styles.suggestionText}>{suggestion.label}</Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.row}>
          <View style={styles.pill}>
            {amend.available ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={amend.open ? "Close AI amend" : "Amend with AI"}
                accessibilityState={{ expanded: amend.open }}
                onPress={amend.toggle}
                hitSlop={8}
                style={({ pressed }) => [styles.pillIconButton, pressed && styles.pressed]}
              >
                <Ionicons
                  name={amend.open ? "sparkles" : "sparkles-outline"}
                  size={20}
                  color={amend.open ? colors.primary : colors.textMuted}
                />
              </Pressable>
            ) : null}

            {/* Green-highlight rendering (2026-08-13): RN's TextInput has
                no rich-text mode — no way to colour part of an editable
                value while it stays one real, focusable, IME-correct
                input. This is the standard workaround: a non-interactive
                Text underneath, styled identically to the real input
                (same font/size/line-height/padding, spread from the same
                `styles.input`), rendering the value with green spans;
                the real TextInput sits on top with its own glyphs made
                transparent so only the overlay's colours actually show,
                while the cursor (`cursorColor`) and all real touch/IME/
                selection behaviour stay on the genuine input.
                Scroll architecture rewritten 2026-08-13, second attempt —
                the first fix (a separate overlay ScrollView mirroring the
                real TextInput's onScroll offset) was confirmed broken
                on-device: content got visibly corrupted/overlapping right
                at the scroll boundary, not just late. Root cause: RN's
                onScroll doesn't fire reliably (or fires late) for a
                multiline TextInput's own *auto*-scroll-to-cursor while
                typing, as opposed to a manual drag — a documented gap,
                not something a retry of the same relay would fix.
                Replaced the two-scroller-kept-in-sync design with one
                shared ScrollView: the TextInput now has NO maxHeight of
                its own (grows to its full natural height, unbounded,
                same as any other text), and both it and the overlay sit
                as ordinary children inside one outer ScrollView capped at
                ~5 lines — they move together by construction, since
                there is only one scroll position now, not two to keep
                aligned. `scrollToEnd()` (via the shared `scrollToEndSoon`
                helper) fires after every change — typed, or a Template/
                pill insertion, which go through `highlight.insertBlock`
                directly rather than this handler and would otherwise
                leave newly-inserted text correctly in the data but
                scrolled out of view — deferred one frame so it reads the
                TextInput's already-updated height rather than the stale
                one, correctly keeping the latest content in view while
                composing forward. Known, accepted limitation: this
                doesn't specially handle tapping to position the cursor
                mid-text and expecting the view to jump there — it always
                settles back to the end. See docs/09-decision-log.md. */}
            <View style={styles.inputStack}>
              <ScrollView ref={inputScrollRef} showsVerticalScrollIndicator={false}>
                <View style={styles.inputInner}>
                  {/* Native placeholder rendering is untouched — placeholderTextColor
                      is independent of the real TextInput's own (transparent)
                      text colour below, so it still shows normally when value
                      is empty; nothing to duplicate in the overlay. */}
                  <Text style={[styles.input, styles.inputOverlay]} pointerEvents="none">
                    {highlight.segments.map((segment, index) => (
                      <Text
                        key={index}
                        style={[segment.green && styles.greenText, segment.bold && styles.boldText]}
                      >
                        {segment.text}
                      </Text>
                    ))}
                  </Text>
                  <TextInput
                    accessibilityLabel={accessibilityLabel}
                    autoFocus
                    multiline
                    onChangeText={(text) => {
                      highlight.handleChangeText(text);
                      scrollToEndSoon();
                    }}
                    onSelectionChange={(event) => setSelection(event.nativeEvent.selection)}
                    placeholder={placeholder}
                    placeholderTextColor={colors.textMuted}
                    cursorColor={colors.text}
                    style={[styles.input, styles.inputTransparent]}
                    selection={selection}
                    value={value}
                  />
                </View>
              </ScrollView>
            </View>

            <DictationMicButton onResult={handleDictationResult} onStart={handleDictationStart} />

            {/* Save, icon-only, immediately left of Send — reworked
                2026-08-31 per the "icon-only wherever a genuinely
                universal symbol exists" rule (Send, Save, Copy, Paste;
                Template stays text-labelled, no single recognisable
                symbol for "insert a template"). Was a text link in the
                Template/Save footer row below; moved up here, into the
                same bottom-right cluster as Send, since both are the
                two actions someone reaches for at the actual moment of
                finishing composing. Outline/filled icon swap for
                unsaved/saved, same convention Template's own book icon
                already uses. See docs/09-decision-log.md. */}
            {saveDefault ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={saveDefault.isSaved ? (saveDefault.savedLabel ?? "Saved") : (saveDefault.unsavedLabel ?? "Save")}
                accessibilityState={{ disabled: saveDefault.isSaved }}
                disabled={saveDefault.isSaved}
                onPress={saveDefault.onSave}
                hitSlop={8}
                style={({ pressed }) => [styles.saveButton, pressed && styles.pressed]}
              >
                <Ionicons
                  name={saveDefault.isSaved ? "checkmark-circle" : "save-outline"}
                  size={20}
                  color={saveDefault.isSaved ? colors.textMuted : colors.link}
                />
              </Pressable>
            ) : null}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Done"
              onPress={onDone}
              hitSlop={8}
              style={({ pressed }) => [styles.doneButton, pressed && styles.pressed]}
            >
              <Ionicons name="send" size={20} color={colors.onPrimary} style={styles.doneIcon} />
            </Pressable>
          </View>
        </View>

        {/* Template, directly beneath the message box, part of this same
            bar — NOT a separate row stacked above the keyboard with the
            pills/suggestions (2026-08-13 fix: it originally sat up
            there, and on-device it read as a standalone floating
            banner, not part of the input). Save moved out of this row
            2026-08-31 (see above) — Template now renders alone, left-
            aligned via the same empty-View-on-the-right spacer this row
            already used whenever only one of the pair was present, so
            it doesn't drift to centre now that it's the only occupant. */}
        {template ? (
          <View style={styles.footerRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={hasEverInsertedTemplate ? "Remove template" : "Template"}
              accessibilityState={{ disabled: hasEverInsertedTemplate && !templateBlock }}
              disabled={hasEverInsertedTemplate && !templateBlock}
              onPress={onTemplatePress}
              hitSlop={8}
              style={({ pressed }) => [
                styles.templateRow,
                hasEverInsertedTemplate && !templateBlock && styles.templateRowDisabled,
                pressed && styles.pressed
              ]}
            >
              <Ionicons
                name={hasEverInsertedTemplate ? "book" : "book-outline"}
                size={16}
                color={hasEverInsertedTemplate && !templateBlock ? colors.textMuted : colors.link}
              />
              <Text
                style={[
                  styles.templateText,
                  hasEverInsertedTemplate && !templateBlock ? styles.templateTextDisabled : null
                ]}
              >
                {hasEverInsertedTemplate ? "Remove template" : "Template"}
              </Text>
            </Pressable>
            <View />
          </View>
        ) : null}

        {/* Copy — NOT yet repositioned to "top-right, clustered with
            Paste" per the 2026-08-31 layout instruction. Left as-is
            (below, centred) rather than guessed at in isolation: this
            box has no Paste button to cluster it with at all (Paste
            exists today only in PersonaliseAccordion's own 1:1-reply
            box, a different component, for a different purpose —
            pasting in a friend's message). Moving Copy alone to a
            corner it's not actually paired with anything in would be
            guessing at a layout the instruction didn't specify for this
            case. Flagged, not built. See docs/09-decision-log.md. */}
        {copyMessage ? <CopyMessageLink value={value} /> : null}
      </SafeAreaView>
    </KeyboardStickyView>
  );
}

function createStyles(colors: ThemeColors, isDark: boolean) {
  // Inside the pill (2026-08-11, second correction — the prior pass's
  // surfaceStrong+border blend read as "too dark" on-device in dark mode,
  // where both source tokens are themselves fairly dark, leaving no visible
  // lightness contrast between the pill and its surroundings). Light mode:
  // surfaceStrong (already pale) blended further toward onPrimary (white,
  // an existing token, not invented) for a subtle near-white mint wash,
  // closer to how pale Instagram's own light-mode composer pill reads. Dark
  // mode: primary (the vivid accent green, not the dark tokens used
  // elsewhere) blended toward surfaceStrong, so the pill reads as a clearly
  // lighter, more saturated accent sitting on a darker surround — the
  // relationship Instagram's own dark-mode pill has to its background,
  // which the previous value inverted (pill and surround were nearly the
  // same darkness). Still not a literal Instagram colour match — this
  // session has no way to sample real pixels from the Instagram app; it's a
  // reasoned adjustment targeting the two specific on-device complaints
  // ("outside too dark," "pill too dark"), not a verified sample. See
  // docs/09-decision-log.md, 2026-08-11.
  const pillFill = isDark
    ? mixColors(colors.primary, colors.surfaceStrong, 0.35)
    : mixColors(colors.surfaceStrong, colors.onPrimary, 0.55);
  // Outside the pill (the bar's own backdrop + suggestion row): blended
  // toward the approximated keyboard grey, weighted slightly more toward it
  // than the prior pass (0.3 → 0.25 pill-fill weight) so the outer area
  // reads closer to a neutral keyboard-like grey and further from the
  // (now lighter, more saturated) pill fill above — reinforcing rather than
  // undoing the pill/surround contrast this correction is trying to
  // establish. Same "reasoned approximation, not sampled" caveat as above.
  const keyboardBackdrop = isDark ? KEYBOARD_BACKDROP_DARK : KEYBOARD_BACKDROP_LIGHT;
  const barFill = mixColors(pillFill, keyboardBackdrop, 0.25);

  return StyleSheet.create({
    safe: {
      backgroundColor: barFill,
      // No top border (2026-08-11 correction — the prior pass's "thicker,
      // darker-green border" read as a jarring, heavy line on-device).
      // Rounded top corners instead, to read as a soft merge with the
      // keyboard's own top edge rather than a hard-edged panel dropped on
      // top of it. Reduced from 24pt (theme.radius.lg) to 10pt
      // (theme.radius.sm) the same day, later — the larger radius read as
      // too aggressively curved on-device, and (combined with the icons
      // now sitting at the top of the pill just inside it) visually
      // clipped against the icons near the bar's own top corners. Still a
      // reasoned choice, not a measured value. See docs/09-decision-log.md.
      borderTopLeftRadius: theme.radius.sm,
      borderTopRightRadius: theme.radius.sm,
      paddingHorizontal: theme.spacing.sm,
      paddingTop: theme.spacing.sm,
      gap: theme.spacing.xs
    },
    row: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: theme.spacing.xs,
      paddingBottom: theme.spacing.sm
    },
    // One continuous rounded shape holding the text input and all three of
    // its icons (AI-amend, mic, send) — Instagram-style, not separate
    // elements in a row. borderRadius uses the pill token throughout; on a
    // multi-line-grown tall box this still reads as a fully-rounded
    // (stadium) shape at whatever height the text has grown to. Icons sit
    // at the TOP of the pill, following the curve of its rounded top edge
    // (2026-08-11 correction — they previously sat at the bottom, where the
    // outer two clipped/overlapped the pill's own rounded corner; extra
    // top padding here gives them clearance from that curve). See
    // docs/09-decision-log.md.
    pill: {
      flex: 1,
      flexDirection: "row",
      alignItems: "flex-start",
      minHeight: 44,
      // Raised from 132 alongside inputStack's own 105→147 (5→7 lines,
      // 2026-08-13) — this outer cap has to comfortably clear
      // inputStack's own maxHeight plus this pill's and the input's own
      // padding (≈28pt combined), or the 7th line gets clipped by this
      // container regardless of inputStack's own height being correct.
      maxHeight: 190,
      // Corner radius reduced from theme.radius.pill (999, full stadium
      // rounding) to a small, subtle curve (2026-09-01) — reuses the
      // existing sm token rather than inventing a new one.
      borderRadius: theme.radius.sm,
      backgroundColor: pillFill,
      paddingLeft: theme.spacing.md,
      paddingRight: theme.spacing.md,
      paddingTop: theme.spacing.sm,
      paddingBottom: theme.spacing.xs
    },
    // No maxHeight here (2026-08-13 scroll rewrite) — neither the overlay
    // nor the real TextInput are height-constrained individually anymore;
    // both grow to their full natural height and the capping/scrolling
    // happens once, at inputStack below, via a single shared ScrollView.
    input: {
      flex: 1,
      minHeight: 32,
      paddingHorizontal: theme.spacing.xs,
      paddingVertical: theme.spacing.xs,
      // The theme's own text colour, not a fixed literal — near-black in
      // light mode, near-white in dark mode, matching whichever fill this
      // sits on in that mode. Recomputed against the corrected, lighter
      // pill fill above (2026-08-11): light-normal (pill ≈ #eaefeb, text
      // #242825) ≈ 12.8:1; dark-normal (pill ≈ #4b5e4e, text #edefe8) ≈
      // 6.0:1 — both still comfortably past WCAG AA's 4.5:1, though the
      // dark-mode margin is now smaller than the previous value's 9.2:1, a
      // direct, reported trade-off of deliberately lightening the pill for
      // the "too dark" fix above. Not verified on a live device — computed
      // from the theme's own defined hex values. See
      // docs/09-decision-log.md, 2026-08-11.
      color: colors.text,
      fontSize: 16,
      lineHeight: 21
    },
    // Caps the whole input at ~7 lines (21pt line-height × 7, up from 5
    // per direct instruction, 2026-08-13), then scrolls — the single
    // shared ScrollView that replaced the two-scroller sync attempt. See
    // the long comment at the call site. Manual drag-scroll through the
    // full typed history works unconditionally (scrollEnabled is never
    // set false) — auto-follow-to-end only fires from onChangeText/
    // scrollToEndSoon, not from the ScrollView itself, so a manual scroll
    // away from the bottom is never fought while the person isn't
    // actively typing.
    inputStack: {
      flex: 1,
      maxHeight: 147
    },
    // Wraps the overlay + real TextInput together as ordinary (non-
    // absolutely-positioned-relative-to-the-scroll-cap) siblings inside
    // the ScrollView's own content — position: relative only so the
    // overlay (absolute within *this*) can stack directly on top of the
    // TextInput, not so this View itself gets clipped; the ScrollView
    // one level up is what actually caps/scrolls.
    inputInner: {
      position: "relative"
    },
    // top+bottom together give this absolutely-positioned overlay a
    // determinate height matching inputInner's own — driven by the real
    // TextInput, its one normal-flow sibling, which is exactly what's
    // wanted: the overlay always ends up the same size as the real input
    // since both render the same text at the same style.
    inputOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0
    },
    // Only the real input's own colour is overridden — everything else
    // (padding, font, line-height) stays shared with the overlay via the
    // same base `input` style, which is what keeps the two aligned.
    inputTransparent: {
      color: "transparent"
    },
    greenText: {
      color: colors.primary
    },
    boldText: {
      fontWeight: "700"
    },
    // justifyContent: "space-between", matching DockedFieldPreview's own
    // identical fix — Save always lands left, Template always lands
    // right, regardless of which single one happens to be present.
    footerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingBottom: theme.spacing.xs
    },
    savedPill: {
      minHeight: 28,
      borderRadius: theme.radius.pill,
      paddingHorizontal: theme.spacing.sm,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceStrong
    },
    savedPillText: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: "600"
    },
    templateRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4
    },
    templateRowDisabled: {
      opacity: 0.5
    },
    // fontSize 17, not the smaller 14 used for chip labels elsewhere — the
    // app-wide established body/accessible text size, matching
    // DockedFieldPreview's own valueText/placeholderText (the same kind
    // of message-content text), per direct instruction not to assume a
    // smaller size is inherited correctly here. See docs/09-decision-log.md.
    templateText: {
      color: colors.link,
      fontSize: 17,
      fontWeight: "600"
    },
    templateTextDisabled: {
      color: colors.textMuted
    },
    phraseRow: {
      flexDirection: "row",
      gap: theme.spacing.xs,
      paddingBottom: theme.spacing.xs
    },
    // Tight around the text — no extra padding stretching these into
    // ovals/bars, matching the app's true-circle/pill sizing discipline
    // elsewhere (AdaptiveCircleChip). See docs/09-decision-log.md,
    // 2026-08-13.
    // theme.radius.sm (gentle, matching this bar's own corner rounding),
    // not theme.radius.pill (999, full stadium) — 2026-08-13 fix: the
    // full pill radius was visibly clipping content inside these
    // specifically. Scoped to sentence-suggestion pills only, not
    // AdaptiveCircleChip's Circle-selection pills/chips elsewhere.
    phrasePill: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: theme.radius.sm,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 4
    },
    phrasePillActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary
    },
    phrasePillText: {
      color: colors.text,
      fontSize: 17,
      fontWeight: "600"
    },
    phrasePillTextActive: {
      color: colors.onPrimary
    },
    // Sized to sit comfortably inside the pill alongside the mic/send
    // icons — visually more compact than the 44pt tap-target floor, so
    // hitSlop (set at each call site) restores an effectively ≥44pt hit
    // area without inflating the pill's own visual height.
    pillIconButton: {
      width: 28,
      height: 28,
      alignItems: "center",
      justifyContent: "center"
    },
    doneButton: {
      width: 36,
      height: 36,
      borderRadius: theme.radius.pill,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center"
    },
    saveButton: {
      width: 36,
      height: 36,
      alignItems: "center",
      justifyContent: "center"
    },
    // Same optical-centring nudge as CompactSendButton's own paper-plane —
    // the glyph itself leans right, uncorrected.
    doneIcon: {
      marginLeft: 2
    },
    pressed: {
      opacity: 0.7
    },
    suggestionsRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      paddingBottom: theme.spacing.xs
    },
    suggestionItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm
    },
    // A thin vertical rule between words, not a chip/pill background of any
    // kind — plain text list, per 2026-08-11's correction.
    suggestionDivider: {
      width: StyleSheet.hairlineWidth,
      height: 18,
      backgroundColor: colors.border
    },
    suggestionText: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "600"
    },
    amendRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
      paddingTop: theme.spacing.xs
    },
    amendInput: {
      flex: 1,
      minHeight: 40,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: theme.radius.sm,
      paddingHorizontal: theme.spacing.sm,
      color: colors.text,
      fontSize: 14,
      backgroundColor: colors.background
    },
    amendGo: {
      width: 40,
      height: 40,
      borderRadius: theme.radius.pill,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center"
    },
    amendGoDisabled: {
      opacity: 0.5
    },
    errorText: {
      color: colors.error,
      fontSize: 13,
      paddingHorizontal: theme.spacing.xs
    }
  });
}
