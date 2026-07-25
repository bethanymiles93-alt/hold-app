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
  GoingQuietRecipient,
  HoldFlowState,
  HoldIntent,
  ReturnStyle
} from "@/types/hold";

interface HoldFlowContextValue extends HoldFlowState {
  setRecipients: (recipients: string[]) => void;
  toggleGroup: (group: CircleGroup) => void;
  toggleRecipientIncluded: (contactId: string) => void;
  setRecipientPersonalisedMessage: (contactId: string, message: string | null) => void;
  setIntent: (intent: HoldIntent) => void;
  setReturnStyle: (style: ReturnStyle) => void;
  setMessage: (message: string) => void;
  setAudience: (circles: AudienceCircle[], ungrouped: AudienceContact[]) => void;
  resetFlow: (mode: FlowMode) => void;
}

const initialState: HoldFlowState = {
  mode: "hold",
  recipients: [],
  selectedGroups: [],
  intent: null,
  returnStyle: null,
  message: "",
  audienceCircles: [],
  audienceUngrouped: [],
  goingQuietRecipients: []
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
          personalisedMessage: null
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
      toggleGroup: (group) =>
        setState((current) => {
          const isSelected = current.selectedGroups.some((existing) => existing.id === group.id);
          const selectedGroups = isSelected
            ? current.selectedGroups.filter((existing) => existing.id !== group.id)
            : [...current.selectedGroups, group];

          return {
            ...current,
            selectedGroups,
            recipients: dedupeContactsByPhoneNumber(selectedGroups).map((contact) => contact.name),
            goingQuietRecipients: mergeGoingQuietRecipients(current.goingQuietRecipients, selectedGroups)
          };
        }),
      toggleRecipientIncluded: (contactId) =>
        setState((current) => ({
          ...current,
          goingQuietRecipients: current.goingQuietRecipients.map((recipient) =>
            recipient.contactId === contactId ? { ...recipient, included: !recipient.included } : recipient
          )
        })),
      setRecipientPersonalisedMessage: (contactId, message) =>
        setState((current) => ({
          ...current,
          goingQuietRecipients: current.goingQuietRecipients.map((recipient) =>
            recipient.contactId === contactId ? { ...recipient, personalisedMessage: message } : recipient
          )
        })),
      setIntent: (intent) =>
        setState((current) => ({ ...current, intent })),
      setReturnStyle: (returnStyle) =>
        setState((current) => ({ ...current, returnStyle })),
      setMessage: (message) =>
        setState((current) => ({ ...current, message })),
      setAudience: (audienceCircles, audienceUngrouped) =>
        setState((current) => ({ ...current, audienceCircles, audienceUngrouped })),
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
