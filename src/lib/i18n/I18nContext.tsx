import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import en from "./en";
import sq from "./sq";
import type { Translations } from "./en";

export type Language = "en" | "sq";

const LANGUAGE_STORAGE_KEY = "bingo:language:v1";

const dictionaries: Record<Language, Translations> = { en, sq };

type TranslationParams = Record<string, string | number>;

/** Dot-path into the translation object, e.g. "profile.username". */
type DotPath<T, Prefix extends string = ""> = {
  [K in keyof T & string]: T[K] extends string
    ? `${Prefix}${K}`
    : DotPath<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

export type TranslationKey = DotPath<Translations>;

function resolve(dict: Translations, key: string): string | undefined {
  const parts = key.split(".");
  let value: unknown = dict;
  for (const part of parts) {
    if (typeof value !== "object" || value === null) return undefined;
    value = (value as Record<string, unknown>)[part];
  }
  return typeof value === "string" ? value : undefined;
}

function interpolate(template: string, params?: TranslationParams): string {
  if (!params) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (match, name) =>
    name in params ? String(params[name]) : match,
  );
}

type I18nContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: TranslationKey, params?: TranslationParams) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");

  useEffect(() => {
    AsyncStorage.getItem(LANGUAGE_STORAGE_KEY)
      .then((stored) => {
        if (stored === "en" || stored === "sq") {
          setLanguageState(stored);
        }
      })
      .catch(() => {
        // Default to English if storage can't be read.
      });
  }, []);

  const setLanguage = (next: Language) => {
    setLanguageState(next);
    AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, next).catch(() => {
      // Non-fatal — the in-memory language still applies for this session.
    });
  };

  const value = useMemo<I18nContextValue>(() => {
    const dict = dictionaries[language];

    const t = (key: TranslationKey, params?: TranslationParams): string => {
      const template = resolve(dict, key) ?? resolve(en, key);
      if (template === undefined) {
        if (__DEV__) {
          console.warn(`[i18n] Missing translation key: "${key}"`);
        }
        return key;
      }
      return interpolate(template, params);
    };

    return { language, setLanguage, t };
  }, [language]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n() must be used within an <I18nProvider>");
  }
  return ctx;
}
