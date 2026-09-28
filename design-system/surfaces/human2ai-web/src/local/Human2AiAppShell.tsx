"use client";

import {
  AppShellFrame,
  type AppShellFrameLabels,
  type AppShellFrameProps,
} from "@human2ai/ui/yisiui/app-shell-frame";
import type { ReactNode } from "react";

import { uiAssetAttributes } from "../vendor/yisiui/runtime/src/assetMarker";

import "./Human2AiAppShell.css";

export interface Human2AiAppShellLabels extends AppShellFrameLabels {
  productName: string;
}

export interface Human2AiAppShellProps extends Pick<AppShellFrameProps,
  "sidebarWidth" | "rightPanelWidth" | "onSidebarWidthChange" | "onRightPanelWidthChange"
> {
  title: ReactNode;
  titleExtra?: ReactNode;
  headerExtra?: ReactNode;
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
  resizeSidebar: "调整应用侧栏宽度",
  rightPanel: "页面属性",
  collapseRightPanel: "收起页面属性",
  expandRightPanel: "展开页面属性",
  resizeRightPanel: "调整操作面板宽度",
};

export function Human2AiAppShell({
  title,
  titleExtra,
  headerExtra,
  brand,
  children,
  sidebar,
  rightPanel,
  rightPanelOpen,
  onRightPanelOpenChange,
  sidebarWidth = 280,
  rightPanelWidth = 300,
  onSidebarWidthChange,
  onRightPanelWidthChange,
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
        title={title ? (
          <div className="human2ai-app-shell__page-heading">
            <h1 className="human2ai-app-shell__page-title">{title}</h1>
            {titleExtra ? (
              <div className="human2ai-app-shell__title-extra">{titleExtra}</div>
            ) : null}
          </div>
        ) : undefined}
        headerExtra={headerExtra}
        rightPanel={rightPanel}
        rightPanelOpen={rightPanelOpen}
        onRightPanelOpenChange={onRightPanelOpenChange}
        sidebarWidth={sidebarWidth}
        rightPanelWidth={rightPanelWidth}
        onSidebarWidthChange={onSidebarWidthChange}
        onRightPanelWidthChange={onRightPanelWidthChange}
        sidebarResizable
        rightPanelResizable
        labels={labels}
      >
        {children}
      </AppShellFrame>
    </div>
  );
}
