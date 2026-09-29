"use client";

import type { CSSProperties, HTMLAttributes, KeyboardEvent, ReactNode } from "react";
import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { LeftOutlined, MoreOutlined, RightOutlined } from "@ant-design/icons";
import { Dropdown } from "antd";
import { BasicButton } from "./BasicButton";
import { useTabSwitchScroll } from "../internal/useTabSwitchScroll";
import { useTabSwitchReorder } from "../internal/useTabSwitchReorder";
import { useTabSwitchSelection } from "../internal/useTabSwitchSelection";

import "../../styles/tokens.css";
import "../../styles/tab-switch.css";

import { uiAssetAttributes } from "../internal/uiAssetAttributes";

export type TabSwitchDisplayMode = "icon-text" | "text-only" | "icon-only";
export type TabSwitchTextColor = "black" | "white";

export interface TabSwitchScrollArrow {
  icon?: ReactNode;
  /** Accessible name; describes the physical direction, including in RTL layouts. */
  label?: string;
}

export interface TabSwitchScrollArrows {
  left?: TabSwitchScrollArrow;
  right?: TabSwitchScrollArrow;
}

export interface TabSwitchDragAnnouncements {
  /** Announced while dragging inside the control. Empty string silences this state. */
  inside?: string;
  /** Announced outside the control, where releasing cancels. */
  outside?: string;
}

export interface TabSwitchMenuItem {
  key: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
  danger?: boolean;
}

export interface TabSwitchMenu {
  items: readonly TabSwitchMenuItem[];
  /** button: click the ellipsis (default); hover: point at the tab to open directly. */
  trigger?: "button" | "hover";
  ariaLabel?: string;
  /** Menu actions never change selection. Business decisions belong to the caller. */
  onAction: (actionKey: string, tabKey: string) => void;
}

export interface TabSwitchTrailingAction {
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
  onClick: () => void;
}

export interface TabSwitchItem {
  key: string;
  label: string;
  icon?: ReactNode;
  mode?: TabSwitchDisplayMode;
  disabled?: boolean;
  ariaLabel?: string;
  /** Independent actions rendered before the built-in menu. Disabled state is owned by the caller. */
  rightSlot?: ReactNode;
  /** Independent of selection disabled state; an empty menu has no trigger. */
  menu?: TabSwitchMenu;
}

export type TabSwitchItems = readonly [TabSwitchItem, ...TabSwitchItem[]];

export interface TabSwitchProps {
  items: TabSwitchItems;
  "aria-label": string;
  /** Reduce the control height and vertical padding. Defaults to false. */
  compact?: boolean;
  /** A button after all selectable items; excluded from selection and sorting. */
  trailingAction?: TabSwitchTrailingAction;
  /** Opt into pointer sorting after a 350ms hold. Defaults to false. */
  reorderable?: boolean;
  /** One request on a changed in-bounds drop. items remains the source of truth. */
  onReorder?: (keys: string[]) => void;
  /** Override arrow icons and accessible names; omitted fields keep the defaults. */
  scrollArrows?: TabSwitchScrollArrows;
  /** Screen-reader-only drag messages; omitted fields keep the defaults. */
  dragAnnouncements?: TabSwitchDragAnnouncements;
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

const DEFAULT_SELECTED_BACKGROUND = "var(--yisiui-color-action-primary)";

function resolveTextColor(textColor: TabSwitchTextColor = "black"): string {
  return textColor === "white" ? "var(--yisiui-color-text-inverse)" : "var(--yisiui-color-text-primary)";
}

function validateItems(items: TabSwitchItems, value: string | undefined, defaultValue: string | undefined): void {
  if (items.length < 1) {
    throw new Error("TabSwitch 至少需要一个子项。");
  }

  const keys = new Set<string>();
  for (const item of items) {
    if (keys.has(item.key)) {
      throw new Error(`TabSwitch 子项 key 必须唯一：${item.key}`);
    }
    keys.add(item.key);
    if (item.menu && new Set(item.menu.items.map((action) => action.key)).size !== item.menu.items.length) {
      throw new Error(`TabSwitch 菜单项 key 必须唯一：${item.key}`);
    }

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

interface TabSwitchEntryProps extends HTMLAttributes<HTMLDivElement> {
  menu?: TabSwitchMenu;
  tabKey: string;
  menuLabel: string;
  rightSlot?: ReactNode;
  nodeRef: (node: HTMLDivElement | null) => void;
}

function TabSwitchEntry({ menu, tabKey, menuLabel, rightSlot, nodeRef, children, ...attributes }: TabSwitchEntryProps) {
  const [open, setOpen] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | HTMLAnchorElement>(null);
  const itemRef = useRef<HTMLDivElement | null>(null);
  const hoverSuspended = useRef(false);
  const focusedAction = useRef<string | null>(null);
  const hasMenu = !!menu?.items.length;
  const hoverMode = menu?.trigger === "hover";
  const signature = JSON.stringify(menu?.items.map(({ key, disabled }) => [key, !!disabled]));

  function restoreFocus() {
    const target = hoverMode && !keyboardOpen
      ? itemRef.current?.querySelector<HTMLInputElement>("input:not(:disabled)") ?? buttonRef.current
      : buttonRef.current;
    target?.focus();
  }
  useLayoutEffect(() => {
    if (focusedAction.current && !menu?.items.some((item) => item.key === focusedAction.current && !item.disabled)) {
      restoreFocus();
      focusedAction.current = null;
    }
    if (!hasMenu) setOpen(false);
  }, [signature]);
  useLayoutEffect(() => { setOpen(false); }, [hoverMode]);

  function close() {
    setOpen(false);
    restoreFocus();
  }
  function openFromButton() {
    setKeyboardOpen(true);
    setOpen(true);
  }
  const popupProps = {
    placement: "bottomRight" as const,
    autoAdjustOverflow: true,
    autoFocus: keyboardOpen,
    popupRender: (content: ReactNode) => <div onKeyDownCapture={(event) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); hoverSuspended.current = true; close(); }
    }}>{content}</div>,
    menu: {
      items: menu?.items.map((item) => ({ ...item, onFocus: () => { focusedAction.current = item.key; } })),
      onClick: ({ key, domEvent }: { key: string; domEvent: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement> }) => {
        domEvent.stopPropagation();
        const action = menu?.items.find((item) => item.key === key);
        if (!action || action.disabled) return;
        hoverSuspended.current = true;
        close();
        menu?.onAction(key, tabKey);
      },
    },
  };

