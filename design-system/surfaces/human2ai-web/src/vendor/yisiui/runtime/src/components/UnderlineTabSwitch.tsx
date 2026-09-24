"use client";

import type { CSSProperties, KeyboardEvent } from "react";
import { useRef, useState } from "react";

import "../../styles/tokens.css";
import "../../styles/underline-tab-switch.css";

import { uiAssetAttributes } from "../internal/uiAssetAttributes";

export interface UnderlineTabSwitchItem {
  key: string;
  label: string;
  disabled?: boolean;
  ariaLabel?: string;
}

export type UnderlineTabSwitchItems = readonly [
  UnderlineTabSwitchItem,
  UnderlineTabSwitchItem,
  ...UnderlineTabSwitchItem[],
];

export interface UnderlineTabSwitchProps {
  items: UnderlineTabSwitchItems;
  "aria-label": string;
  /** The shared color for the selected label and its bottom indicator. */
  activeColor?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (key: string, item: UnderlineTabSwitchItem) => void;
  className?: string;
  style?: CSSProperties;
}

interface UnderlineTabSwitchStyle extends CSSProperties {
  "--yisiui-underline-tab-switch-count": number;
  "--yisiui-underline-tab-switch-active-color": string;
}

function validateItems(
  items: UnderlineTabSwitchItems,
  value: string | undefined,
  defaultValue: string | undefined,
): void {
  if (items.length < 2) {
    throw new Error("UnderlineTabSwitch 至少需要两个子项。");
  }

  const keys = new Set<string>();
  for (const item of items) {
    if (keys.has(item.key)) {
      throw new Error(`UnderlineTabSwitch 子项 key 必须唯一：${item.key}`);
    }
    keys.add(item.key);
  }

  if (value !== undefined && !keys.has(value)) {
    throw new Error(`UnderlineTabSwitch value 不存在于 items：${value}`);
  }
  if (defaultValue !== undefined && !keys.has(defaultValue)) {
    throw new Error(`UnderlineTabSwitch defaultValue 不存在于 items：${defaultValue}`);
  }
}

function getNextEnabledIndex(
  items: UnderlineTabSwitchItems,
  currentIndex: number,
  direction: 1 | -1,
): number {
  for (let offset = 1; offset <= items.length; offset += 1) {
    const nextIndex = (currentIndex + offset * direction + items.length) % items.length;
    if (!items[nextIndex].disabled) {
      return nextIndex;
    }
  }

  return currentIndex;
}

function getBoundaryEnabledIndex(items: UnderlineTabSwitchItems, direction: "first" | "last"): number {
  const indexes = direction === "first" ? items.keys() : [...items.keys()].reverse();
  for (const index of indexes) {
    if (!items[index].disabled) {
      return index;
    }
  }

  return 0;
}

export function UnderlineTabSwitch({
  items,
  "aria-label": ariaLabel,
  activeColor = "var(--yisiui-color-action-link)",
  value,
  defaultValue,
  onChange,
  className,
  style,
}: UnderlineTabSwitchProps) {
  validateItems(items, value, defaultValue);

  const itemByKey = new Map(items.map((item) => [item.key, item]));
  const firstKey = items[0].key;
  const [internalValue, setInternalValue] = useState(defaultValue ?? firstKey);
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedKey = value ?? (itemByKey.has(internalValue) ? internalValue : firstKey);

  function selectKey(nextKey: string): void {
    const nextItem = itemByKey.get(nextKey);
    if (!nextItem || nextItem.disabled) {
      return;
    }

    if (value === undefined) {
      setInternalValue(nextKey);
    }
    onChange?.(nextKey, nextItem);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number): void {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = getNextEnabledIndex(items, index, 1);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = getNextEnabledIndex(items, index, -1);
    } else if (event.key === "Home") {
      nextIndex = getBoundaryEnabledIndex(items, "first");
    } else if (event.key === "End") {
      nextIndex = getBoundaryEnabledIndex(items, "last");
    }

    if (nextIndex === null || nextIndex === index) {
      return;
    }

    event.preventDefault();
    const nextItem = items[nextIndex];
    selectKey(nextItem.key);
    buttonRefs.current[nextIndex]?.focus();
  }

  const rootStyle: UnderlineTabSwitchStyle = {
    ...style,
    "--yisiui-underline-tab-switch-count": items.length,
    "--yisiui-underline-tab-switch-active-color": activeColor,
  };

  return (
    <div
      {...uiAssetAttributes("underline-tab-switch", "UnderlineTabSwitch", "component")}
      className={["yisi-underline-tab-switch", className].filter(Boolean).join(" ")}
      style={rootStyle}
      role="tablist"
      aria-label={ariaLabel}
      aria-orientation="horizontal"
    >
      {items.map((item, index) => {
        const selected = item.key === selectedKey;
        return (
          <button
            type="button"
            key={item.key}
            ref={(element) => {
              buttonRefs.current[index] = element;
            }}
            className={[
              "yisi-underline-tab-switch-item",
              selected ? "yisi-underline-tab-switch-item-active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            role="tab"
            aria-selected={selected}
            aria-label={item.ariaLabel}
            data-tab-key={item.key}
            disabled={item.disabled}
            tabIndex={selected ? 0 : -1}
            onClick={() => selectKey(item.key)}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >
            <span className="yisi-underline-tab-switch-label">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
