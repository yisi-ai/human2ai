"use client";

import { ArrowLeftOutlined } from "@ant-design/icons";
import { Button } from "antd";
import type { CSSProperties, ReactNode } from "react";
import { useId, useRef, useState } from "react";

import "../../styles/tokens.css";
import "../../styles/app-shell-frame.css";

import { uiAssetAttributes } from "../internal/uiAssetAttributes";
import { AnimatedIcon, type AnimatedIconHandle } from "../components/AnimatedIcon";

export interface AppShellFrameLabels {
  sidebar: string;
  navigation: string;
  collapseSidebar: string;
  expandSidebar: string;
  rightPanel: string;
  collapseRightPanel: string;
  expandRightPanel: string;
}

export interface AppShellFrameBackAction {
  label: string;
  onClick: () => void;
  icon?: ReactNode;
}

export interface AppShellFrameProps {
  /** Persistent application navigation or contextual controls. */
  sidebar: ReactNode;
  sidebarTitle?: ReactNode;
  sidebarNavigation?: ReactNode;
  /** Content displayed in the global application header. */
  title?: ReactNode;
  /** Product content before the right-panel toggle; also shown when the toggle is absent. */
  headerExtra?: ReactNode;
  /** Optional action shown before the title. Its label is required for accessibility. */
  backAction?: AppShellFrameBackAction;
  /** Product-defined actions shown beside the expand control while the sidebar is hidden. */
  sidebarCollapsedActions?: ReactNode;
  /** Optional product-defined region rendered as the rightmost shell column. */
  rightPanel?: ReactNode;
  children: ReactNode;
  collapsible?: boolean;
  sidebarOpen?: boolean;
  defaultSidebarOpen?: boolean;
  onSidebarOpenChange?: (open: boolean) => void;
  sidebarWidth?: CSSProperties["width"];
  rightPanelCollapsible?: boolean;
  rightPanelOpen?: boolean;
  defaultRightPanelOpen?: boolean;
  onRightPanelOpenChange?: (open: boolean) => void;
  rightPanelWidth?: CSSProperties["width"];
  labels?: Partial<AppShellFrameLabels>;
  className?: string;
  style?: CSSProperties;
}

const defaultLabels: AppShellFrameLabels = {
  sidebar: "Application sidebar",
  navigation: "Application navigation",
  collapseSidebar: "Collapse sidebar",
  expandSidebar: "Expand sidebar",
  rightPanel: "Right panel",
  collapseRightPanel: "Collapse right panel",
  expandRightPanel: "Expand right panel",
};

function toCssLength(value: CSSProperties["width"]): CSSProperties["width"] {
  return typeof value === "number" ? `${value}px` : value;
}

