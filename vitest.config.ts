import path from "node:path";
import { defineConfig } from "vitest/config";

// Mirrors tsconfig.json's "@/*" -> "./src/*" path alias. Needed because Vite
// (which Vitest runs on) doesn't read tsconfig "paths" on its own — this had
// never surfaced before since every prior "@/" import in a tested file's
// dependency chain was `import type`, erased before resolution ever ran.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Real module's entry point pulls in react-native's Flow-syntax index
      // file, which Vite can't parse — see tests/mocks/expo-secure-store.ts.
      "expo-secure-store": path.resolve(__dirname, "./tests/mocks/expo-secure-store.ts")
    }
  }
});
