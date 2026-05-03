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
        id: String((row as any).id || ""),
        latitude: Number((row as any).latitude || 0),
        longitude: Number((row as any).longitude || 0),
        source: (["current", "manual"].includes((row as any).source)
          ? (row as any).source
          : "manual") as "current" | "manual",
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
    const { error } = await supabase.from("bins").delete().eq("id", id);

    if (error) {
      console.error("Failed to remove bin from Supabase:", error);
      return false;
    }

    return true;
  } catch (err) {
    console.error("Error removing bin:", err);
    return false;
  }
}

/**
 * Subscribe to real-time changes to the bins table.
 * Calls the callback whenever bins are added, updated, or deleted.
 * Returns an unsubscribe function.
 */
export function subscribeToBinsRealtimeUpdates(
  onUpdate: (bins: BinMarker[]) => void,
): (() => void) | null {
  if (!supabase) {
    return null;
  }

  try {
    const subscription = supabase
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
          onUpdate(updatedBins);
        },
      )
      .subscribe((status) => {
        console.log("Bins subscription status:", status);
      });

    // Return unsubscribe function
    return () => {
      supabase.removeChannel(subscription);
    };
  } catch (err) {
    console.error("Error setting up bins real-time subscription:", err);
    return null;
  }
}
