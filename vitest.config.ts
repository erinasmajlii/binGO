import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/lib/**/*.test.ts", "src/lib/**/*.test.tsx"],
    setupFiles: ["./src/lib/__tests__/setup.ts"],
  },
});
