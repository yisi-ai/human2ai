"use client";

import { MenuFoldOutlined, MenuUnfoldOutlined } from "@ant-design/icons";
import { Button } from "antd";
import type { CSSProperties, ReactNode } from "react";
import { useId, useState } from "react";

import "../../styles/tokens.css";
import "../../styles/side-action-panel.css";

import { uiAssetAttributes } from "../internal/uiAssetAttributes";
import { CompositeButtonCollapseProvider } from "../components/CompositeButton";

export interface SideActionPanelProps {
  /** Compact icon actions displayed before the collapse control. */
  tools?: ReactNode;
  /** Row actions, normally composed from CompositeButton instances. */
  children: ReactNode;
  collapsed?: boolean;
  defaultCollapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  collapseLabel?: string;
  expandLabel?: string;
  /** Expanded width; the collapsed rail always remains 48px wide. */
  width?: CSSProperties["width"];
  "aria-label"?: string;
  className?: string;
  style?: CSSProperties;
}

export function SideActionPanel({
  tools,
  children,
  collapsed,
  defaultCollapsed = false,
  onCollapsedChange,
  collapseLabel = "收起侧边面板",
  expandLabel = "展开侧边面板",
  width = 220,
  "aria-label": ariaLabel = "侧边操作面板",
  className,
  style,
}: SideActionPanelProps) {
  const actionsId = useId();
  const [internalCollapsed, setInternalCollapsed] = useState(defaultCollapsed);
  const isControlled = collapsed !== undefined;
  const isCollapsed = collapsed ?? internalCollapsed;
  const toggleLabel = isCollapsed ? expandLabel : collapseLabel;

  function handleToggle(): void {
    const nextCollapsed = !isCollapsed;
    if (!isControlled) {
      setInternalCollapsed(nextCollapsed);
    }
    onCollapsedChange?.(nextCollapsed);
  }

  return (
    <aside
      {...uiAssetAttributes("side-action-panel", "SideActionPanel", "panel-pattern")}
      className={[
        "yisi-side-action-panel",
        isCollapsed ? "yisi-side-action-panel--collapsed" : null,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      data-collapsed={isCollapsed ? "true" : "false"}
      aria-label={ariaLabel}
      style={{ ...style, width: isCollapsed ? 48 : width }}
    >
      <div className="yisi-side-action-panel-header">
        {tools ? (
          <div className="yisi-side-action-panel-tools" role="group" aria-label="面板工具">
            {tools}
          </div>
        ) : null}
        <Button
          className="yisi-side-action-panel-toggle"
          type="text"
          icon={isCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          aria-label={toggleLabel}
          title={toggleLabel}
          aria-expanded={!isCollapsed}
          aria-controls={actionsId}
          onClick={handleToggle}
        />
      </div>
      <CompositeButtonCollapseProvider collapsed={isCollapsed}>
        <div id={actionsId} className="yisi-side-action-panel-actions">
          {children}
        </div>
      </CompositeButtonCollapseProvider>
    </aside>
  );
}
