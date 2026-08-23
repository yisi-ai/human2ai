"use client";

import { Segmented } from "antd";
import type { CSSProperties, ReactNode } from "react";
import { useMemo, useState } from "react";

import "../../styles/tokens.css";
import "../../styles/tab-switch.css";

import { uiAssetAttributes } from "../internal/uiAssetAttributes";

export type TabSwitchDisplayMode = "icon-text" | "text-only" | "icon-only";
export type TabSwitchTextColor = "black" | "white";

export interface TabSwitchItem {
  key: string;
  label: string;
  icon?: ReactNode;
  mode?: TabSwitchDisplayMode;
  disabled?: boolean;
  ariaLabel?: string;
}

export type TabSwitchItems = readonly [TabSwitchItem, TabSwitchItem, ...TabSwitchItem[]];

export interface TabSwitchProps {
  items: TabSwitchItems;
  "aria-label": string;
  /** Background of the whole segmented control. */
  tabBackground?: string;
  /** Background shared by every selected item. */
  selectedBackground?: string;
  /** Text color shared by every selected item. */
  selectedTextColor?: TabSwitchTextColor;
  /** Optional text color shared by every unselected item. */
  unselectedTextColor?: TabSwitchTextColor;
  value?: string;
  defaultValue?: string;
  onChange?: (key: string, item: TabSwitchItem) => void;
  className?: string;
  style?: CSSProperties;
}

const DEFAULT_SELECTED_BACKGROUND = "var(--yisiui-color-surface-panel)";

function resolveTextColor(textColor: TabSwitchTextColor = "black"): string {
  return textColor === "white" ? "var(--yisiui-color-text-inverse)" : "var(--yisiui-color-text-primary)";
}

function validateItems(items: TabSwitchItems, value: string | undefined, defaultValue: string | undefined): void {
  if (items.length < 2) {
    throw new Error("TabSwitch 至少需要两个子项。");
  }

  const keys = new Set<string>();
  for (const item of items) {
    if (keys.has(item.key)) {
      throw new Error(`TabSwitch 子项 key 必须唯一：${item.key}`);
    }
    keys.add(item.key);

    if ((item.mode === "icon-text" || item.mode === "icon-only") && item.icon == null) {
      throw new Error(`TabSwitch 子项「${item.label}」使用 Icon 模式时必须提供 icon。`);
    }
  }

  if (value !== undefined && !keys.has(value)) {
    throw new Error(`TabSwitch value 不存在于 items：${value}`);
  }
  if (defaultValue !== undefined && !keys.has(defaultValue)) {
    throw new Error(`TabSwitch defaultValue 不存在于 items：${defaultValue}`);
  }
}

function renderItemLabel(item: TabSwitchItem): ReactNode {
  const mode = item.mode ?? "icon-text";
  const isIconOnly = mode === "icon-only";

  return (
    <span className="yisi-tab-switch-content">
      {mode !== "text-only" ? (
        <span className="yisi-tab-switch-icon" aria-hidden="true">
          {item.icon}
        </span>
      ) : null}
      {isIconOnly ? (
        <span className="yisi-tab-switch-visually-hidden">{item.ariaLabel ?? item.label}</span>
      ) : (
        <span className="yisi-tab-switch-text">{item.label}</span>
      )}
    </span>
  );
}

export function TabSwitch({
  items,
  "aria-label": ariaLabel,
  tabBackground,
  selectedBackground,
  selectedTextColor = "black",
  unselectedTextColor,
  value,
  defaultValue,
  onChange,
  className,
  style,
}: TabSwitchProps) {
  validateItems(items, value, defaultValue);

  const itemByKey = useMemo(() => new Map(items.map((item) => [item.key, item])), [items]);
  const firstKey = items[0].key;
  const [internalValue, setInternalValue] = useState(defaultValue ?? firstKey);
  const selectedKey = value ?? (itemByKey.has(internalValue) ? internalValue : firstKey);

  const options = useMemo(
    () =>
      items.map((item) => ({
        value: item.key,
        label: renderItemLabel(item),
        disabled: item.disabled,
        className: item.key === selectedKey ? "yisi-tab-switch-active-item" : undefined,
        title: item.mode === "icon-only" ? item.ariaLabel ?? item.label : undefined,
      })),
    [items, selectedKey],
  );

  function handleChange(nextKey: string): void {
    const nextItem = itemByKey.get(nextKey);
    if (!nextItem || nextItem.disabled) {
      return;
    }

    if (value === undefined) {
      setInternalValue(nextKey);
    }
    onChange?.(nextKey, nextItem);
  }

  return (
    <Segmented<string>
      {...uiAssetAttributes("tab-switch", "TabSwitch", "component")}
      className={["yisi-tab-switch", className].filter(Boolean).join(" ")}
      style={
        {
          ...style,
          "--yisiui-tab-switch-background": tabBackground ?? "var(--yisiui-color-surface-page)",
          "--yisiui-tab-switch-selected-background":
            selectedBackground ?? DEFAULT_SELECTED_BACKGROUND,
          "--yisiui-tab-switch-selected-text-color": resolveTextColor(selectedTextColor),
          ...(unselectedTextColor
            ? { "--yisiui-tab-switch-unselected-text-color": resolveTextColor(unselectedTextColor) }
            : {}),
        } as CSSProperties
      }
      aria-label={ariaLabel}
      value={selectedKey}
      options={options}
      onChange={handleChange}
    />
  );
}
