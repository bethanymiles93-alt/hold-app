import { useState } from "react";
import { getAll as getAllConversationPeople, seedPersonaliseRecipient, type ConversationPerson } from "@/services/conversationService";
import type { ReturnStyle } from "@/types/hold";

export interface PersonaliseCandidate {
  name: string;
  phoneNumber: string;
  circleId: string;
  circleName: string;
}

export interface PersonaliseReplyTarget {
  personId: string;
  onChangeText: (text: string) => void;
  friendMessage: string;
}

/**
 * Drives the same per-person Send/Edit/Personalise accordion (see
 * PersonaliseAccordion.tsx) from a completion step outside Library itself —
 * Going Quiet's and Reconnect's own "want to send personalised messages?"
 * moment, so both reach the same rich experience rather than a plain
 * nav-away hand-off. seedAndLoad first seeds each candidate into the
 * Conversations store (seedPersonaliseRecipient is idempotent — dedupes by
 * phone number, safe to call again for someone already there) since
 * PersonaliseAccordion is built around a ConversationPerson record, then
 * reads back exactly those records to render. See docs/09-decision-log.md,
 * 2026-08-11.
 */
export function usePersonaliseCompletion() {
  const [people, setPeople] = useState<ConversationPerson[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [styles, setStyles] = useState<Record<string, ReturnStyle>>({});
  const [replyTarget, setReplyTarget] = useState<PersonaliseReplyTarget | null>(null);

  const seedAndLoad = async (candidates: PersonaliseCandidate[]) => {
    for (const candidate of candidates) {
      await seedPersonaliseRecipient(candidate);
    }

    const all = await getAllConversationPeople();
    const phoneNumbers = new Set(candidates.map((candidate) => candidate.phoneNumber));
    setPeople(all.filter((person) => phoneNumbers.has(person.phoneNumber)));
  };

  /**
   * For a caller whose candidates are already guaranteed to exist as
   * ConversationPerson records by another path — Reconnect's own send()
   * already calls seedFromAudience for its whole audience, including
   * ungrouped contacts, which have no circleId/circleName to satisfy
   * PersonaliseCandidate's shape — so there's nothing to seed here, only to
   * read back. See docs/09-decision-log.md, 2026-08-11.
   */
  const loadAlreadySeeded = async (phoneNumbers: string[]) => {
    const all = await getAllConversationPeople();
    const known = new Set(phoneNumbers);
    setPeople(all.filter((person) => known.has(person.phoneNumber)));
  };

  const toggle = (personId: string) => {
    setExpandedId((current) => (current === personId ? null : personId));
  };

  const onChangeDraft = (personId: string, text: string) => {
    setDrafts((current) => ({ ...current, [personId]: text }));
  };

  const onChangeStyle = (personId: string, style: ReturnStyle) => {
    setStyles((current) => ({ ...current, [personId]: style }));
  };

  const activateReply = (
    personId: string,
    bundle: { onChangeText: (text: string) => void; friendMessage: string }
  ) => {
    setReplyTarget({ personId, ...bundle });
  };

  const closeReply = () => setReplyTarget(null);

  return {
    people,
    expandedId,
    drafts,
    styles,
    replyTarget,
    seedAndLoad,
    loadAlreadySeeded,
    toggle,
    onChangeDraft,
    onChangeStyle,
    activateReply,
    closeReply
  };
}
