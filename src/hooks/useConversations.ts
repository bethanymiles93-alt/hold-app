import { useCallback, useState } from "react";
import {
  addPerson,
  getAll as getAllConversationPeople,
  markQuickSent,
  seedPersonaliseRecipient,
  toggleComplete,
  type ConversationPerson
} from "@/services/conversationService";
import { addContactToGroup, createGroup } from "@/services/circleService";
import { clearReachedVia, getReconnectingPeriod, recordReachedVia } from "@/services/holdHistoryService";
import { pickContact } from "@/services/contactPickerService";
import { sendOrShare } from "@/services/smsService";
import { QUICK_RECONNECT_MESSAGES } from "@/constants/copy";
import type { ReturnStyle } from "@/types/hold";

export const DEFAULT_QUICK_MESSAGE = QUICK_RECONNECT_MESSAGES[0]?.text ?? "";

/**
 * Who this instance shows — `"all"` for Library's own standalone
 * Conversations tab (unscoped, everyone ever added), or a specific set of
 * candidates for an embedded, period-scoped view (Reconnect's own
 * "want to reply to anyone properly?" step). Candidates are seeded into
 * conversationService's store idempotently (matches the existing
 * usePersonaliseCompletion.seedAndLoad behaviour, now generalised) —
 * harmless to re-seed someone already there.
 */
export type ConversationsScope =
  | "all"
  | { candidates: { name: string; phoneNumber: string; circleId: string; circleName: string }[] };

export interface CircleSection {
  circleId: string;
  circleName: string;
  people: ConversationPerson[];
}

function groupByCircle(people: ConversationPerson[]): CircleSection[] {
  const sections: CircleSection[] = [];
  const indexByCircleId = new Map<string, number>();

  for (const person of people) {
    if (!person.circleId) continue;

    let index = indexByCircleId.get(person.circleId);
    if (index === undefined) {
      index = sections.length;
      indexByCircleId.set(person.circleId, index);
      sections.push({ circleId: person.circleId, circleName: person.circleName ?? "Circle", people: [] });
    }

    sections[index]?.people.push(person);
  }

  return sections;
}

export type ConversationsActiveField = `individual-message:${string}` | "new-circle";

export interface PersonaliseReplyTarget {
  personId: string;
  onChangeText: (text: string) => void;
  friendMessage: string;
}

/**
 * The single Conversations implementation — extracted 2026-08-20 from
 * `library.tsx`'s own Conversations tab so a period-scoped embedding
 * (Reconnect's own "want to reply to anyone properly?" step) and Library's
 * standalone view are genuinely the same component reading the same query
 * logic, not two implementations independently reading the same
 * `conversationService` store. Two entry points showed a different "what's
 * pending" picture depending on which one was used — a real trust problem
 * for someone relying on Hold to keep things organised at low capacity,
 * not just an architectural inconsistency. See docs/09-decision-log.md.
 *
 * `onPersonAction` is an optional hook for screen-specific side effects a
 * send/complete/mark should trigger beyond this hook's own state — e.g.
 * Reconnect's own `recordReconnectStepReached("personalise_completed")`,
 * which has no meaning for Library's standalone use and so isn't baked in
 * here.
 */
