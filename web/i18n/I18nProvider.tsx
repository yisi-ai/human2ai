"use client";

import { useEffect, useState, type ReactNode } from "react";
import { I18nextProvider } from "react-i18next";
import {
  createAppI18n,
  resolveAppLocale,
  resolveInitialAppLocale,
} from "./createI18n";

const localeStorageKey = "human2ai.locale";

export interface AppI18nProviderProps {
  children: ReactNode;
}

export function AppI18nProvider({ children }: AppI18nProviderProps) {
  const [i18n] = useState(() => createAppI18n());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let savedLocale: string | null = null;
    try {
      savedLocale = window.localStorage.getItem(localeStorageKey);
    } catch { /* Browser storage may be unavailable. */ }
    const initialLocale = resolveInitialAppLocale(
      savedLocale,
      navigator.languages.length > 0 ? navigator.languages : [navigator.language],
    );

    function synchronizeLocale(language: string | undefined): void {
      const locale = resolveAppLocale(language);
      document.documentElement.lang = locale;
      document.title = i18n.t("app.title", { lng: locale });
      try {
        window.localStorage.setItem(localeStorageKey, locale);
      } catch { /* Keep language switching available without persistent storage. */ }
    }

    i18n.on("languageChanged", synchronizeLocale);
    if (i18n.resolvedLanguage !== initialLocale) {
      void i18n.changeLanguage(initialLocale);
    } else {
      synchronizeLocale(initialLocale);
    }
    setReady(true);

    return () => {
      i18n.off("languageChanged", synchronizeLocale);
    };
  }, [i18n]);

  // The server cannot know browser preferences. Mount translated children only
  // after locale initialization, including children inside deferred Suspense.
  return <I18nextProvider i18n={i18n}>{ready ? children : null}</I18nextProvider>;
}
