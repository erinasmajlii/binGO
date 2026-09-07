import { vi } from "vitest";

// In-memory AsyncStorage mock shared by every test file — real
// @react-native-async-storage/async-storage requires a native module bridge
// that doesn't exist under Vitest/jsdom.
const store = new Map<string, string>();

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async (key: string) => store.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn(async (key: string) => {
      store.delete(key);
    }),
    clear: vi.fn(async () => {
      store.clear();
    }),
  },
}));

export function clearMockAsyncStorage() {
  store.clear();
}
