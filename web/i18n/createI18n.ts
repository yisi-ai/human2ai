import { createInstance, type i18n } from "i18next";
import enCommon from "../../locales/en/common.json";
import zhCommon from "../../locales/zh-CN/common.json";

export const appLocales = ["zh-CN", "en"] as const;

export type AppLocale = (typeof appLocales)[number];

export const defaultLocale: AppLocale = "zh-CN";

const resources = {
  en: { translation: enCommon },
  "zh-CN": { translation: zhCommon },
} as const;

export function createAppI18n(locale: AppLocale = defaultLocale): i18n {
  const instance = createInstance();
  void instance.init({
    fallbackLng: "en",
    initAsync: false,
    interpolation: { escapeValue: false },
    lng: locale,
    resources,
  });
  return instance;
}

export function isAppLocale(locale: string | null | undefined): locale is AppLocale {
  return appLocales.some((supportedLocale) => supportedLocale === locale);
}

export function resolveAppLocale(language: string | undefined): AppLocale {
  return language?.toLowerCase().startsWith("en") ? "en" : defaultLocale;
}

export function resolveInitialAppLocale(
  savedLocale: string | null,
  browserLanguages: readonly string[],
): AppLocale {
  if (isAppLocale(savedLocale)) return savedLocale;
  for (const language of browserLanguages) {
    const normalized = language.toLowerCase();
    const match = appLocales.find(locale => locale.toLowerCase() === normalized)
      ?? appLocales.find(locale => locale.toLowerCase().split("-")[0] === normalized.split("-")[0]);
    if (match) return match;
  }
  return defaultLocale;
}
