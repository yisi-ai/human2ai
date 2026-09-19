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
