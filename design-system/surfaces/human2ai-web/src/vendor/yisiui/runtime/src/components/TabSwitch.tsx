"use client";

import type { CSSProperties, KeyboardEvent, ReactNode } from "react";
import { useId, useMemo, useRef, useState } from "react";

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
  /** Independent trailing actions. Their disabled state is owned by the caller. */
  rightSlot?: ReactNode;
}

export type TabSwitchItems = readonly [TabSwitchItem, TabSwitchItem, ...TabSwitchItem[]];

export interface TabSwitchProps {
  items: TabSwitchItems;
  "aria-label": string;
  /** Reduce the control height and vertical padding. Defaults to false. */
  compact?: boolean;
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
  compact = false,
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
  const groupName = useId();
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const selectedKey = value ?? (itemByKey.has(internalValue) ? internalValue : firstKey);
  const focusKey = !itemByKey.get(selectedKey)?.disabled
    ? selectedKey
    : items.find((item) => !item.disabled)?.key;

  function handleChange(nextKey: string): void {
    const nextItem = itemByKey.get(nextKey);
    if (!nextItem || nextItem.disabled || nextKey === selectedKey) {
      return;
    }

    if (value === undefined) {
      setInternalValue(nextKey);
    }
    onChange?.(nextKey, nextItem);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>, index: number): void {
    const enabledIndexes = items.flatMap((item, itemIndex) => item.disabled ? [] : [itemIndex]);
    const current = enabledIndexes.indexOf(index);
    const last = enabledIndexes.length - 1;
    let next: number;
    const isRtl = getComputedStyle(event.currentTarget).direction === "rtl";

    switch (event.key) {
      case "ArrowRight":
      case "ArrowLeft": {
        const forward = (event.key === "ArrowRight") !== isRtl;
        next = (current + (forward ? 1 : last)) % enabledIndexes.length;
        break;
      }
      case "ArrowDown":
        next = (current + 1) % enabledIndexes.length;
        break;
      case "ArrowUp":
        next = (current + last) % enabledIndexes.length;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = last;
        break;
      default:
        return;
    }

    event.preventDefault();
    const nextIndex = enabledIndexes[next];
    if (nextIndex === undefined) return;
    handleChange(items[nextIndex].key);
    inputRefs.current[nextIndex]?.focus();
  }

  return (
    <div
      {...uiAssetAttributes("tab-switch", "TabSwitch", "component")}
      className={["yisi-tab-switch", compact ? "yisi-tab-switch-compact" : null, className].filter(Boolean).join(" ")}
      data-density={compact ? "compact" : "default"}
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
      role="radiogroup"
      aria-orientation="horizontal"
    >
      {items.map((item, index) => (
        <div
          key={item.key}
          className={[
            "yisi-tab-switch-item",
            item.key === selectedKey ? "yisi-tab-switch-active-item" : null,
            item.disabled ? "yisi-tab-switch-disabled-item" : null,
          ].filter(Boolean).join(" ")}
        >
          <label
            className="yisi-tab-switch-label"
            title={item.mode === "icon-only" ? item.ariaLabel ?? item.label : undefined}
          >
            <input
              ref={(element) => { inputRefs.current[index] = element; }}
              className="yisi-tab-switch-input"
              type="radio"
              name={groupName}
              value={item.key}
              checked={item.key === selectedKey}
              disabled={item.disabled}
              aria-label={item.ariaLabel}
              tabIndex={!item.disabled && item.key === focusKey ? 0 : -1}
              onChange={() => handleChange(item.key)}
              onKeyDown={(event) => handleKeyDown(event, index)}
            />
            {renderItemLabel(item)}
          </label>
          {item.rightSlot != null ? (
            <div className="yisi-tab-switch-right-slot" data-yisiui-slot="rightSlot">
              {item.rightSlot}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