  // Both anchors remain mounted when the trigger mode changes, preserving radios,
  // slot drafts and item identity. Dropdown only clones its existing anchor node.
  return (
    <Dropdown {...popupProps} trigger={hoverMode && hasMenu ? ["hover"] : []}
      open={hoverMode && hasMenu && open} mouseEnterDelay={0.15} mouseLeaveDelay={0.15}
      onOpenChange={(next) => {
        if (next && (hoverSuspended.current || itemRef.current?.closest(".yisi-tab-switch")?.hasAttribute("data-drag-state"))) return;
        setKeyboardOpen(false);
        setOpen(next);
      }}>
      <div {...attributes} ref={(node) => { itemRef.current = node; nodeRef(node); }} data-menu-trigger={hoverMode ? "hover" : "button"}
        onMouseEnter={(event) => { hoverSuspended.current = event.buttons > 0; }}
        onPointerDownCapture={(event) => {
          if ((event.target as HTMLElement).closest(".yisi-tab-switch-label")) {
            hoverSuspended.current = true;
            setOpen(false);
          }
        }}>
        {children}
        {rightSlot != null || hasMenu ? <div className="yisi-tab-switch-right-slot" data-yisiui-slot="rightSlot">
          {rightSlot}
          {hasMenu ? <div className="yisi-tab-switch-menu" data-mode={hoverMode ? "hover" : "button"} data-open={open || undefined}>
            <Dropdown {...popupProps} trigger={hoverMode ? [] : ["click"]} open={!hoverMode && open}
              onOpenChange={(next) => { setKeyboardOpen(true); setOpen(next); if (!next) focusedAction.current = null; }}>
              <BasicButton ref={buttonRef} className="yisi-tab-switch-menu-trigger" mode="icon-only" icon={<MoreOutlined />}
                iconLabel={menu?.ariaLabel ?? `${menuLabel}的更多操作`} type="text" size="small" aria-haspopup="menu" aria-expanded={open}
                onClick={hoverMode ? openFromButton : undefined}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") { event.preventDefault(); openFromButton(); }
                  if (event.key === "Escape") { hoverSuspended.current = true; close(); }
                }} />
            </Dropdown>
          </div> : null}
        </div> : null}
      </div>
    </Dropdown>
  );
}

