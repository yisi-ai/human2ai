import type { ReactNode } from "react";
import { YisiUiInspectorHost } from "../components/dev/YisiUiInspectorHost";
import { AppI18nProvider } from "../i18n/I18nProvider";
import "./globals.css";

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="zh-CN"><body><AppI18nProvider>{children}</AppI18nProvider><YisiUiInspectorHost /></body></html>;
}
