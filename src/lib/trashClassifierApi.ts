import { Platform } from "react-native";
import Constants from "expo-constants";
import { classifyTrashPhoto, ClassificationSource, TrashCategory } from "./trashStats";
import { supabase } from "./supabase";

const ALLOWED_CATEGORIES = new Set<TrashCategory>(["cardboard", "glass", "metal", "paper", "plastic", "trash"]);

type ClassifierResponse = {
  category: string;
  confidence: number;
  /** "model" = real trained-model inference, "fallback" = server-side heuristic. Honestly reported by classifier_api.py. */
  mode?: string;
};

const CLASSIFIER_TIMEOUT_MS = 2500;

let lastWorkingBaseUrl: string | null = null;

/**
 * How the classifier's address is resolved, in priority order, and why.
 *
 * 1. `lastWorkingBaseUrl` — whatever answered last time this session.
 *    Cheap and self-correcting; resets on app restart.
 * 2. `Constants.expoConfig.hostUri` — automatic LAN discovery. Expo
 *    populates this with the Metro dev server's own host:port, so this
 *    derives the classifier's address live from wherever the dev machine
 *    currently is on the network, rather than a value someone has to
 *    remember to update by hand. It assumes the classifier runs on the
 *    SAME machine as Metro on port 8000 — true for the normal one-developer
 *    local-dev setup. Only present in Expo Go / a dev client; absent (and
 *    therefore skipped) in any production/standalone build, and in `!__DEV__`
 *    builds this candidate isn't even attempted (see below).
 * 3. `EXPO_PUBLIC_CLASSIFIER_API_URL` (from `.env`, or an EAS build
 *    profile's env in production) — a manual override/fallback. In local
 *    dev you normally don't need to keep this in sync with your current
 *    network at all, since #2 already handles it; this only matters if the
 *    classifier runs on a different machine than Metro. In a PRODUCTION
 *    build, this is the only candidate that runs at all, and it must be a
 *    real deployed HTTPS endpoint, not a LAN IP (a developer's laptop is
 *    never reachable by a real installed app).
 * 4/5. Android emulator loopback / same-device loopback — dev-only,
 *    last-resort candidates for the platforms where they make sense.
 *
 * If every candidate fails (including in production, where a real endpoint
 * simply isn't configured yet), this falls back to a local heuristic guess
 * — never presented to the user as real AI output; see `source` below.
 */
function getApiBaseUrlCandidates(): string[] {
  const candidates: string[] = [];

  if (lastWorkingBaseUrl) {
    candidates.push(lastWorkingBaseUrl);
  }

  if (__DEV__) {
    const hostUri = Constants.expoConfig?.hostUri;
    const host = hostUri?.split(":")[0];
    if (host) {
      candidates.push(`http://${host}:8000`);
    }
  }

  const envUrl = process.env.EXPO_PUBLIC_CLASSIFIER_API_URL?.trim();
  if (envUrl) {
    candidates.push(envUrl.replace(/\/$/, ""));
  }

  if (__DEV__) {
    if (Platform.OS === "android") {
      candidates.push("http://10.0.2.2:8000");
    }
    candidates.push("http://127.0.0.1:8000");
  }

  return [...new Set(candidates)];
}

function buildImageFormData(photoUri: string): FormData {
  const form = new FormData();
  form.append("image", {
    uri: photoUri,
    name: "capture.jpg",
    type: "image/jpeg",
  } as any);
  return form;
}

export async function classifyTrashPhotoWithModel(
  photoUri: string,
): Promise<{ category: TrashCategory; confidence: number; source: ClassificationSource }> {
  const baseUrls = getApiBaseUrlCandidates();

  // Attach the current session's token so the server can require auth once
  // it's deployed somewhere publicly reachable (server/classifier_api.py's
  // JWT check). Harmless to send in local dev too.
  let authHeader: Record<string, string> = {};
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) {
      authHeader = { Authorization: `Bearer ${token}` };
    }
  }

  for (const baseUrl of baseUrls) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CLASSIFIER_TIMEOUT_MS);

    try {
      const response = await fetch(`${baseUrl}/classify`, {
        method: "POST",
        headers: authHeader,
        body: buildImageFormData(photoUri),
        signal: controller.signal,
      });

      if (!response.ok) {
        continue;
      }

      const result = (await response.json()) as ClassifierResponse;
      const category = String(result.category || "trash").toLowerCase() as TrashCategory;

      if (!ALLOWED_CATEGORIES.has(category)) {
        continue;
      }

      lastWorkingBaseUrl = baseUrl;

      return {
        category,
        confidence: Number(Math.max(0, Math.min(1, result.confidence ?? 0.5)).toFixed(4)),
        source: result.mode === "model" ? "model" : "heuristic-server",
      };
    } catch {
      // Try the next candidate quickly when one endpoint is unreachable.
    } finally {
      clearTimeout(timeout);
    }
  }

  // Never present this as real AI output — classifyTrashPhoto() always
  // returns source: "heuristic-local", and callers (ReportScreen) must
  // label it as an estimate, not a detection.
  const fallback = await classifyTrashPhoto(photoUri);
  return fallback;
}
