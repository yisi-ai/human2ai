"use client";

import { Skeleton } from "antd";
import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";

import "../../styles/tokens.css";
import "../../styles/loading-state.css";

import { uiAssetAttributes } from "../internal/uiAssetAttributes";

export type LoadingStateMotion = "auto" | "none";
export type LoadingStateVariant = "text" | "image";

export interface LoadingStateProps {
  /** Accessible loading announcement and region name. */
  label: string;
  /** Defaults to text. Image fills the same loading region. */
  variant?: LoadingStateVariant;
  /** Omit to fill available height. Explicit values retain the 1–12 row limit. */
  rows?: number;
  compact?: boolean;
  /** `auto` animates unless the user requests reduced motion. */
  motion?: LoadingStateMotion;
  className?: string;
  style?: CSSProperties;
}

const DEFAULT_ROWS = 4;
const MAX_ROWS = 12;

function normalizeRows(rows: number): number {
  if (!Number.isFinite(rows)) return DEFAULT_ROWS;
  return Math.min(MAX_ROWS, Math.max(1, Math.trunc(rows)));
}

export function LoadingState({
  label,
  variant = "text",
  rows,
  compact = false,
  motion = "auto",
  className,
  style,
}: LoadingStateProps) {
  const skeletonRef = useRef<HTMLDivElement>(null);
  const [autoRows, setAutoRows] = useState(DEFAULT_ROWS);
  const automatic = rows === undefined;
  const resolvedRows = automatic ? autoRows : normalizeRows(rows);

  useLayoutEffect(() => {
    const element = skeletonRef.current;
    if (!element || !automatic || variant !== "text") return;
    let frame: number | undefined;
    const measure = () => {
      const title = element.querySelector<HTMLElement>(".ant-skeleton-title");
      if (!title) return;
      const titleStyle = getComputedStyle(title);
      const styles = getComputedStyle(element);
      const lineHeight = parseFloat(styles.getPropertyValue("--yisiui-loading-state-line-height")) || 16;
      const gap = parseFloat(styles.getPropertyValue("--yisiui-loading-state-line-gap")) || 16;
      const titleSpace = title.getBoundingClientRect().height + (parseFloat(titleStyle.marginBottom) || 0);
      const height = element.getBoundingClientRect().height;
      if (height <= 0) return;
      const next = Math.max(0, Math.floor((height - titleSpace + gap) / (lineHeight + gap)));
      setAutoRows((previous) => previous === next ? previous : next);
    };
    const schedule = () => {
      if (frame !== undefined) return;
      frame = requestAnimationFrame(() => { frame = undefined; measure(); });
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(schedule);
    observer?.observe(element);
    window.addEventListener("resize", schedule);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", schedule);
      if (frame !== undefined) cancelAnimationFrame(frame);
    };
  }, [automatic, compact, variant]);

  return (
    <section
      {...uiAssetAttributes("loading-state", "LoadingState")}
      className={[
        "yisi-loading-state",
        compact ? "yisi-loading-state-compact" : null,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      data-density={compact ? "compact" : "default"}
      data-motion={motion}
      data-variant={variant}
      data-rows={automatic ? "auto" : "fixed"}
      aria-busy="true"
      aria-label={label}
      style={style}
    >
      <span className="yisi-loading-state-announcement" role="status" aria-live="polite">
        {label}
      </span>
      <div ref={skeletonRef} className="yisi-loading-state-skeleton" aria-hidden="true">
        {variant === "image" ? <Skeleton.Image active={motion === "auto"} /> : <Skeleton
          active={motion === "auto"}
          paragraph={{ rows: resolvedRows }}
          title={{ width: "42%" }}
        />}
      </div>
    </section>
  );
}
