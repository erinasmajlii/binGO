import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";

/** A bin's current denormalized state — never "clean": that just means null (back to normal). */
export type BinStatus = "full" | "damaged";

/**
 * What can be reported for a bin. "clean" is a distinct report you can file
 * (someone confirmed the bin was emptied/fixed) — it doesn't set
 * bins.current_status to a literal "clean" value, it clears it back to null
 * (see apply_bin_report_to_bin() in 0009_bin_reports_clean_status.sql) and
 * marks any still-open full/damaged reports for that bin as resolved.
 */
export type BinReportStatus = BinStatus | "clean";

export type BinMarker = {
  id: string;
  latitude: number;
  longitude: number;
  source: "current" | "manual";
  /** null = no open report; otherwise whatever the most recent report said. */
  currentStatus: BinStatus | null;
  statusUpdatedAt: string | null;
};

export type BinReport = {
  id: string;
  binId: string;
  status: BinReportStatus;
  reportedBy: string | null;
  createdAt: string;
  resolved: boolean;
};

const BINS_STORAGE_KEY = "bingo_bins_v1";

const BIN_SELECT_COLUMNS =
  "id,latitude,longitude,source,current_status,status_updated_at";

function toBinMarker(row: {
  id: string;
  latitude: number;
  longitude: number;
  source: string | null;
  current_status?: string | null;
  status_updated_at?: string | null;
}): BinMarker {
  return {
    id: String(row.id || ""),
    latitude: Number(row.latitude || 0),
    longitude: Number(row.longitude || 0),
    source: (row.source === "current" ? "current" : "manual") as
      | "current"
      | "manual",
    currentStatus:
      row.current_status === "full" || row.current_status === "damaged"
        ? row.current_status
        : null,
    statusUpdatedAt: row.status_updated_at ?? null,
  };
}

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
    const { data, error } = await supabase.from("bins").select(BIN_SELECT_COLUMNS);

    if (error || !Array.isArray(data)) {
      // Fetch failed; fall back to local storage
      return loadBinsLocalStorage();
    }

    const bins = data
      .map(toBinMarker)
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
      .select(BIN_SELECT_COLUMNS);

    if (error || !data || data.length === 0) {
      console.error("Failed to add bin to Supabase:", error);
      return null;
    }

    return toBinMarker(data[0]);
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
    // deleted — an RLS-denied delete (e.g. not authenticated at all, or the
    // row was already removed by someone else) returns no error, just zero
    // affected rows, so checking `error` alone would report false success.
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

/**
 * Report a bin's condition (Full/Damaged/Clean). Inserts a new row into
 * bin_reports (kept as full history for a future municipality dashboard —
 * see supabase/migrations/0007_bin_reports.sql and
 * 0009_bin_reports_clean_status.sql) — a trigger there updates
 * bins.current_status to match (or clears it to null for "clean"), which
 * the existing bins realtime subscription already picks up, so no separate
 * realtime wiring is needed. Requires authentication (RLS); returns false
 * for a guest/anonymous caller.
 */
export async function reportBinStatus(
  binId: string,
  status: BinReportStatus,
): Promise<boolean> {
  if (!supabase) return false;

  try {
    const { error } = await supabase.from("bin_reports").insert({
      bin_id: binId,
      status,
    });

    if (error) {
      console.error("Failed to report bin status:", error);
      return false;
    }

    return true;
  } catch (err) {
    console.error("Error reporting bin status:", err);
    return false;
  }
}

/**
 * Fetch the report history for a single bin (most recent first), for the
 * bin-detail view.
 */
export async function fetchBinReports(binId: string): Promise<BinReport[]> {
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from("bin_reports")
      .select("id,bin_id,status,reported_by,created_at,resolved")
      .eq("bin_id", binId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error || !Array.isArray(data)) return [];

    return data
      .filter((row) => row.status === "full" || row.status === "damaged" || row.status === "clean")
      .map((row) => ({
        id: String(row.id),
        binId: String(row.bin_id),
        status: row.status as BinReportStatus,
        reportedBy: row.reported_by ?? null,
        createdAt: String(row.created_at),
        resolved: Boolean(row.resolved),
      }));
  } catch (err) {
    console.error("Error fetching bin reports:", err);
    return [];
  }
}

export type RealtimeConnectionStatus = "connected" | "reconnecting";

const RECONNECT_DELAY_MS = 4000;

/**
 * Subscribe to real-time changes to the bins table.
 * Calls `onUpdate` whenever bins are added, updated, or deleted — including
 * status changes, since those land as an UPDATE on the same `bins` row
 * (see bin_reports' trigger) — and (optionally) `onStatusChange` when the
 * connection drops or recovers, so the UI can show a "reconnecting"
 * indicator instead of silently going stale. Returns an unsubscribe function.
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
  // Supabase's free-tier Realtime tenant is torn down after ~60s with no
  // active subscribers and takes a brief moment to reconnect on the next
  // subscribe — the first attempt against a cold tenant routinely gets
  // CHANNEL_ERROR before the retry below succeeds. That's expected, not a
  // real failure, so only escalate to console.error (which surfaces as a
  // scary red overlay in dev) once retries themselves keep failing.
  const CONSECUTIVE_FAILURES_BEFORE_ERROR_LOG = 3;
  let consecutiveFailures = 0;

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
          consecutiveFailures = 0;
          onStatusChange?.("connected");
          return;
        }

        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          consecutiveFailures += 1;
          if (consecutiveFailures >= CONSECUTIVE_FAILURES_BEFORE_ERROR_LOG) {
            console.error("Bins realtime subscription failed repeatedly:", status);
          } else {
            console.warn("Bins realtime subscription hiccup, retrying:", status);
          }
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
