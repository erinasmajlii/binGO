import { Platform } from "react-native";
import Constants from "expo-constants";
import { TrashCategory } from "./trashStats";

const ALLOWED_CATEGORIES = new Set<TrashCategory>(["cardboard", "glass", "metal", "paper", "plastic", "trash"]);

type ClassifierResponse = {
  category: string;
  confidence: number;
};

function getApiBaseUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_CLASSIFIER_API_URL?.trim();
  if (envUrl) return envUrl;

  const hostUri = (Constants.expoConfig as any)?.hostUri as string | undefined;
  const host = hostUri?.split(":")[0];
  if (!host) {
    return Platform.OS === "android" ? "http://10.0.2.2:8000" : "http://127.0.0.1:8000";
  }

  return `http://${host}:8000`;
}

export async function classifyTrashPhotoWithModel(photoUri: string): Promise<{ category: TrashCategory; confidence: number }> {
  const form = new FormData();
  form.append("image", {
    uri: photoUri,
    name: "capture.jpg",
    type: "image/jpeg",
  } as any);

  const response = await fetch(`${getApiBaseUrl()}/classify`, {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Classifier request failed with ${response.status}`);
  }

  const result = (await response.json()) as ClassifierResponse;
  const category = String(result.category || "trash").toLowerCase() as TrashCategory;

  if (!ALLOWED_CATEGORIES.has(category)) {
    throw new Error(`Unexpected category from model: ${result.category}`);
  }

  return {
    category,
    confidence: Number(Math.max(0, Math.min(1, result.confidence ?? 0.5)).toFixed(4)),
  };
}
