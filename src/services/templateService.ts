import * as SecureStore from "expo-secure-store";

const INDEX_KEY = "hold.template.index";
const RECORD_PREFIX = "hold.template.";

/**
 * Category names double as Library's default template groupings — see
 * hold-book/04-ux-content/04-navigation-architecture.md, "Circle category names."
 */
export type TemplateCategory = "core-circle" | "friends" | "care" | "professional" | "community";

export interface Template {
  id: string;
  text: string;
  category: TemplateCategory;
  createdAt: number;
}

function recordKey(id: string): string {
  return `${RECORD_PREFIX}${id}`;
}

function createTemplateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

async function readIndex(): Promise<string[]> {
  const raw = await SecureStore.getItemAsync(INDEX_KEY);
  return raw ? (JSON.parse(raw) as string[]) : [];
}

async function writeIndex(ids: string[]): Promise<void> {
  await SecureStore.setItemAsync(INDEX_KEY, JSON.stringify(ids));
}

/**
 * Saves a message as a reusable template — the "Save to Library" control on the
 * Going Quiet message step. Only the save action is built here; browsing/using
 * saved templates is Library's job (Section 3).
 */
export async function saveTemplate(input: { text: string; category: TemplateCategory }): Promise<void> {
  const template: Template = {
    id: createTemplateId(),
    text: input.text,
    category: input.category,
    createdAt: Date.now()
  };

  await SecureStore.setItemAsync(recordKey(template.id), JSON.stringify(template));

  const ids = await readIndex();
  await writeIndex([...ids, template.id]);
}

export async function listTemplates(): Promise<Template[]> {
  const ids = await readIndex();
  const records = await Promise.all(
    ids.map(async (id) => {
      const raw = await SecureStore.getItemAsync(recordKey(id));
      return raw ? (JSON.parse(raw) as Template) : null;
    })
  );

  return records.filter((template): template is Template => template !== null);
}

export async function deleteAllTemplates(): Promise<void> {
  const ids = await readIndex();
  await Promise.all(ids.map((id) => SecureStore.deleteItemAsync(recordKey(id))));
  await SecureStore.deleteItemAsync(INDEX_KEY);
}
