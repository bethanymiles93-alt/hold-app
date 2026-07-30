// Test-only stand-in for expo-secure-store, aliased in vitest.config.ts.
// The real module's entry point pulls in react-native's Flow-syntax index
// file, which Vite can't parse — no test here actually exercises SecureStore
// behaviour, so this just keeps that native module out of the test graph
// entirely rather than mocking behaviour anyone relies on.
export async function getItemAsync(): Promise<string | null> {
  return null;
}

export async function setItemAsync(): Promise<void> {
  return;
}

export async function deleteItemAsync(): Promise<void> {
  return;
}
