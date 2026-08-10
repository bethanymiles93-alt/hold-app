import {
  createContext,
  type PropsWithChildren,
  useContext,
  useMemo,
  useState
} from "react";
import type {
  AudienceCircle,
  AudienceContact,
  CircleGroup,
  FlowMode,
  GoingQuietCircleDraft,
  GoingQuietRecipient,
  HoldFlowState,
  HoldIntent,
  ReturnStyle
} from "@/types/hold";
import { getCircleTemplate, saveCircleTemplate } from "@/services/templateService";

interface HoldFlowContextValue extends HoldFlowState {
  setRecipients: (recipients: string[]) => void;
  toggleGroup: (group: CircleGroup) => Promise<void>;
  toggleRecipientIncluded: (contactId: string) => void;
  setRecipientIndividuallyRemoved: (contactId: string, removed: boolean) => void;
  setRecipientInstantMessage: (contactId: string, message: string) => void;
  setRecipientRouteToPersonalise: (contactId: string, route: boolean) => void;
  setCircleDraftIntent: (circleId: string, intent: HoldIntent) => void;
  setCircleDraftMessage: (circleId: string, message: string) => void;
  /** Applies a freshly-generated template as the Circle's message AND its auto-persisted default — no explicit save needed. */
  applyGeneratedTemplate: (circleId: string, text: string) => Promise<void>;
  saveCircleDraftAsDefault: (circleId: string) => Promise<void>;
  setReturnStyle: (style: ReturnStyle) => void;
  setAudience: (circles: AudienceCircle[], ungrouped: AudienceContact[], periodId: string | null) => void;
  markCircleUpdated: (circleId: string) => void;
  resetFlow: (mode: FlowMode) => void;
}

const initialState: HoldFlowState = {
  mode: "hold",
  recipients: [],
  selectedGroups: [],
  returnStyle: null,
  audienceCircles: [],
  audienceUngrouped: [],
  reconnectPeriodId: null,
  goingQuietRecipients: [],
  circleDrafts: [],
  updatedCircleIds: []
};

/**
 * Rebuilds the per-person Going Quiet list from the currently selected Circles,
 * preserving any include/personalise choice already made for someone who's still
 * in scope, dropping anyone no longer in any selected Circle, and defaulting
 * anyone newly in scope to included with no personalised message.
 */
function mergeGoingQuietRecipients(
  existing: GoingQuietRecipient[],
  selectedGroups: CircleGroup[]
): GoingQuietRecipient[] {
  const existingByContactId = new Map(existing.map((recipient) => [recipient.contactId, recipient]));
  const seen = new Set<string>();
  const merged: GoingQuietRecipient[] = [];

  for (const group of selectedGroups) {
    for (const contact of group.contacts) {
      if (seen.has(contact.phoneNumber)) continue;
      seen.add(contact.phoneNumber);

      const previous = existingByContactId.get(contact.id);
      merged.push(
        previous ?? {
          contactId: contact.id,
          name: contact.name,
          phoneNumber: contact.phoneNumber,
          circleId: group.id,
          circleName: group.name,
          included: true,
          individuallyRemoved: false,
          instantMessage: "",
          routeToPersonalise: false
        }
      );
    }
  }

  return merged;
}

export function buildAudienceCircles(groups: CircleGroup[]): AudienceCircle[] {
  return groups.map((group) => ({
    circleId: group.id,
    circleName: group.name,
    contacts: group.contacts.map((contact) => ({ name: contact.name, phoneNumber: contact.phoneNumber }))
  }));
}

export function dedupeContactsByPhoneNumber(groups: CircleGroup[]): AudienceContact[] {
  const seen = new Map<string, AudienceContact>();

  for (const group of groups) {
    for (const contact of group.contacts) {
      if (!seen.has(contact.phoneNumber)) {
        seen.set(contact.phoneNumber, { name: contact.name, phoneNumber: contact.phoneNumber });
      }
    }
  }

  return Array.from(seen.values());
}

const HoldFlowContext = createContext<HoldFlowContextValue | null>(null);

