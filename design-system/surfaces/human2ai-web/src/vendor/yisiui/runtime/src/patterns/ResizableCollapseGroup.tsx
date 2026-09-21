"use client";

import { CaretRightOutlined } from "@ant-design/icons";
import { Fragment, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { HTMLAttributes, KeyboardEvent, PointerEvent, ReactNode } from "react";

import { DotScrollbar } from "../components/DotScrollbar";
import { uiAssetAttributes } from "../internal/uiAssetAttributes";
import { allocateCollapseHeights, resizeCollapsePair } from "../internal/resizableCollapseLayout";
import type { CollapsePanelSize } from "../internal/resizableCollapseLayout";

import "../../styles/tokens.css";
import "../../styles/resizable-collapse-group.css";

export interface ResizableCollapseItem {
  key: string;
  title: string;
  content: ReactNode;
  /** Minimum expanded content height in CSS pixels; excludes the fixed header. */
  minHeight?: number;
  /** Locks this panel's toggle and the dividers that resize it. */
  disabled?: boolean;
}

/** Positive relative weights, keyed by panel key. Missing keys have weight 1. */
export type ResizableCollapseSizes = Readonly<Record<string, number>>;

export interface ResizableCollapseGroupProps extends Omit<HTMLAttributes<HTMLDivElement>, "children" | "onChange"> {
  items: readonly ResizableCollapseItem[];
  ariaLabel: string;
  /** Omit for uncontrolled state. An empty array collapses every panel. */
  expandedKeys?: readonly string[];
  /** Defaults to all initial items. */
  defaultExpandedKeys?: readonly string[];
  onExpandedChange?: (keys: string[]) => void;
  sizes?: ResizableCollapseSizes;
  defaultSizes?: ResizableCollapseSizes;
  /** Called during pointer or keyboard resizing, with relative weights, not pixels. */
  onSizesChange?: (sizes: Record<string, number>) => void;
  onResizeEnd?: (sizes: Record<string, number>) => void;
  minPanelHeight?: number;
  /** Applies to each item's own content scroller. Defaults to dots. */
  scrollbar?: "native" | "dots";
  maxScrollDots?: number;
  resizable?: boolean;
  disabled?: boolean;
  resizeLabel?: (upperTitle: string, lowerTitle: string) => string;
  emptyContent?: ReactNode;
}

interface DragSession {
  pointerId: number;
  node: HTMLDivElement;
  startY: number;
  scale: number;
  upperKey: string;
  lowerKey: string;
  panels: CollapsePanelSize[];
  heights: Record<string, number>;
  weights: Record<string, number>;
  latest: Record<string, number>;
  environment: string;
}

const useBrowserLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;
const defaultResizeLabel = (upper: string, lower: string) => `调整“${upper}”与“${lower}”的高度`;

function CollapseContent({ item, expanded, height, contentId, headerId, scrollbar, maxScrollDots, setNode }: {
  item: ResizableCollapseItem;
  expanded: boolean;
  height: number;
  contentId: string;
  headerId: string;
  scrollbar: "native" | "dots";
  maxScrollDots: number;
  setNode: (node: HTMLDivElement | null) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  return <div ref={setNode} className="yisi-resizable-collapse-panel" hidden={!expanded} style={{ height }}>
    <div ref={scrollRef} id={contentId} className="yisi-resizable-collapse-scroll" role="region"
      aria-labelledby={headerId} tabIndex={expanded ? 0 : undefined} data-yisiui-slot="item-content">
      {item.content}
    </div>
    {scrollbar === "dots" && <DotScrollbar targetRef={scrollRef} ariaLabel={`${item.title} · 滚动位置`} maxDots={maxScrollDots} />}
  </div>;
}

export function ResizableCollapseGroup({
  items, ariaLabel, expandedKeys, defaultExpandedKeys, onExpandedChange,
  sizes, defaultSizes = {}, onSizesChange, onResizeEnd, minPanelHeight = 64,
  scrollbar = "dots", maxScrollDots = 12,
  resizable = true, disabled = false, resizeLabel = defaultResizeLabel, emptyContent = null,
  className, onKeyDown, ...rootProps
}: ResizableCollapseGroupProps) {
  const instanceId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const headers = useRef(new Map<string, HTMLButtonElement>());
  const contents = useRef(new Map<string, HTMLDivElement>());
  const dividers = useRef(new Map<string, HTMLDivElement>());
  const drag = useRef<DragSession | null>(null);
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const [internalKeys, setInternalKeys] = useState<readonly string[]>(() => defaultExpandedKeys ?? items.map((item) => item.key));
  const [internalSizes, setInternalSizes] = useState<ResizableCollapseSizes>(defaultSizes);
  const [availableHeight, setAvailableHeight] = useState<number | null>(null);

  const keys = new Set<string>();
  if (!Number.isFinite(minPanelHeight) || minPanelHeight <= 0) {
    throw new Error("ResizableCollapseGroup minPanelHeight must be a positive finite number.");
  }
  for (const item of items) {
    if (!item.key || keys.has(item.key) || !item.title.trim()) {
      throw new Error("ResizableCollapseGroup items require unique non-empty keys and non-empty titles.");
    }
    if (item.minHeight !== undefined && (!Number.isFinite(item.minHeight) || item.minHeight <= 0)) {
      throw new Error("ResizableCollapseGroup item minHeight must be a positive finite number.");
    }
    keys.add(item.key);
  }

  const requestedKeys = new Set(expandedKeys ?? internalKeys);
  const openItems = items.filter((item) => requestedKeys.has(item.key));
  const currentSizes = sizes ?? internalSizes;
  const weights = Object.fromEntries(items.map((item) => {
    const weight = Object.hasOwn(currentSizes, item.key) ? currentSizes[item.key] : 1;
    if (!Number.isFinite(weight) || weight <= 0) {
      throw new Error("ResizableCollapseGroup sizes must contain positive finite weights.");
    }
    return [item.key, weight];
  }));
  const panels = openItems.map((item) => ({ key: item.key, weight: weights[item.key], minHeight: item.minHeight ?? minPanelHeight }));
  const heights = allocateCollapseHeights(panels, availableHeight ?? 0);
  const structure = JSON.stringify(items.map((item) => item.key));
  const environment = JSON.stringify([structure, availableHeight, disabled, resizable,
    items.map((item) => [item.key, item.disabled]), panels.map((panel) => [panel.key, panel.minHeight])]);

  useBrowserLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const measure = () => {
      const measuredHeight = (node: HTMLElement) => parseFloat(getComputedStyle(node).height) || 0;
      const headerHeight = Array.from(headers.current.values()).reduce((sum, node) => sum + measuredHeight(node), 0);
      const dividerHeight = Array.from(dividers.current.values()).reduce((sum, node) => sum + measuredHeight(node), 0);
      const next = Math.max(0, measuredHeight(viewport) - headerHeight - dividerHeight);
      setAvailableHeight((previous) => previous === next ? previous : next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    headers.current.forEach((node) => observer.observe(node));
    dividers.current.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [structure]);

  function changeSizes(next: Record<string, number>) {
    if (sizes === undefined) setInternalSizes(next);
    onSizesChange?.(next);
  }

  function finishDrag(commit: boolean) {
    const session = drag.current;
    if (!session) return;
    drag.current = null;
    setDraggingKey(null);
    if (session.node.hasPointerCapture(session.pointerId)) session.node.releasePointerCapture(session.pointerId);
    if (commit) onResizeEnd?.(session.latest);
    else changeSizes(session.weights);
  }

  useBrowserLayoutEffect(() => {
    // Changing the container or the set of open panels invalidates drag geometry.
    if (drag.current && drag.current.environment !== environment) finishDrag(true);
    const active = viewportRef.current?.ownerDocument.activeElement;
    for (const item of items) {
      if (!requestedKeys.has(item.key) && active && contents.current.get(item.key)?.contains(active)) {
        const header = headers.current.get(item.key);
        if (header && !header.disabled) header.focus();
        else rootRef.current?.focus();
      }
    }
  });

  useEffect(() => () => {
    const session = drag.current;
    drag.current = null;
    if (session?.node.hasPointerCapture(session.pointerId)) session.node.releasePointerCapture(session.pointerId);
  }, []);

  function toggle(key: string) {
    if (drag.current) finishDrag(true);
    const next = items.filter((item) => item.key === key ? !requestedKeys.has(key) : requestedKeys.has(item.key)).map((item) => item.key);
    if (expandedKeys === undefined) setInternalKeys(next);
    onExpandedChange?.(next);
  }

  function startDrag(event: PointerEvent<HTMLDivElement>, upperKey: string, lowerKey: string) {
    if (event.button !== 0 || !event.isPrimary || drag.current) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.focus();
    event.currentTarget.setPointerCapture(event.pointerId);
    const viewport = viewportRef.current!;
    const scale = viewport.getBoundingClientRect().height / viewport.offsetHeight || 1;
    drag.current = { pointerId: event.pointerId, node: event.currentTarget, startY: event.clientY, scale,
      upperKey, lowerKey, panels, heights, weights, latest: weights, environment };
    setDraggingKey(upperKey);
  }

  function moveDrag(event: PointerEvent<HTMLDivElement>) {
    const session = drag.current;
    if (!session || event.pointerId !== session.pointerId) return;
    event.preventDefault();
    if (event.clientY === session.startY && session.latest === session.weights) return;
    const next = resizeCollapsePair(session.panels, session.heights, session.weights, session.upperKey, session.lowerKey,
      session.heights[session.upperKey] + (event.clientY - session.startY) / session.scale);
    session.latest = next;
    changeSizes(next);
  }

  function resizeWithKeyboard(event: KeyboardEvent<HTMLDivElement>, upperKey: string, lowerKey: string) {
    const upper = panels.find((panel) => panel.key === upperKey)!;
    const lower = panels.find((panel) => panel.key === lowerKey)!;
    const step = event.shiftKey ? 32 : 8;
    const target = event.key === "ArrowUp" ? heights[upperKey] - step
      : event.key === "ArrowDown" ? heights[upperKey] + step
      : event.key === "Home" ? upper.minHeight
      : event.key === "End" ? heights[upperKey] + heights[lowerKey] - lower.minHeight : null;
    if (target === null) return;
    event.preventDefault();
    event.stopPropagation();
    if (drag.current) return;
    const next = resizeCollapsePair(panels, heights, weights, upperKey, lowerKey, target);
    changeSizes(next);
    onResizeEnd?.(next);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;
    if (event.key === "Escape" && drag.current) {
      event.preventDefault();
      event.stopPropagation();
      finishDrag(false);
      return;
    }
    const buttons = items.filter((item) => !disabled && !item.disabled).map((item) => headers.current.get(item.key)!);
    const index = buttons.indexOf(event.target as HTMLButtonElement);
    if (index < 0) return;
    const next = event.key === "ArrowUp" ? (index - 1 + buttons.length) % buttons.length
      : event.key === "ArrowDown" ? (index + 1) % buttons.length
      : event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : -1;
    if (next < 0) return;
    event.preventDefault();
    buttons[next].focus();
  }

  const contentId = (key: string) => `${instanceId}-${encodeURIComponent(key)}-content`;
  return (
    <div tabIndex={-1} {...rootProps} {...uiAssetAttributes("resizable-collapse-group", "ResizableCollapseGroup")} ref={rootRef}
      className={["yisi-resizable-collapse-group", className].filter(Boolean).join(" ")}
      role="group" aria-label={ariaLabel} aria-disabled={disabled} data-resizing={draggingKey !== null}
      onKeyDown={handleKeyDown}>
      <div ref={viewportRef} className="yisi-resizable-collapse-viewport">
        {items.length === 0 && <div className="yisi-resizable-collapse-empty" data-yisiui-slot="empty-content">{emptyContent}</div>}
        {items.map((item, index) => {
          const expanded = requestedKeys.has(item.key);
          const openIndex = openItems.findIndex((open) => open.key === item.key);
          const nextOpen = openIndex >= 0 ? openItems[openIndex + 1] : undefined;
          const canResize = resizable && !disabled && !item.disabled && nextOpen && !nextOpen.disabled
            && heights[item.key] + heights[nextOpen.key] > (item.minHeight ?? minPanelHeight) + (nextOpen.minHeight ?? minPanelHeight) + 0.01;
          const headerId = `${instanceId}-${encodeURIComponent(item.key)}-title`;
          return <Fragment key={item.key}>
            <div className="yisi-resizable-collapse-item" data-expanded={expanded}>
              <button ref={(node) => { if (node) headers.current.set(item.key, node); else headers.current.delete(item.key); }}
                id={headerId} className="yisi-resizable-collapse-trigger" type="button" disabled={disabled || item.disabled}
                aria-expanded={expanded} aria-controls={contentId(item.key)} onClick={() => toggle(item.key)} title={item.title}>
                <CaretRightOutlined className="yisi-resizable-collapse-triangle" aria-hidden="true" />
                <span className="yisi-resizable-collapse-title" data-yisiui-slot="item-title">{item.title}</span>
              </button>
              <CollapseContent item={item} expanded={expanded} height={heights[item.key] ?? 0}
                contentId={contentId(item.key)} headerId={headerId} scrollbar={scrollbar} maxScrollDots={maxScrollDots}
                setNode={(node) => { if (node) contents.current.set(item.key, node); else contents.current.delete(item.key); }} />
            </div>
            {index < items.length - 1 && <div
              ref={(node) => { if (node) dividers.current.set(item.key, node); else dividers.current.delete(item.key); }}
              className="yisi-resizable-collapse-divider" data-resizable={Boolean(canResize)} data-active={draggingKey === item.key}
              role={canResize ? "separator" : undefined} aria-hidden={canResize ? undefined : true}
              aria-orientation={canResize ? "horizontal" : undefined} tabIndex={canResize ? 0 : undefined}
              aria-label={canResize ? resizeLabel(item.title, nextOpen!.title) : undefined}
              aria-controls={canResize ? contentId(item.key) : undefined}
              aria-valuemin={canResize ? Math.round(item.minHeight ?? minPanelHeight) : undefined}
              aria-valuemax={canResize ? Math.round(heights[item.key] + heights[nextOpen!.key] - (nextOpen!.minHeight ?? minPanelHeight)) : undefined}
              aria-valuenow={canResize ? Math.round(heights[item.key]) : undefined}
              aria-valuetext={canResize ? `${Math.round(heights[item.key])}px` : undefined}
              onPointerDown={canResize ? (event) => startDrag(event, item.key, nextOpen!.key) : undefined}
              onPointerMove={moveDrag}
              onPointerUp={(event) => { if (event.pointerId === drag.current?.pointerId) { moveDrag(event); finishDrag(true); } }}
              onPointerCancel={(event) => { if (event.pointerId === drag.current?.pointerId) finishDrag(false); }}
              onLostPointerCapture={(event) => { if (event.pointerId === drag.current?.pointerId) finishDrag(true); }}
              onKeyDown={canResize ? (event) => resizeWithKeyboard(event, item.key, nextOpen!.key) : undefined}
            />}
          </Fragment>;
        })}
      </div>
    </div>
  );
}
