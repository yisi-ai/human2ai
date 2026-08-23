import { createInstance, type i18n } from "i18next";
import enCommon from "../../locales/en/common.json";
import zhCommon from "../../locales/zh-CN/common.json";

export type AppLocale = "en" | "zh-CN";

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
