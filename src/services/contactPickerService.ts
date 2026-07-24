import { Alert, Platform } from "react-native";
import { presentContactPickerAsync } from "expo-contacts/legacy";
import type { Contact } from "expo-contacts/legacy";

export interface PickedContact {
  name: string;
  phoneNumber: string;
}

/**
 * The native picker only fills in `name` when Apple's contact formatter can build one
 * from the fields it happened to fetch for this contact — it's frequently absent even
 * though other fields (like phone numbers) came through fine. Falls back to first/last
 * name, then a company name, before giving up.
 */
function resolveName(contact: Contact): string {
  if (contact.name?.trim()) return contact.name.trim();

  const parts = [contact.firstName, contact.lastName].filter((part): part is string =>
    Boolean(part?.trim())
  );
  if (parts.length > 0) return parts.join(" ").trim();

  if (contact.company?.trim()) return contact.company.trim();

  return "";
}

function promptForName(): Promise<string | null> {
  if (Platform.OS !== "ios") {
    Alert.alert("Couldn’t read a name", "Try picking a different contact.");
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    Alert.prompt(
      "What’s their name?",
      "Hold couldn’t read a name from this contact.",
      [
        { text: "Cancel", style: "cancel", onPress: () => resolve(null) },
        { text: "Save", onPress: (text?: string) => resolve(text?.trim() || null) }
      ],
      "plain-text"
    );
  });
}

function resolveNumber(contact: Contact): Promise<string | null> {
  const numbers = (contact.phoneNumbers ?? [])
    .map((phone) => phone.number)
    .filter((number): number is string => Boolean(number));

  if (numbers.length === 0) {
    Alert.alert(
      "No phone number",
      "That contact doesn’t have a phone number saved, so Hold can’t add them to a Circle."
    );
    return Promise.resolve(null);
  }

  const [firstNumber] = numbers;
  if (numbers.length === 1 && firstNumber) {
    return Promise.resolve(firstNumber);
  }

  return new Promise((resolve) => {
    Alert.alert(
      "Which number?",
      "This contact has more than one number saved.",
      [
        ...numbers.map((number) => ({ text: number, onPress: () => resolve(number) })),
        { text: "Cancel", style: "cancel" as const, onPress: () => resolve(null) }
      ]
    );
  });
}

/**
 * Presents the system contact picker (CNContactPickerViewController). The OS hands the
 * picked contact's fields straight back through the picker itself, so this never calls
 * expo-contacts' permission APIs and never requests standing address-book access.
 *
 * Only name and phone number are ever pulled out and returned — nothing else the OS
 * includes on the picked contact is read or passed on.
 */
export async function pickContact(): Promise<PickedContact | null> {
  const contact = await presentContactPickerAsync();
  if (!contact) return null;

  const phoneNumber = await resolveNumber(contact);
  if (!phoneNumber) return null;

  const name = resolveName(contact) || (await promptForName());
  if (!name) return null;

  return { name, phoneNumber };
}