export function TabSwitch({
  items,
  "aria-label": ariaLabel,
  compact = false,
  trailingAction,
  reorderable = false,
  onReorder,
  scrollArrows,
  dragAnnouncements,
  tabBackground,
  selectedBackground,
  selectedTextColor,
  unselectedTextColor,
  value,
  defaultValue,
  onChange,
  className,
  style,
}: TabSwitchProps) {
  const initialized = useRef(false);
  validateItems(items, value, initialized.current ? undefined : defaultValue);
  useLayoutEffect(() => { initialized.current = true; }, []);

  const itemByKey = useMemo(() => new Map(items.map((item) => [item.key, item])), [items]);
  const firstKey = items[0].key;
  const [internalValue, setInternalValue] = useState(defaultValue ?? firstKey);
  const drag = useTabSwitchReorder(items, reorderable, onReorder, {
    inside: dragAnnouncements?.inside ?? "松手确认排序",
    outside: dragAnnouncements?.outside ?? "移出范围，松手取消排序",
  });
  const scroll = useTabSwitchScroll(drag.rootRef, drag.viewportRef);
  const groupName = useId();
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const lastFocus = useRef<{ key: string; node: HTMLElement } | null>(null);
  const selectedKey = value ?? (itemByKey.has(internalValue) ? internalValue : firstKey);
  const selectionRef = useTabSwitchSelection(drag.rootRef, scroll.trackRef, drag.nodes, selectedKey);
  const focusKey = !itemByKey.get(selectedKey)?.disabled
    ? selectedKey
    : items.find((item) => !item.disabled)?.key;

  useLayoutEffect(() => {
    const previous = lastFocus.current;
    if (!previous) return;
    const unavailable = !itemByKey.has(previous.key) || !previous.node.isConnected ||
      (previous.node instanceof HTMLInputElement && previous.node.disabled);
    if (unavailable && (document.activeElement === document.body || document.activeElement === previous.node)) {
      inputRefs.current[items.findIndex((item) => item.key === focusKey)]?.focus();
    }
  });

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
    if (event.defaultPrevented) return;
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
      ref={drag.rootRef}
      data-reorderable={reorderable || undefined}
      data-scroll-direction={scroll.edges.rtl ? "rtl" : "ltr"}
      onPointerDownCapture={drag.resetClickSuppression}
      onKeyDownCapture={(event) => { if (!event.defaultPrevented && event.key !== "Escape") drag.resetClickSuppression(); }}
      onClickCapture={(event) => {
        if (drag.suppressClick.current) { event.preventDefault(); event.stopPropagation(); }
      }}
      className={["yisi-tab-switch", compact ? "yisi-tab-switch-compact" : null, className].filter(Boolean).join(" ")}
      data-density={compact ? "compact" : "default"}
      style={
        {
          ...style,
          "--yisiui-tab-switch-background": tabBackground ?? "var(--yisiui-color-surface-page)",
          "--yisiui-tab-switch-selected-background":
            selectedBackground ?? DEFAULT_SELECTED_BACKGROUND,
          "--yisiui-tab-switch-selected-text-color": resolveTextColor(selectedTextColor ?? (selectedBackground ? "black" : "white")),
          ...(unselectedTextColor
            ? { "--yisiui-tab-switch-unselected-text-color": resolveTextColor(unselectedTextColor) }
            : {}),
        } as CSSProperties
      }
      aria-label={ariaLabel}
      role="radiogroup"
      aria-orientation="horizontal"
    >
      {scroll.edges.overflow ? <BasicButton {...scroll.buttonProps(-1)}
        className="yisi-tab-switch-scroll-arrow yisi-tab-switch-scroll-left" type="text" size="small"
        mode="icon-only" icon={scrollArrows?.left?.icon ?? <LeftOutlined />}
        iconLabel={scrollArrows?.left?.label ?? "向左滚动标签"} /> : null}
      <div ref={drag.viewportRef} className="yisi-tab-switch-viewport">
      <div ref={scroll.trackRef} className="yisi-tab-switch-track">
      <div className="yisi-tab-switch-selection-layer" aria-hidden="true">
        <div ref={selectionRef} className="yisi-tab-switch-selection" />
      </div>
      {items.map((item, index) => (
        <TabSwitchEntry
          key={item.key}
          menu={item.menu}
          tabKey={item.key}
          menuLabel={item.ariaLabel ?? item.label}
          rightSlot={item.rightSlot}
          nodeRef={(node) => { if (node) drag.nodes.current.set(item.key, node); else drag.nodes.current.delete(item.key); }}
          data-tab-key={item.key}
          onFocusCapture={(event) => { lastFocus.current = { key: item.key, node: event.target as HTMLElement }; }}
          className={[
            "yisi-tab-switch-item",
            item.key === selectedKey ? "yisi-tab-switch-active-item" : null,
            item.disabled ? "yisi-tab-switch-disabled-item" : null,
          ].filter(Boolean).join(" ")}
        >
          <label
            className="yisi-tab-switch-label"
            onPointerDown={item.disabled ? undefined : (event) => drag.onPointerDown(event, item.key)}
            onContextMenu={(event) => { if (reorderable) event.preventDefault(); }}
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
        </TabSwitchEntry>
      ))}
      {trailingAction ? (
        <div className="yisi-tab-switch-trailing-action" data-yisiui-slot="trailingAction">
          <BasicButton type="text" size={compact ? "small" : "middle"}
            mode={trailingAction.icon ? "with-icon" : "without-icon"} icon={trailingAction.icon}
            disabled={trailingAction.disabled} onClick={trailingAction.onClick}>{trailingAction.label}</BasicButton>
        </div>
      ) : null}
      </div>
      </div>
      {scroll.edges.overflow ? <BasicButton {...scroll.buttonProps(1)}
        className="yisi-tab-switch-scroll-arrow yisi-tab-switch-scroll-right" type="text" size="small"
        mode="icon-only" icon={scrollArrows?.right?.icon ?? <RightOutlined />}
        iconLabel={scrollArrows?.right?.label ?? "向右滚动标签"} /> : null}
      <span className="yisi-tab-switch-visually-hidden" data-drag-feedback role="status" aria-live="polite" />
    </div>
  );
}