export function useConversations(scope: ConversationsScope, onPersonAction?: () => void) {
  const [people, setPeople] = useState<ConversationPerson[]>([]);
  const [expandedCircleIds, setExpandedCircleIds] = useState<Set<string>>(new Set());
  const [expandedPersonaliseId, setExpandedPersonaliseId] = useState<string | null>(null);
  const [personaliseDrafts, setPersonaliseDrafts] = useState<Record<string, string>>({});
  const [personaliseStyles, setPersonaliseStyles] = useState<Record<string, ReturnStyle>>({});
  const [personaliseReplyTarget, setPersonaliseReplyTarget] = useState<PersonaliseReplyTarget | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [individualMessages, setIndividualMessages] = useState<Record<string, string>>({});
  const [personaliseSwapIds, setPersonaliseSwapIds] = useState<Set<string>>(new Set());
  /** See docs/09-decision-log.md, 2026-08-19 — the permission-to-stop line. */
  const [stopPermissionShown, setStopPermissionShown] = useState(false);
  const [selectedOtherIds, setSelectedOtherIds] = useState<Set<string>>(new Set());
  const [circlePromptStage, setCirclePromptStage] = useState<"none" | "confirm" | "naming">("none");
  const [newOtherCircleName, setNewOtherCircleName] = useState("");
  const [activeField, setActiveField] = useState<ConversationsActiveField | null>(null);

  const refresh = useCallback(async () => {
    if (scope !== "all") {
      for (const candidate of scope.candidates) {
        await seedPersonaliseRecipient(candidate);
      }
    }

    const all = await getAllConversationPeople();
    const scoped =
      scope === "all"
        ? all
        : (() => {
            const phoneNumbers = new Set(scope.candidates.map((candidate) => candidate.phoneNumber));
            return all.filter((person) => phoneNumbers.has(person.phoneNumber));
          })();
    setPeople(scoped);
    // Returned directly, not just set — a caller needing the freshly-fetched
    // list right after awaiting refresh() (e.g. Library's own "everyone's
    // done, redirect to Reconnected" check) can't rely on this hook's own
    // `people` closure updating synchronously within the same function.
    return scoped;
  }, [scope]);

  const circleSections = groupByCircle(people);
  const ungroupedPeople = people.filter((person) => person.circleId === null);
  const expandedPeople = circleSections
    .filter((section) => expandedCircleIds.has(section.circleId))
    .flatMap((section) => section.people);
  const expandedPersonalisePerson = expandedPersonaliseId
    ? (expandedPeople.find((person) => person.id === expandedPersonaliseId) ?? null)
    : null;

  const allIds = ungroupedPeople.map((person) => person.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id));

  const toggleAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(allIds));
  };

  const toggleId = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleCircleExpanded = (circleId: string) => {
    setExpandedCircleIds((current) => {
      const next = new Set(current);
      if (next.has(circleId)) {
        next.delete(circleId);
        const section = circleSections.find((s) => s.circleId === circleId);
        if (section?.people.some((person) => person.id === expandedPersonaliseId)) {
          setExpandedPersonaliseId(null);
        }
      } else {
        next.add(circleId);
      }
      return next;
    });
  };

  const togglePersonalisePerson = (personId: string) => {
    setExpandedPersonaliseId((current) => (current === personId ? null : personId));
  };

  const activeIndividualMessageId = activeField?.startsWith("individual-message:")
    ? activeField.slice("individual-message:".length)
    : null;
  const activeIndividualPerson = activeIndividualMessageId
    ? people.find((p) => p.id === activeIndividualMessageId)
    : undefined;

  const activeFieldValue = (): string => {
    if (activeIndividualMessageId) {
      const fallback = activeIndividualPerson?.circleId === null ? DEFAULT_QUICK_MESSAGE : "";
      return individualMessages[activeIndividualMessageId] ?? fallback;
    }
    if (activeField === "new-circle") return newOtherCircleName;
    return "";
  };

  const setActiveFieldValue = (text: string) => {
    if (activeIndividualMessageId) {
      setIndividualMessages((current) => ({ ...current, [activeIndividualMessageId]: text }));
    } else if (activeField === "new-circle") {
      setNewOtherCircleName(text);
    }
  };

  const activeFieldLabel = (): string => {
    if (activeIndividualPerson) return `Message for ${activeIndividualPerson.name}`;
    if (activeField === "new-circle") return "New Circle name";
    return "Message";
  };

  const togglePersonaliseSwap = (personId: string) => {
    setPersonaliseSwapIds((current) => {
      const next = new Set(current);
      if (next.has(personId)) next.delete(personId);
      else next.add(personId);
      return next;
    });
  };

  const sendIndividual = (person: ConversationPerson) => {
    const text = (individualMessages[person.id] ?? "").trim();
    if (!text) return;

    void (async () => {
      try {
        await sendOrShare([person.phoneNumber], text);
      } catch {
        // The compose sheet closing is the only signal available either way.
      }
      await markQuickSent([person.id]);
      await refresh();
      setStopPermissionShown(true);
      onPersonAction?.();
    })();
  };

  /**
   * "Conversation complete" — standalone completion log, never gating
   * Reconnect's own completion (that's a separate, Reconnect-only
   * action). Only attaches to a Hold period's own History
   * (`marked_elsewhere`) while inside an active Continue-reconnecting
   * session for that period — no lookup-by-phone-number, no guessing at
   * "most recent period" (settled after considering and rejecting that
   * approach). Un-marking retracts the reachedVia entry too. See
   * docs/09-decision-log.md, 2026-08-20.
   */
  const markConversationComplete = (person: ConversationPerson) => {
    void (async () => {
      const nextCompleted = !person.completed;
      await toggleComplete(person.id, nextCompleted);

      const reconnectingPeriod = await getReconnectingPeriod();
      if (reconnectingPeriod) {
        if (nextCompleted) {
          await recordReachedVia(reconnectingPeriod.id, person.phoneNumber, "marked_elsewhere");
        } else {
          await clearReachedVia(reconnectingPeriod.id, person.phoneNumber);
        }
      }

      await refresh();
    })();
  };

  const addNewPerson = () => {
    void (async () => {
      const picked = await pickContact();
      if (!picked) return;

      await addPerson(picked);
      await refresh();
    })();
  };

  const toggleOtherSelection = (person: ConversationPerson) => {
    setSelectedOtherIds((current) => {
      const next = new Set(current);
      if (next.has(person.id)) {
        next.delete(person.id);
        if (next.size < 2) setCirclePromptStage("none");
        return next;
      }

      next.add(person.id);
      if (next.size === 2) setCirclePromptStage("confirm");
      return next;
    });
  };

  const declineCreateCircle = () => {
    setCirclePromptStage("none");
    setSelectedOtherIds(new Set());
  };

  const submitCreateCircle = async () => {
    const name = newOtherCircleName.trim();
    if (!name) return;

    const selectedPeople = ungroupedPeople.filter((person) => selectedOtherIds.has(person.id));
    const group = await createGroup(name);
    for (const person of selectedPeople) {
      await addContactToGroup(group.id, { name: person.name, phoneNumber: person.phoneNumber });
    }

    setNewOtherCircleName("");
    setCirclePromptStage("none");
    setSelectedOtherIds(new Set());
    await refresh();
  };

  const onSentFromAccordion = () => {
    void refresh();
    setStopPermissionShown(true);
    onPersonAction?.();
  };

  return {
    people,
    circleSections,
    ungroupedPeople,
    expandedPeople,
    expandedPersonalisePerson,
    expandedCircleIds,
    expandedPersonaliseId,
    personaliseDrafts,
    setPersonaliseDrafts,
    personaliseStyles,
    setPersonaliseStyles,
    personaliseReplyTarget,
    setPersonaliseReplyTarget,
    personaliseSwapIds,
    selectedIds,
    individualMessages,
    stopPermissionShown,
    selectedOtherIds,
    circlePromptStage,
    newOtherCircleName,
    activeField,
    setActiveField,
    activeIndividualPerson,
    activeFieldValue,
    setActiveFieldValue,
    activeFieldLabel,
    allIds,
    allSelected,
    refresh,
    toggleAll,
    toggleId,
    toggleCircleExpanded,
    togglePersonalisePerson,
    togglePersonaliseSwap,
    sendIndividual,
    markConversationComplete,
    addNewPerson,
    toggleOtherSelection,
    declineCreateCircle,
    submitCreateCircle,
    onSentFromAccordion
  };
}

export type UseConversationsReturn = ReturnType<typeof useConversations>;
