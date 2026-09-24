"use client";

import { useRef } from "react";
import type { CSSProperties, HTMLAttributes, KeyboardEvent, RefObject } from "react";

import { uiAssetAttributes } from "../internal/uiAssetAttributes";
import { useDotScrollbar } from "../internal/useDotScrollbar";

import "../../styles/tokens.css";
import "../../styles/dot-scrollbar.css";

export interface DotScrollbarProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  /** Attach to the actual vertical scrolling element; render the dots beside it. */
  targetRef: RefObject<HTMLElement | null>;
  ariaLabel: string;
  /** At least 2. Available rail height may reduce this limit further. Defaults to 12. */
  maxDots?: number;
  hideNativeScrollbar?: boolean;
  behavior?: "auto" | "smooth";
  disabled?: boolean;
  /** Outline color of non-current, hollow dots. */
  dotColor?: string;
  /** Outline and fill color of the solid dot marking the current region. */
  activeColor?: string;
  /** Receives a one-based segment index and the displayed dot count. */
  getDotLabel?: (index: number, count: number) => string;
}

const defaultDotLabel = (index: number, count: number) => `滚动到第 ${index} 段，共 ${count} 段`;

export function DotScrollbar({
  targetRef, ariaLabel, maxDots = 12, hideNativeScrollbar = true, behavior = "smooth", disabled = false,
  dotColor, activeColor, getDotLabel = defaultDotLabel, className, style, onKeyDown, ...rootProps
}: DotScrollbarProps) {
  const railRef = useRef<HTMLDivElement>(null);
  if (!Number.isInteger(maxDots) || maxDots < 2) throw new Error("DotScrollbar maxDots must be an integer of at least 2.");
  const { positions, activeIndex, pageCount, targetId } = useDotScrollbar(targetRef, railRef, maxDots, hideNativeScrollbar);

  function scrollTo(index: number) {
    const target = targetRef.current;
    if (!target || disabled || positions[index] === undefined) return;
    const reduced = target.ownerDocument.defaultView?.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollTo({ top: positions[index], behavior: reduced || behavior === "auto" ? "instant" : "smooth" });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    onKeyDown?.(event);
    if (event.defaultPrevented || disabled) return;
    const buttons = Array.from(railRef.current?.querySelectorAll<HTMLButtonElement>("button[data-dot-index]") ?? []);
    const index = buttons.indexOf(event.target as HTMLButtonElement);
    if (index < 0) return;
    const next = event.key === "ArrowUp" || event.key === "PageUp" ? Math.max(0, index - 1)
      : event.key === "ArrowDown" || event.key === "PageDown" ? Math.min(buttons.length - 1, index + 1)
      : event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : -1;
    if (next < 0) return;
    event.preventDefault();
    event.stopPropagation();
    buttons[next].focus({ preventScroll: true });
    scrollTo(next);
  }

  const rootStyle = {
    ...style,
    ...(dotColor ? { "--yisiui-dot-scrollbar-color": dotColor } : {}),
    ...(activeColor ? { "--yisiui-dot-scrollbar-active-color": activeColor } : {}),
  } as CSSProperties;
  return <div {...rootProps} {...uiAssetAttributes("dot-scrollbar", "DotScrollbar")} ref={railRef}
    className={["yisi-dot-scrollbar", className].filter(Boolean).join(" ")} style={rootStyle}
    role="group" aria-label={ariaLabel} aria-disabled={disabled} aria-hidden={positions.length === 0 ? true : undefined}
    data-visible={positions.length > 0} data-page-count={pageCount} onKeyDown={handleKeyDown}>
    {positions.map((position, index) => <button key={index} type="button" className="yisi-dot-scrollbar-stop"
      data-dot-index={index} data-scroll-top={position} data-current={index === activeIndex}
      aria-current={index === activeIndex ? "location" : undefined} aria-controls={targetId}
      aria-label={getDotLabel(index + 1, positions.length)} title={getDotLabel(index + 1, positions.length)}
      disabled={disabled} tabIndex={index === activeIndex ? 0 : -1} onClick={() => scrollTo(index)}>
      <span className="yisi-dot-scrollbar-dot" aria-hidden="true" />
    </button>)}
  </div>;
}
