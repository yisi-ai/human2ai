"use client";

import { useState, type ReactNode } from "react";
import { I18nextProvider } from "react-i18next";
import { createAppI18n } from "./createI18n";

export interface AppI18nProviderProps {
  children: ReactNode;
}

export function AppI18nProvider({ children }: AppI18nProviderProps) {
  const [i18n] = useState(() => createAppI18n());
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
