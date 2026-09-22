"use client";

import { PlusOutlined } from "@ant-design/icons";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { CSSProperties, HTMLAttributes, KeyboardEvent, ReactNode } from "react";

import { uiAssetAttributes } from "../internal/uiAssetAttributes";
import { useAccordionLayout } from "../internal/useAccordionLayout";
import { tokens } from "../tokens/tokens";

import "../../styles/tokens.css";
import "../../styles/adaptive-accordion.css";

export interface AdaptiveAccordionItem {
  key: string;
  /** Plain text; interactive controls belong in content. */
  title: string;
  content: ReactNode;
  disabled?: boolean;
}

export interface AdaptiveAccordionProps extends Omit<HTMLAttributes<HTMLDivElement>, "children" | "onChange"> {
  items: readonly AdaptiveAccordionItem[];
  ariaLabel: string;
  /** Omit for uncontrolled use. null means all items are collapsed. */
  expandedKey?: string | null;
  defaultExpandedKey?: string | null;
  onExpandedChange?: (key: string | null) => void;
  /** One decorative icon shared by every title. Defaults to a plus sign. */
  icon?: ReactNode;
  showIcon?: boolean;
  /** Pixel bounds for the uniform title font. Defaults to the 16–24px Token range. */
  minTitleFontSize?: number;
  maxTitleFontSize?: number;
  disabled?: boolean;
  emptyContent?: ReactNode;
}

type AccordionStyle = CSSProperties & {
  "--yisiui-accordion-title-size": string;
  "--yisiui-accordion-icon-width": string;
};

