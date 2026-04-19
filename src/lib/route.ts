import AsyncStorage from "@react-native-async-storage/async-storage";
import { BinMarker } from "./bins";

export type ActiveRoute = {
  destination: BinMarker;
  createdAt: number;
};

const ACTIVE_ROUTE_KEY = "bingo_active_route_v1";

export async function setActiveRoute(route: ActiveRoute): Promise<void> {
  try {
    await AsyncStorage.setItem(ACTIVE_ROUTE_KEY, JSON.stringify(route));
  } catch {
    // Ignore storage failures and continue with current session state.
  }
}

export async function getActiveRoute(): Promise<ActiveRoute | null> {
  try {
    const raw = await AsyncStorage.getItem(ACTIVE_ROUTE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ActiveRoute;

    if (
      !parsed ||
      typeof parsed?.createdAt !== "number" ||
      typeof parsed?.destination?.id !== "string" ||
      typeof parsed?.destination?.latitude !== "number" ||
      typeof parsed?.destination?.longitude !== "number"
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export async function clearActiveRoute(): Promise<void> {
  try {
    await AsyncStorage.removeItem(ACTIVE_ROUTE_KEY);
  } catch {
    // Ignore storage failures.
  }
}
