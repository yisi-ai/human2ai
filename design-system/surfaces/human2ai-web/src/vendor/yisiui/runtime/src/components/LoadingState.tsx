"use client";

import { Skeleton } from "antd";
import type { CSSProperties } from "react";

import "../../styles/tokens.css";
import "../../styles/loading-state.css";

import { uiAssetAttributes } from "../internal/uiAssetAttributes";

export type LoadingStateMotion = "auto" | "none";

export interface LoadingStateProps {
  /** Accessible loading announcement and region name. */
  label: string;
  /** Skeleton paragraph rows. Runtime values are clamped to 1–12. */
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
  rows = DEFAULT_ROWS,
  compact = false,
  motion = "auto",
  className,
  style,
}: LoadingStateProps) {
  const resolvedRows = normalizeRows(rows);

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
      aria-busy="true"
      aria-label={label}
      style={style}
    >
      <span className="yisi-loading-state-announcement" role="status" aria-live="polite">
        {label}
      </span>
      <div className="yisi-loading-state-skeleton" aria-hidden="true">
        <Skeleton
          active={motion === "auto"}
          paragraph={{ rows: resolvedRows }}
          title={{ width: "42%" }}
        />
      </div>
    </section>
  );
}
