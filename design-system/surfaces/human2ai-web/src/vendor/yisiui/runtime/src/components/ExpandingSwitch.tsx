"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, ReactNode } from "react";

import "../../styles/tokens.css";
import "../../styles/expanding-switch.css";
import { uiAssetAttributes } from "../internal/uiAssetAttributes";

export interface ExpandingSwitchItem {
  key: string;
  label: string;
  /** Decorative, non-interactive content shown only in the collapsed square. */
  icon?: ReactNode;
  disabled?: boolean;
}

export type ExpandingSwitchColors =
  | { mode: "multicolor" }
  | {
      mode: "duotone";
      selectedBackground?: string;
      unselectedBackground?: string;
      selectedForeground?: string;
      unselectedForeground?: string;
    };

export interface ExpandingSwitchProps {
  items: readonly ExpandingSwitchItem[];
  "aria-label": string;
  value?: string;
  defaultValue?: string;
  onChange?: (key: string, item: ExpandingSwitchItem) => void;
  /** Defaults to the fixed, repeating eight-color paper palette. */
  colors?: ExpandingSwitchColors;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
}

// Order belongs to the design system, not the consumer or individual item.
const PALETTE = ["natural", "sage", "amber", "rose", "slate", "sky", "lavender", "clay"] as const;

export function ExpandingSwitch({
  items,
  "aria-label": ariaLabel,
  value,
  defaultValue,
  onChange,
  colors = { mode: "multicolor" },
  disabled = false,
  className,
  style,
}: ExpandingSwitchProps) {
  const keys = new Set<string>();
  for (const item of items) {
    if (!item.label.trim() || keys.has(item.key)) {
      throw new Error("ExpandingSwitch 需要非空 label 和唯一 key。");
    }
    keys.add(item.key);
  }
  if (items.length && value !== undefined && !keys.has(value)) {
    throw new Error(`ExpandingSwitch value 不存在于 items：${value}`);
  }

  const firstKey = items.find((item) => !item.disabled)?.key ?? items[0]?.key;
  const [internalValue, setInternalValue] = useState(defaultValue ?? firstKey);
  const [hoverKey, setHoverKey] = useState<string>();
  const [focusKey, setFocusKey] = useState<string>();
  const [expandedWidth, setExpandedWidth] = useState<number>();
  const measureRef = useRef<HTMLSpanElement>(null);
  const buttonRefs = useRef(new Map<string, HTMLButtonElement>());
  const pointerInput = useRef(false);
  const selectedKey = value ?? (internalValue !== undefined && keys.has(internalValue) ? internalValue : firstKey);
  const enabled = (key: string | undefined) => !disabled && items.some((item) => item.key === key && !item.disabled);
  const expandedKey = (enabled(hoverKey) ? hoverKey : undefined)
    ?? (enabled(focusKey) ? focusKey : undefined) ?? selectedKey;
  const tabKey = (enabled(focusKey) ? focusKey : undefined)
    ?? (enabled(selectedKey) ? selectedKey : items.find((item) => !item.disabled)?.key);

  // A stacked, intrinsic-size label probe measures the longest actual label,
  // including padding. ResizeObserver also handles web fonts and typography changes.
  useLayoutEffect(() => {
    const probe = measureRef.current;
    if (!probe) return;
    const measure = () => {
      const width = Math.ceil(probe.getBoundingClientRect().width);
      if (width > 0) setExpandedWidth(width);
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(measure);
    observer?.observe(probe);
    window.addEventListener("resize", measure);
    document.fonts?.addEventListener("loadingdone", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
      document.fonts?.removeEventListener("loadingdone", measure);
    };
  }, [items]);

  function select(item: ExpandingSwitchItem) {
    if (disabled || item.disabled || item.key === selectedKey) return;
    if (value === undefined) setInternalValue(item.key);
    onChange?.(item.key, item);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, item: ExpandingSwitchItem) {
    pointerInput.current = false;
    setHoverKey(undefined);
    setFocusKey(item.key);
    const available = items.filter((entry) => !entry.disabled);
    if (disabled || item.disabled || !available.length) return;
    const index = available.findIndex((entry) => entry.key === item.key);
    const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
    let nextIndex: number;
    switch (event.key) {
      case "ArrowRight": nextIndex = index + (rtl ? -1 : 1); break;
      case "ArrowLeft": nextIndex = index + (rtl ? 1 : -1); break;
      case "ArrowDown": nextIndex = index + 1; break;
      case "ArrowUp": nextIndex = index - 1; break;
      case "Home": nextIndex = 0; break;
      case "End": nextIndex = available.length - 1; break;
      default: return;
    }
    event.preventDefault();
    const next = available[(nextIndex + available.length) % available.length];
    setFocusKey(next.key);
    buttonRefs.current.get(next.key)?.focus();
    buttonRefs.current.get(next.key)?.scrollIntoView({ block: "nearest", inline: "nearest" });
    select(next);
  }

  if (!items.length) return null;

  const variables = {
    ...style,
    "--yisiui-expanding-switch-item-count": items.length,
    ...(expandedWidth ? { "--yisiui-expanding-switch-expanded-width": `${expandedWidth}px` } : {}),
    ...(colors.mode === "duotone" ? {
      "--yisiui-expanding-switch-selected-background": colors.selectedBackground,
      "--yisiui-expanding-switch-unselected-background": colors.unselectedBackground,
      "--yisiui-expanding-switch-selected-foreground": colors.selectedForeground,
      "--yisiui-expanding-switch-unselected-foreground": colors.unselectedForeground,
    } : {}),
  } as CSSProperties;

  return (
    <div
      {...uiAssetAttributes("expanding-switch", "ExpandingSwitch")}
      className={["yisi-expanding-switch", className].filter(Boolean).join(" ")}
      role="radiogroup"
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
      data-color-mode={colors.mode}
      style={variables}
      onPointerLeave={() => setHoverKey(undefined)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setFocusKey(undefined);
          pointerInput.current = false;
        }
      }}
    >
      <span ref={measureRef} className="yisi-expanding-switch-measure" aria-hidden="true">
        {items.map((item) => <span key={item.key}>{item.label}</span>)}
      </span>
      <div
        className="yisi-expanding-switch-track"
        style={{
          // Animate one complete column list. Independent width transitions can
          // reverse at different speeds during rapid hover and change the sum.
          gridTemplateColumns: items.map((item) => item.key === expandedKey
            ? "max(var(--yisiui-expanding-switch-size), var(--yisiui-expanding-switch-expanded-width, 64px))"
            : "var(--yisiui-expanding-switch-size)").join(" "),
        }}
      >
        {items.map((item, index) => {
          const expanded = item.key === expandedKey;
          const selected = item.key === selectedKey;
          return (
            <button
              key={item.key}
              ref={(element) => {
                if (element) buttonRefs.current.set(item.key, element);
                else buttonRefs.current.delete(item.key);
              }}
              type="button"
              role="radio"
              aria-label={item.label}
              aria-checked={selected}
              disabled={disabled || item.disabled}
              tabIndex={!disabled && !item.disabled && item.key === tabKey ? 0 : -1}
              className="yisi-expanding-switch-item"
              data-expanded={expanded}
              data-palette={colors.mode === "multicolor" ? PALETTE[index % PALETTE.length] : undefined}
              onPointerEnter={(event) => {
                if (event.pointerType !== "touch") {
                  pointerInput.current = true;
                  setFocusKey(undefined);
                  setHoverKey(enabled(item.key) ? item.key : undefined);
                }
              }}
              onPointerDown={() => { pointerInput.current = true; setFocusKey(undefined); }}
              onPointerCancel={() => setHoverKey(undefined)}
              onFocus={() => { if (!pointerInput.current) setFocusKey(item.key); }}
              onKeyDown={(event) => handleKeyDown(event, item)}
              onClick={() => select(item)}
            >
              <span className="yisi-expanding-switch-label" aria-hidden="true">{item.label}</span>
              {item.icon != null && (
                <span className="yisi-expanding-switch-icon" aria-hidden="true" inert={expanded}>{item.icon}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