export function AdaptiveAccordion({
  items,
  ariaLabel,
  expandedKey,
  defaultExpandedKey = null,
  onExpandedChange,
  icon,
  showIcon = true,
  minTitleFontSize = parseFloat(String(tokens["font.size.lg"])),
  maxTitleFontSize = parseFloat(String(tokens["font.size.2xl"])),
  disabled = false,
  emptyContent = null,
  className,
  style,
  onKeyDown,
  ...rootProps
}: AdaptiveAccordionProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const measurementRef = useRef<HTMLDivElement>(null);
  const contentNodes = useRef(new Map<string, HTMLDivElement>());
  const buttonNodes = useRef(new Map<string, HTMLButtonElement>());
  const instanceId = useId();
  const [internalKey, setInternalKey] = useState(defaultExpandedKey);

  if (!Number.isFinite(minTitleFontSize) || minTitleFontSize <= 0
    || !Number.isFinite(maxTitleFontSize) || maxTitleFontSize < minTitleFontSize) {
    throw new Error("AdaptiveAccordion requires 0 < minTitleFontSize <= maxTitleFontSize.");
  }
  const keys = new Set<string>();
  for (const item of items) {
    if (!item.key || keys.has(item.key) || !item.title.trim()) {
      throw new Error("AdaptiveAccordion items require unique non-empty keys and non-empty titles.");
    }
    keys.add(item.key);
  }

  const requestedKey = expandedKey === undefined ? internalKey : expandedKey;
  const currentKey = items.some((item) => item.key === requestedKey && !item.disabled) ? requestedKey : null;
  const hasIcon = showIcon && icon !== null && icon !== false;
  const layout = useAccordionLayout({
    listRef, measurementRef, contentNodes, items, expandedKey: currentKey,
    minTitleFontSize, maxTitleFontSize, showIcon: hasIcon,
  });

  const changeExpanded = useCallback((next: string | null) => {
    if (next === currentKey) return;
    if (expandedKey === undefined) setInternalKey(next);
    onExpandedChange?.(next);
  }, [currentKey, expandedKey, onExpandedChange]);

  useEffect(() => {
    if (currentKey === null) return;
    const closeOutside = (event: PointerEvent) => {
      const root = rootRef.current;
      if (event.button === 0 && root && !event.composedPath().includes(root)) changeExpanded(null);
    };
    const ownerDocument = rootRef.current?.ownerDocument;
    ownerDocument?.addEventListener("pointerdown", closeOutside, true);
    return () => ownerDocument?.removeEventListener("pointerdown", closeOutside, true);
  }, [currentKey, changeExpanded]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;
    if (event.key === "Escape" && currentKey !== null) {
      event.preventDefault();
      event.stopPropagation();
      buttonNodes.current.get(currentKey)?.focus();
      changeExpanded(null);
      return;
    }
    const buttons = items.filter((item) => !disabled && !item.disabled)
      .map((item) => buttonNodes.current.get(item.key)).filter((node): node is HTMLButtonElement => Boolean(node));
    const index = buttons.findIndex((node) => node === event.target);
    if (index < 0) return;
    let next: number;
    if (event.key === "ArrowDown") next = (index + 1) % buttons.length;
    else if (event.key === "ArrowUp") next = (index - 1 + buttons.length) % buttons.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = buttons.length - 1;
    else return;
    event.preventDefault();
    buttons[next].focus();
  };

  const rootStyle: AccordionStyle = {
    ...style,
    "--yisiui-accordion-title-size": `${layout?.titleFontSize ?? minTitleFontSize}px`,
    "--yisiui-accordion-icon-width": `${maxTitleFontSize}px`,
  };

  return (
    <div
      {...rootProps}
      {...uiAssetAttributes("adaptive-accordion", "AdaptiveAccordion")}
      ref={rootRef}
      className={["yisi-adaptive-accordion", className].filter(Boolean).join(" ")}
      style={rootStyle}
      aria-label={ariaLabel}
      role="group"
      data-empty={items.length === 0 ? "true" : "false"}
      data-has-icon={hasIcon ? "true" : "false"}
      data-measured={layout ? "true" : "false"}
      onKeyDown={handleKeyDown}
    >
      {items.length === 0 ? <div data-yisiui-slot="empty-content">{emptyContent}</div> : null}
      <ul ref={listRef} className="yisi-adaptive-accordion-list" role="list" style={{ height: layout?.height }}>
        {items.map((item) => {
          const expanded = item.key === currentKey;
          const itemId = `${instanceId}-${encodeURIComponent(item.key)}`;
          return (
            <li key={item.key} className="yisi-adaptive-accordion-item" data-expanded={expanded ? "true" : "false"}>
              <button
                ref={(node) => { if (node) buttonNodes.current.set(item.key, node); else buttonNodes.current.delete(item.key); }}
                id={`${itemId}-title`}
                type="button"
                className="yisi-adaptive-accordion-trigger"
                disabled={disabled || item.disabled}
                aria-expanded={expanded}
                aria-controls={`${itemId}-content`}
                onClick={() => changeExpanded(expanded ? null : item.key)}
              >
                {hasIcon ? (
                  <span className="yisi-adaptive-accordion-icon" aria-hidden="true" data-yisiui-slot="leading-icon" data-default={icon === undefined ? "true" : "false"}>
                    {icon === undefined ? <PlusOutlined /> : icon}
                  </span>
                ) : null}
                <span className="yisi-adaptive-accordion-title" data-yisiui-slot="item-title">{item.title}</span>
              </button>
              <div
                ref={(node) => { node?.toggleAttribute("inert", !expanded); }}
                id={`${itemId}-content`}
                className="yisi-adaptive-accordion-panel"
                role="region"
                aria-labelledby={`${itemId}-title`}
                aria-hidden={!expanded}
              >
                <div
                  ref={(node) => { if (node) contentNodes.current.set(item.key, node); else contentNodes.current.delete(item.key); }}
                  className="yisi-adaptive-accordion-content"
                  data-yisiui-slot="item-content"
                >
                  {item.content}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <div ref={measurementRef} className="yisi-adaptive-accordion-measurement" aria-hidden="true">
        {items.map((item) => (
          <div key={item.key} className="yisi-adaptive-accordion-trigger">
            {hasIcon ? <span className="yisi-adaptive-accordion-icon" /> : null}
            <span className="yisi-adaptive-accordion-title">{item.title}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
