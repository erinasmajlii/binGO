import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";

export type BinMarker = {
  id: string;
  latitude: number;
  longitude: number;
  source: "current" | "manual";
};

const BINS_STORAGE_KEY = "bingo_bins_v1";

/**
 * Load bins from local AsyncStorage.
 * This is a fallback for offline mode.
 */
export async function loadBinsLocalStorage(): Promise<BinMarker[]> {
  try {
    const raw = await AsyncStorage.getItem(BINS_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as BinMarker[];
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (bin) =>
        typeof bin?.id === "string" &&
        typeof bin?.latitude === "number" &&
        typeof bin?.longitude === "number" &&
        (bin?.source === "current" || bin?.source === "manual"),
    );
  } catch {
    return [];
  }
}

/**
 * Save bins to local AsyncStorage (fallback for offline).
 */
export async function saveBinsLocalStorage(bins: BinMarker[]): Promise<void> {
  try {
    await AsyncStorage.setItem(BINS_STORAGE_KEY, JSON.stringify(bins));
  } catch {
    // Ignore storage errors; app still works in-memory.
  }
}

/**
 * Fetch all bins from Supabase database.
 * Falls back to local storage if Supabase is unavailable.
 */
export async function loadBins(): Promise<BinMarker[]> {
  if (!supabase) {
    // No Supabase; use local storage
    return loadBinsLocalStorage();
  }

  try {
    const { data, error } = await supabase
      .from("bins")
      .select("id,latitude,longitude,source");

    if (error || !Array.isArray(data)) {
      // Fetch failed; fall back to local storage
      return loadBinsLocalStorage();
    }

    const bins = data
      .map((row) => ({
        id: String(row.id || ""),
        latitude: Number(row.latitude || 0),
        longitude: Number(row.longitude || 0),
        source: (row.source === "current" ? "current" : "manual") as
          | "current"
          | "manual",
      }))
      .filter(
        (bin) =>
          bin.id &&
          typeof bin.latitude === "number" &&
          typeof bin.longitude === "number",
      );

    // Cache to local storage for offline fallback
    await saveBinsLocalStorage(bins);
    return bins;
  } catch {
    // Network error; fall back to local storage
    return loadBinsLocalStorage();
  }
}

/**
 * Save bins to local AsyncStorage (backward compatibility).
 * Real-time subscriptions will handle Supabase updates.
 */
export async function saveBins(bins: BinMarker[]): Promise<void> {
  // Keep local cache for offline support
  await saveBinsLocalStorage(bins);
}

/**
 * Add a new bin to Supabase and update locally.
 * Returns the created bin or null on error.
 */
export async function addBinToDatabase(
  bin: BinMarker,
): Promise<BinMarker | null> {
  if (!supabase) {
    // No Supabase; save locally only
    return bin;
  }

  try {
    const { data, error } = await supabase
      .from("bins")
      .insert({
        id: bin.id,
        latitude: bin.latitude,
        longitude: bin.longitude,
        source: bin.source,
      })
      .select("id,latitude,longitude,source");

    if (error || !data || data.length === 0) {
      console.error("Failed to add bin to Supabase:", error);
      return null;
    }

    return {
      id: String(data[0].id),
      latitude: Number(data[0].latitude),
      longitude: Number(data[0].longitude),
      source: (data[0].source === "current" ? "current" : "manual") as
        | "current"
        | "manual",
    };
  } catch (err) {
    console.error("Error adding bin:", err);
    return null;
  }
}

/**
 * Remove a bin from Supabase.
 * Returns true on success, false on error.
 */
export async function removeBinFromDatabase(id: string): Promise<boolean> {
  if (!supabase) {
    // No Supabase; just return true (remove locally)
    return true;
  }

  try {
    // .select() after delete so we get back the rows that were actually
    // deleted — an RLS-denied delete (not the owner) returns no error at
    // all, just zero affected rows, so checking `error` alone would report
    // false success.
    const { data, error } = await supabase
      .from("bins")
      .delete()
      .eq("id", id)
      .select("id");

    if (error) {
      console.error("Failed to remove bin from Supabase:", error);
      return false;
    }

    return Array.isArray(data) && data.length > 0;
  } catch (err) {
    console.error("Error removing bin:", err);
    return false;
  }
}

export type RealtimeConnectionStatus = "connected" | "reconnecting";

const RECONNECT_DELAY_MS = 4000;

/**
 * Subscribe to real-time changes to the bins table.
 * Calls `onUpdate` whenever bins are added, updated, or deleted, and
 * (optionally) `onStatusChange` when the connection drops or recovers, so
 * the UI can show a "reconnecting" indicator instead of silently going
 * stale. Returns an unsubscribe function.
 */
export function subscribeToBinsRealtimeUpdates(
  onUpdate: (bins: BinMarker[]) => void,
  onStatusChange?: (status: RealtimeConnectionStatus) => void,
): (() => void) | null {
  if (!supabase) {
    return null;
  }

  const client = supabase;
  let unsubscribed = false;
  let retryTimeout: ReturnType<typeof setTimeout> | null = null;
  let currentChannel: ReturnType<typeof client.channel> | null = null;

  const connect = () => {
    if (unsubscribed) return;

    currentChannel = client
      .channel("bins-realtime")
      .on(
        "postgres_changes",
        {
          event: "*", // Listen for INSERT, UPDATE, DELETE
          schema: "public",
          table: "bins",
        },
        async () => {
          // When any change occurs, fetch the full bins list
          const updatedBins = await loadBins();
          if (!unsubscribed) onUpdate(updatedBins);
        },
      )
      .subscribe((status) => {
        if (unsubscribed) return;

        if (status === "SUBSCRIBED") {
          onStatusChange?.("connected");
          return;
        }

        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.error("Bins realtime subscription failed:", status);
          onStatusChange?.("reconnecting");

          if (currentChannel) {
            client.removeChannel(currentChannel);
            currentChannel = null;
          }
          // Supabase's client already retries the underlying socket on
          // transient network drops; this catches channel-level failures
          // that don't self-heal, with a simple flat retry (not infinite
          // backoff — a single stuck retry loop is not worth the added
          // complexity for a map feature at this scale).
          retryTimeout = setTimeout(connect, RECONNECT_DELAY_MS);
        }
      });
  };

  try {
    connect();
  } catch (err) {
    console.error("Error setting up bins real-time subscription:", err);
    return null;
  }

  return () => {
    unsubscribed = true;
    if (retryTimeout) clearTimeout(retryTimeout);
    if (currentChannel) client.removeChannel(currentChannel);
  };
}
