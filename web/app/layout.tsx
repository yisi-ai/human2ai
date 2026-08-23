import type { Metadata } from "next";
import type { ReactNode } from "react";
import { YisiUiInspectorHost } from "../components/dev/YisiUiInspectorHost";
import { AppI18nProvider } from "../i18n/I18nProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "human2ai 构图编辑器",
  description: "使用基础图形规划画面重心、主体占比与视觉方向。",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="zh-CN"><body><AppI18nProvider>{children}</AppI18nProvider><YisiUiInspectorHost /></body></html>;
}
