import { Platform } from "react-native";
import Constants from "expo-constants";
import { TrashCategory } from "./trashStats";

const ALLOWED_CATEGORIES = new Set<TrashCategory>(["cardboard", "glass", "metal", "paper", "plastic", "trash"]);

type ClassifierResponse = {
  category: string;
  confidence: number;
};

const CLASSIFIER_TIMEOUT_MS = 7000;

function getApiBaseUrlCandidates(): string[] {
  const candidates: string[] = [];

  const envUrl = process.env.EXPO_PUBLIC_CLASSIFIER_API_URL?.trim();
  if (envUrl) {
    candidates.push(envUrl.replace(/\/$/, ""));
  }

  const hostUri = (Constants.expoConfig as any)?.hostUri as string | undefined;
  const host = hostUri?.split(":")[0];
  if (host) {
    candidates.push(`http://${host}:8000`);
  }

  if (Platform.OS === "android") {
    candidates.push("http://10.0.2.2:8000");
  }

  candidates.push("http://127.0.0.1:8000");

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

export async function classifyTrashPhotoWithModel(photoUri: string): Promise<{ category: TrashCategory; confidence: number }> {
  const baseUrls = getApiBaseUrlCandidates();
  const failures: string[] = [];

  for (const baseUrl of baseUrls) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CLASSIFIER_TIMEOUT_MS);

    try {
      const response = await fetch(`${baseUrl}/classify`, {
        method: "POST",
        body: buildImageFormData(photoUri),
        signal: controller.signal,
      });

      if (!response.ok) {
        const detail = await response.text();
        failures.push(`${baseUrl}: ${detail || `HTTP ${response.status}`}`);
        continue;
      }

      const result = (await response.json()) as ClassifierResponse;
      const category = String(result.category || "trash").toLowerCase() as TrashCategory;

      if (!ALLOWED_CATEGORIES.has(category)) {
        failures.push(`${baseUrl}: Unexpected category ${result.category}`);
        continue;
      }

      return {
        category,
        confidence: Number(Math.max(0, Math.min(1, result.confidence ?? 0.5)).toFixed(4)),
      };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        failures.push(`${baseUrl}: timed out after ${Math.round(CLASSIFIER_TIMEOUT_MS / 1000)}s`);
      } else {
        failures.push(`${baseUrl}: ${error instanceof Error ? error.message : String(error)}`);
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error(`Classifier API is unreachable. Tried: ${failures.join(" | ")}`);
}
