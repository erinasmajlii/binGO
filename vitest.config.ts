import { defineConfig } from "vitest/config";

export default defineConfig({
  // __DEV__ is a Metro/Babel build-time global (react-native preset replaces
  // it with a boolean literal) — Vitest never runs through that bundler, so
  // without this any code path that reads __DEV__ throws ReferenceError.
  define: {
    __DEV__: "true",
  },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/lib/**/*.test.ts", "src/lib/**/*.test.tsx"],
    setupFiles: ["./src/lib/__tests__/setup.ts"],
  },
});
