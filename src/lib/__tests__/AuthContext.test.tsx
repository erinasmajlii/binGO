import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, act, fireEvent, waitFor } from "@testing-library/react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AuthProvider, useAuth } from "../AuthContext";
import { clearMockAsyncStorage } from "./setup";

const GUEST_STORAGE_KEY = "bingo:auth:guest-mode:v1";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
}));

vi.mock("../supabase", () => ({
  supabase: {
    auth: {
      getSession: mocks.getSession,
      onAuthStateChange: mocks.onAuthStateChange,
      signOut: vi.fn(),
    },
  },
}));

function Probe() {
  const auth = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(auth.isLoading)}</span>
      <span data-testid="authenticated">{String(auth.isAuthenticated)}</span>
      <span data-testid="displayName">{auth.displayName}</span>
      <span data-testid="userKey">{auth.userKey}</span>
      <button onClick={auth.continueAsGuest}>guest</button>
    </div>
  );
}

beforeEach(() => {
  clearMockAsyncStorage();
  mocks.getSession.mockReset();
  mocks.onAuthStateChange.mockReset();
  mocks.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
});

describe("AuthProvider / useAuth", () => {
  it("starts loading, then resolves to unauthenticated + Guest when there is no session", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null } });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));
    expect(screen.getByTestId("authenticated").textContent).toBe("false");
    expect(screen.getByTestId("displayName").textContent).toBe("Guest");
    expect(screen.getByTestId("userKey").textContent).toBe("guest");
  });

  it("resolves to authenticated with the session user's name/id when a session exists", async () => {
    mocks.getSession.mockResolvedValue({
      data: {
        session: { user: { id: "u-42", email: "art@example.com", user_metadata: { name: "Art" } } },
      },
    });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));
    expect(screen.getByTestId("authenticated").textContent).toBe("true");
    expect(screen.getByTestId("displayName").textContent).toBe("Art");
    expect(screen.getByTestId("userKey").textContent).toBe("u-42");
  });

  it("continueAsGuest() flips isAuthenticated to true without a real session", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null } });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));
    expect(screen.getByTestId("authenticated").textContent).toBe("false");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "guest" }));
    });

    expect(screen.getByTestId("authenticated").textContent).toBe("true");
    // Guest mode has no real user id — the display identity stays "Guest".
    expect(screen.getByTestId("displayName").textContent).toBe("Guest");
  });

  it("a real sign-in event (auth state change) clears guest mode and adopts the real identity", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null } });

    let authChangeCallback: (event: string, session: any) => void = () => {};
    mocks.onAuthStateChange.mockImplementation((cb: any) => {
      authChangeCallback = cb;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "guest" }));
    });
    expect(screen.getByTestId("authenticated").textContent).toBe("true");

    await act(async () => {
      authChangeCallback("SIGNED_IN", {
        user: { id: "real-1", email: "real@example.com", user_metadata: {} },
      });
    });

    expect(screen.getByTestId("authenticated").textContent).toBe("true");
    expect(screen.getByTestId("userKey").textContent).toBe("real-1");
    expect(screen.getByTestId("displayName").textContent).toBe("real");
  });

  it("continueAsGuest() persists to AsyncStorage so guest mode survives a restart", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null } });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "guest" }));
    });

    expect(await AsyncStorage.getItem(GUEST_STORAGE_KEY)).toBe("true");
  });

  it("restores guest mode from AsyncStorage on a fresh mount (simulated app restart)", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null } });
    await AsyncStorage.setItem(GUEST_STORAGE_KEY, "true");

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));
    expect(screen.getByTestId("authenticated").textContent).toBe("true");
  });

  it("a real sign-in clears the persisted guest flag, not just the in-memory state", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null } });
    await AsyncStorage.setItem(GUEST_STORAGE_KEY, "true");

    let authChangeCallback: (event: string, session: any) => void = () => {};
    mocks.onAuthStateChange.mockImplementation((cb: any) => {
      authChangeCallback = cb;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));
    expect(screen.getByTestId("authenticated").textContent).toBe("true");

    await act(async () => {
      authChangeCallback("SIGNED_IN", {
        user: { id: "real-2", email: "real2@example.com", user_metadata: {} },
      });
    });

    await waitFor(async () => expect(await AsyncStorage.getItem(GUEST_STORAGE_KEY)).toBeNull());
  });
});
