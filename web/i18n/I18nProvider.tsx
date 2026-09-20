"use client";

import { useEffect, useState, type ReactNode } from "react";
import { I18nextProvider } from "react-i18next";
import {
  createAppI18n,
  resolveAppLocale,
} from "./createI18n";

export interface AppI18nProviderProps {
  children: ReactNode;
}

export function AppI18nProvider({ children }: AppI18nProviderProps) {
  const [i18n] = useState(() => createAppI18n());

  useEffect(() => {
    function synchronizeLocale(language: string | undefined): void {
      const locale = resolveAppLocale(language);
      document.documentElement.lang = locale;
      document.title = i18n.t("app.title", { lng: locale });
    }

    i18n.on("languageChanged", synchronizeLocale);
    synchronizeLocale(i18n.resolvedLanguage);

    return () => {
      i18n.off("languageChanged", synchronizeLocale);
    };
  }, [i18n]);

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