export function AppShellFrame({
  sidebar,
  sidebarTitle,
  sidebarNavigation,
  title,
  headerExtra,
  backAction,
  sidebarCollapsedActions,
  rightPanel,
  children,
  collapsible = true,
  sidebarOpen,
  defaultSidebarOpen = true,
  onSidebarOpenChange,
  sidebarWidth = "var(--yisiui-surface-desktop-web-sidebar-width)",
  rightPanelCollapsible = true,
  rightPanelOpen,
  defaultRightPanelOpen = true,
  onRightPanelOpenChange,
  rightPanelWidth = "var(--yisiui-surface-desktop-web-sidebar-width)",
  labels,
  className,
  style,
}: AppShellFrameProps) {
  const sidebarId = useId();
  const rightPanelId = useId();
  const sidebarToggleIconRef = useRef<AnimatedIconHandle>(null);
  const rightPanelToggleIconRef = useRef<AnimatedIconHandle>(null);
  const [internalSidebarOpen, setInternalSidebarOpen] = useState(defaultSidebarOpen);
  const [internalRightPanelOpen, setInternalRightPanelOpen] = useState(defaultRightPanelOpen);
  const isSidebarControlled = sidebarOpen !== undefined;
  const isRightPanelControlled = rightPanelOpen !== undefined;
  const hasRightPanel = rightPanel !== undefined && rightPanel !== null;
  const hasHeaderExtra = headerExtra !== undefined && headerExtra !== null && headerExtra !== false;
  const resolvedSidebarOpen = sidebarOpen ?? internalSidebarOpen;
  const resolvedRightPanelOpen = rightPanelOpen ?? internalRightPanelOpen;
  const isSidebarVisible = !collapsible || resolvedSidebarOpen;
  const isRightPanelVisible = hasRightPanel && (!rightPanelCollapsible || resolvedRightPanelOpen);
  const resolvedLabels = { ...defaultLabels, ...labels };
  const rootStyle = {
    "--yisi-app-shell-sidebar-width": toCssLength(sidebarWidth),
    "--yisi-app-shell-right-panel-width": toCssLength(rightPanelWidth),
    ...style,
  } as CSSProperties;

  function setSidebarVisibility(open: boolean): void {
    if (!isSidebarControlled) {
      setInternalSidebarOpen(open);
    }
    onSidebarOpenChange?.(open);
  }

  function setRightPanelVisibility(open: boolean): void {
    if (!isRightPanelControlled) {
      setInternalRightPanelOpen(open);
    }
    onRightPanelOpenChange?.(open);
  }

  return (
    <div
      {...uiAssetAttributes("app-shell-frame", "AppShellFrame", "layout")}
      className={[
        "yisi-app-shell-frame",
        !isSidebarVisible ? "yisi-app-shell-frame--sidebar-hidden" : null,
        !isRightPanelVisible ? "yisi-app-shell-frame--right-panel-hidden" : null,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      data-sidebar-state={isSidebarVisible ? "open" : "closed"}
      data-right-panel-state={hasRightPanel ? (isRightPanelVisible ? "open" : "closed") : "absent"}
      style={rootStyle}
    >
      <aside
        id={sidebarId}
        className="yisi-app-shell-sidebar"
        aria-label={resolvedLabels.sidebar}
        aria-hidden={!isSidebarVisible}
      >
        <div className="yisi-app-shell-sidebar-content">
          <div className="yisi-app-shell-sidebar-top">
            <div className="yisi-app-shell-sidebar-heading">
              {sidebarTitle ? (
                <div className="yisi-app-shell-sidebar-title">{sidebarTitle}</div>
              ) : (
                <span aria-hidden="true" />
              )}
              {collapsible && isSidebarVisible ? (
                <Button
                  className="yisi-app-shell-sidebar-toggle"
                  type="text"
                  icon={<AnimatedIcon ref={sidebarToggleIconRef} name="sidebar-left" size={20} />}
                  aria-label={resolvedLabels.collapseSidebar}
                  title={resolvedLabels.collapseSidebar}
                  aria-expanded="true"
                  aria-controls={sidebarId}
                  onPointerEnter={() => sidebarToggleIconRef.current?.play()}
                  onFocus={() => sidebarToggleIconRef.current?.play()}
                  onClick={() => setSidebarVisibility(false)}
                />
              ) : null}
            </div>
            {sidebarNavigation ? (
              <nav
                className="yisi-app-shell-sidebar-navigation"
                aria-label={resolvedLabels.navigation}
              >
                {sidebarNavigation}
              </nav>
            ) : null}
          </div>
          <div className="yisi-app-shell-sidebar-slot">{sidebar}</div>
        </div>
      </aside>
      <div className="yisi-app-shell-content">
        <header className="yisi-app-shell-content-header">
          <div className="yisi-app-shell-content-leading">
            {collapsible && !isSidebarVisible ? (
              <Button
                className="yisi-app-shell-content-toggle"
                type="text"
                icon={<AnimatedIcon ref={sidebarToggleIconRef} name="sidebar-left" size={20} />}
                aria-label={resolvedLabels.expandSidebar}
                title={resolvedLabels.expandSidebar}
                aria-expanded="false"
                aria-controls={sidebarId}
                onPointerEnter={() => sidebarToggleIconRef.current?.play()}
                onFocus={() => sidebarToggleIconRef.current?.play()}
                onClick={() => setSidebarVisibility(true)}
              />
            ) : null}
            {collapsible && !isSidebarVisible && sidebarCollapsedActions ? (
              <div className="yisi-app-shell-sidebar-collapsed-actions">
                {sidebarCollapsedActions}
              </div>
            ) : null}
            {backAction ? (
              <Button
                className="yisi-app-shell-content-back"
                type="text"
                icon={backAction.icon ?? <ArrowLeftOutlined />}
                aria-label={backAction.label}
                title={backAction.label}
                onClick={backAction.onClick}
              />
            ) : null}
          </div>
          {title ? (
            <div
              className="yisi-app-shell-content-title"
              title={typeof title === "string" ? title : undefined}
            >
              {title}
            </div>
          ) : null}
          {hasHeaderExtra || (hasRightPanel && rightPanelCollapsible) ? (
            <div className="yisi-app-shell-content-trailing">
              {hasHeaderExtra ? (
                <div className="yisi-app-shell-header-extra" data-yisiui-slot="header-extra">
                  {headerExtra}
                </div>
              ) : null}
              {hasRightPanel && rightPanelCollapsible ? (
                <Button
                  className="yisi-app-shell-right-panel-toggle"
                  type="text"
                  icon={<AnimatedIcon ref={rightPanelToggleIconRef} name="sidebar-right" size={20} />}
                  aria-label={
                    isRightPanelVisible
                      ? resolvedLabels.collapseRightPanel
                      : resolvedLabels.expandRightPanel
                  }
                  title={
                    isRightPanelVisible
                      ? resolvedLabels.collapseRightPanel
                      : resolvedLabels.expandRightPanel
                  }
                  aria-expanded={isRightPanelVisible}
                  aria-controls={rightPanelId}
                  onPointerEnter={() => rightPanelToggleIconRef.current?.play()}
                  onFocus={() => rightPanelToggleIconRef.current?.play()}
                  onClick={() => setRightPanelVisibility(!isRightPanelVisible)}
                />
              ) : null}
            </div>
          ) : null}
        </header>
        <div className="yisi-app-shell-content-body">{children}</div>
      </div>
      {hasRightPanel ? (
        <aside
          id={rightPanelId}
          className="yisi-app-shell-right-panel"
          aria-label={resolvedLabels.rightPanel}
          aria-hidden={!isRightPanelVisible}
        >
          {rightPanel}
        </aside>
      ) : null}
    </div>
  );
}
