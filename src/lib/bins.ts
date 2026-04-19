import AsyncStorage from "@react-native-async-storage/async-storage";

export type BinMarker = {
  id: string;
  latitude: number;
  longitude: number;
  source: "current" | "manual";
};

const BINS_STORAGE_KEY = "bingo_bins_v1";

export async function loadBins(): Promise<BinMarker[]> {
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
        (bin?.source === "current" || bin?.source === "manual")
    );
  } catch {
    return [];
  }
}

export async function saveBins(bins: BinMarker[]): Promise<void> {
  try {
    await AsyncStorage.setItem(BINS_STORAGE_KEY, JSON.stringify(bins));
  } catch {
    // Ignore storage errors for now; map still works in-memory.
  }
}