export function HoldFlowProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<HoldFlowState>(initialState);

  const value = useMemo<HoldFlowContextValue>(
    () => ({
      ...state,
      setRecipients: (recipients) =>
        setState((current) => ({ ...current, recipients })),
      toggleGroup: async (group) => {
        const alreadySelected = state.selectedGroups.some((existing) => existing.id === group.id);

        if (alreadySelected) {
          setState((current) => {
            const selectedGroups = current.selectedGroups.filter((existing) => existing.id !== group.id);
            return {
              ...current,
              selectedGroups,
              recipients: dedupeContactsByPhoneNumber(selectedGroups).map((contact) => contact.name),
              goingQuietRecipients: mergeGoingQuietRecipients(current.goingQuietRecipients, selectedGroups),
              circleDrafts: current.circleDrafts.filter((draft) => draft.circleId !== group.id)
            };
          });
          return;
        }

        const savedDefault = await getCircleTemplate(group.id);

        setState((current) => {
          const selectedGroups = [...current.selectedGroups, group];
          const newDraft: GoingQuietCircleDraft = {
            circleId: group.id,
            circleName: group.name,
            intent: null,
            message: savedDefault ?? "",
            savedMessage: savedDefault
          };

          return {
            ...current,
            selectedGroups,
            recipients: dedupeContactsByPhoneNumber(selectedGroups).map((contact) => contact.name),
            goingQuietRecipients: mergeGoingQuietRecipients(current.goingQuietRecipients, selectedGroups),
            circleDrafts: [...current.circleDrafts, newDraft]
          };
        });
      },
      toggleRecipientIncluded: (contactId) =>
        setState((current) => ({
          ...current,
          goingQuietRecipients: current.goingQuietRecipients.map((recipient) => {
            if (recipient.contactId !== contactId) return recipient;

            const nowIncluded = !recipient.included;
            if (nowIncluded) {
              // Rejoining the group message — the individual state underneath is moot.
              return {
                ...recipient,
                included: true,
                individuallyRemoved: false,
                routeToPersonalise: false
              };
            }

            const draft = current.circleDrafts.find((d) => d.circleId === recipient.circleId);
            return {
              ...recipient,
              included: false,
              instantMessage: recipient.instantMessage || draft?.message || ""
            };
          })
        })),
      setRecipientIndividuallyRemoved: (contactId, removed) =>
        setState((current) => ({
          ...current,
          goingQuietRecipients: current.goingQuietRecipients.map((recipient) =>
            recipient.contactId === contactId ? { ...recipient, individuallyRemoved: removed } : recipient
          )
        })),
      setRecipientInstantMessage: (contactId, message) =>
        setState((current) => ({
          ...current,
          goingQuietRecipients: current.goingQuietRecipients.map((recipient) =>
            recipient.contactId === contactId ? { ...recipient, instantMessage: message } : recipient
          )
        })),
      setRecipientRouteToPersonalise: (contactId, route) =>
        setState((current) => ({
          ...current,
          goingQuietRecipients: current.goingQuietRecipients.map((recipient) =>
            recipient.contactId === contactId ? { ...recipient, routeToPersonalise: route } : recipient
          )
        })),
      setCircleDraftIntent: (circleId, intent) =>
        setState((current) => ({
          ...current,
          circleDrafts: current.circleDrafts.map((draft) =>
            draft.circleId === circleId ? { ...draft, intent } : draft
          )
        })),
      setCircleDraftMessage: (circleId, message) => {
        setState((current) => ({
          ...current,
          circleDrafts: current.circleDrafts.map((draft) =>
            draft.circleId === circleId ? { ...draft, message } : draft
          )
        }));
      },
      applyGeneratedTemplate: async (circleId, text) => {
        await saveCircleTemplate(circleId, text);
        setState((current) => ({
          ...current,
          circleDrafts: current.circleDrafts.map((draft) =>
            draft.circleId === circleId ? { ...draft, message: text, savedMessage: text } : draft
          )
        }));
      },
      saveCircleDraftAsDefault: async (circleId) => {
        const draft = state.circleDrafts.find((existing) => existing.circleId === circleId);
        if (!draft) return;

        await saveCircleTemplate(circleId, draft.message);
        setState((current) => ({
          ...current,
          circleDrafts: current.circleDrafts.map((existing) =>
            existing.circleId === circleId ? { ...existing, savedMessage: draft.message } : existing
          )
        }));
      },
      setReturnStyle: (returnStyle) =>
        setState((current) => ({ ...current, returnStyle })),
      setAudience: (audienceCircles, audienceUngrouped, reconnectPeriodId) =>
        setState((current) => ({ ...current, audienceCircles, audienceUngrouped, reconnectPeriodId })),
      markCircleUpdated: (circleId) =>
        setState((current) =>
          current.updatedCircleIds.includes(circleId)
            ? current
            : { ...current, updatedCircleIds: [...current.updatedCircleIds, circleId] }
        ),
      resetFlow: (mode) =>
        setState({
          ...initialState,
          mode
        })
    }),
    [state]
  );

  return (
    <HoldFlowContext.Provider value={value}>
      {children}
    </HoldFlowContext.Provider>
  );
}

export function useHoldFlow(): HoldFlowContextValue {
  const value = useContext(HoldFlowContext);

  if (!value) {
    throw new Error("useHoldFlow must be used inside HoldFlowProvider");
  }

  return value;
}
