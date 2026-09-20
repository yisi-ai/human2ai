"use client";

import {
  AppShellFrame,
  type AppShellFrameLabels,
} from "@human2ai/ui/yisiui/app-shell-frame";
import type { ReactNode } from "react";

import { uiAssetAttributes } from "../vendor/yisiui/runtime/src/assetMarker";

import "./Human2AiAppShell.css";

export interface Human2AiAppShellLabels extends AppShellFrameLabels {
  productName: string;
}

export interface Human2AiAppShellProps {
  title: ReactNode;
  brand?: ReactNode;
  children: ReactNode;
  sidebar: ReactNode;
  rightPanel?: ReactNode;
  rightPanelOpen?: boolean;
  onRightPanelOpenChange?: (open: boolean) => void;
  labels?: Partial<Human2AiAppShellLabels>;
  className?: string;
}

const DEFAULT_LABELS: Human2AiAppShellLabels = {
  productName: "human2ai",
  sidebar: "Human2AI 应用侧栏",
  navigation: "Human2AI 应用导航",
  collapseSidebar: "收起应用侧栏",
  expandSidebar: "展开应用侧栏",
  rightPanel: "页面属性",
  collapseRightPanel: "收起页面属性",
  expandRightPanel: "展开页面属性",
};

export function Human2AiAppShell({
  title,
  brand,
  children,
  sidebar,
  rightPanel,
  rightPanelOpen,
  onRightPanelOpenChange,
  labels: labelOverrides,
  className,
}: Human2AiAppShellProps) {
  const labels = { ...DEFAULT_LABELS, ...labelOverrides };

  return (
    <div
      {...uiAssetAttributes({
        namespace: "human2ai",
        id: "app-shell",
        name: "Human2AiAppShell",
        category: "layout",
        origin: "project",
        status: "candidate",
      })}
      className={["human2ai-app-shell", className].filter(Boolean).join(" ")}
    >
      <AppShellFrame
        sidebar={sidebar}
        sidebarTitle={brand ?? labels.productName}
        title={<h1 className="human2ai-app-shell__page-title">{title}</h1>}
        rightPanel={rightPanel}
        rightPanelOpen={rightPanelOpen}
        onRightPanelOpenChange={onRightPanelOpenChange}
        sidebarWidth={280}
        rightPanelWidth={300}
        labels={labels}
      >
        {children}
      </AppShellFrame>
    </div>
  );
}
