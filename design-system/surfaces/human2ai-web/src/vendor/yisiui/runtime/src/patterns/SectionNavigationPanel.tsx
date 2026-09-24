"use client";

import { CloseOutlined } from "@ant-design/icons";
import { Button } from "antd";
import type { CSSProperties, ReactNode } from "react";
import { useId } from "react";

import "../../styles/tokens.css";
import "../../styles/section-navigation-panel.css";

import { CompositeButton } from "../components/CompositeButton";
import { uiAssetAttributes } from "../internal/uiAssetAttributes";

export interface SectionNavigationPanelItem {
  key: string;
  label: string;
  icon: ReactNode;
  disabled?: boolean;
}

export interface SectionNavigationPanelProps {
  /** Product-defined title content rendered at font.size.lg; no heading level is chosen. */
  title: ReactNode;
  /** Section navigation items rendered with CompositeButton. */
  items: readonly SectionNavigationPanelItem[];
  /** Controlled active item key. Use null when the navigation is empty. */
  activeKey: string | null;
  onActiveKeyChange: (key: string, item: SectionNavigationPanelItem) => void;
  /** Product-owned content for the active item. */
  content: ReactNode;
  /** Requests that the owning surface close or hide the panel. */
  onClose: () => void;
  navigationLabel?: string;
  contentLabel?: string;
  closeLabel?: string;
  "aria-label"?: string;
  className?: string;
  style?: CSSProperties;
}

function validateItems(items: readonly SectionNavigationPanelItem[]): void {
  const keys = new Set<string>();
  for (const item of items) {
    if (keys.has(item.key)) {
      throw new Error(`SectionNavigationPanel 菜单项 key 必须唯一：${item.key}`);
    }
    keys.add(item.key);
  }
}

export function SectionNavigationPanel({
  title,
  items,
  activeKey,
  onActiveKeyChange,
  content,
  onClose,
  navigationLabel = "分区导航",
  contentLabel,
  closeLabel = "关闭面板",
  "aria-label": ariaLabel,
  className,
  style,
}: SectionNavigationPanelProps) {
  validateItems(items);

  const titleId = useId();
  const activeItem = items.find((item) => item.key === activeKey);
  const resolvedContentLabel = contentLabel ?? activeItem?.label ?? "内容区";

  function selectItem(item: SectionNavigationPanelItem): void {
    if (item.disabled || item.key === activeKey) {
      return;
    }
    onActiveKeyChange(item.key, item);
  }

  return (
    <section
      {...uiAssetAttributes(
        "section-navigation-panel",
        "SectionNavigationPanel",
        "navigation-pattern",
      )}
      className={["yisi-section-navigation-panel", className].filter(Boolean).join(" ")}
      style={style}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabel ? undefined : titleId}
      data-active-key={activeKey ?? undefined}
      data-empty={items.length === 0 ? "true" : "false"}
    >
      <header className="yisi-section-navigation-panel-header">
        <div
          id={titleId}
          className="yisi-section-navigation-panel-title"
          title={typeof title === "string" ? title : undefined}
        >
          {title}
        </div>
        <Button
          className="yisi-section-navigation-panel-close"
          type="text"
          icon={<CloseOutlined />}
          aria-label={closeLabel}
          title={closeLabel}
          onClick={onClose}
        />
      </header>

      <div className="yisi-section-navigation-panel-body">
        <nav className="yisi-section-navigation-panel-navigation" aria-label={navigationLabel}>
          <div className="yisi-section-navigation-panel-list" role="list">
            {items.map((item) => {
              const active = item.key === activeKey;
              return (
                <div
                  key={item.key}
                  className="yisi-section-navigation-panel-list-item"
                  role="listitem"
                  data-section-key={item.key}
                >
                  <CompositeButton
                    className={[
                      "yisi-section-navigation-panel-item",
                      active ? "yisi-section-navigation-panel-item--active" : null,
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    icon={
                      <span className="yisi-section-navigation-panel-item-icon" aria-hidden="true">
                        {item.icon}
                      </span>
                    }
                    label={item.label}
                    title={item.label}
                    textColor={
                      item.disabled
                        ? "color.text.disabled"
                        : active
                          ? "color.action.link"
                          : "color.text.primary"
                    }
                    aria-current={active ? "true" : undefined}
                    disabled={item.disabled}
                    onClick={() => selectItem(item)}
                  />
                </div>
              );
            })}
          </div>
        </nav>

        <div
          className="yisi-section-navigation-panel-content"
          role="region"
          aria-label={resolvedContentLabel}
          data-section-key={activeKey ?? undefined}
        >
          {content}
        </div>
      </div>
    </section>
  );
}
