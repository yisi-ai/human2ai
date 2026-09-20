"use client";

import type { HTMLAttributes, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

import {
  StatusLight,
  type StatusLightColor,
  type StatusLightMotion,
} from "./StatusLight";
import { BorderScan } from "./BorderScan";
import "../../styles/tokens.css";
import "../../styles/status-card.css";

import { uiAssetAttributes } from "../internal/uiAssetAttributes";

export type StatusCardState = "idle" | "running";

export interface StatusCardProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "children" | "title"> {
  title: ReactNode;
  subtitle?: ReactNode;
  state?: StatusCardState;
  statusLightColor?: StatusLightColor;
  statusLightMotion?: StatusLightMotion;
}

interface StatusCardSize {
  width: number;
  height: number;
}

function readStatusCardSize(element: HTMLDivElement): StatusCardSize | null {
  const { width, height } = element.getBoundingClientRect();
  if (width <= 0 || height <= 0) {
    return null;
  }
  return { width, height };
}

function sameStatusCardSize(
  previous: StatusCardSize | null,
  next: StatusCardSize,
): boolean {
  return previous !== null && previous.width === next.width && previous.height === next.height;
}

export function StatusCard({
  title,
  subtitle,
  state = "idle",
  statusLightColor = "green",
  statusLightMotion = "steady",
  className,
  style,
  role,
  "aria-busy": ariaBusy,
  ...divProps
}: StatusCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardSize, setCardSize] = useState<StatusCardSize | null>(null);
  const isRunning = state === "running";
  const isInteractive = typeof divProps.onClick === "function";

  useEffect(() => {
    if (!isRunning) {
      setCardSize(null);
      return;
    }

    const element = cardRef.current;
    if (!element) {
      return;
    }

    const updateSize = () => {
      const nextSize = readStatusCardSize(element);
      if (nextSize === null) {
        return;
      }
      setCardSize((previous) => (sameStatusCardSize(previous, nextSize) ? previous : nextSize));
    };

    updateSize();
    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(updateSize);
    observer.observe(element);
    return () => observer.disconnect();
  }, [isRunning]);

  return (
    <div
      {...divProps}
      {...uiAssetAttributes("status-card", "StatusCard", "card")}
      ref={cardRef}
      className={[
        "yisi-status-card",
        `yisi-status-card-state-${state}`,
        isInteractive ? "yisi-status-card-interactive" : undefined,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      role={role ?? "group"}
      aria-busy={ariaBusy ?? (state === "running" ? true : undefined)}
      style={style}
    >
      <div className="yisi-status-card-content">
        <div className="yisi-status-card-copy">
          <h3 className="yisi-status-card-title">{title}</h3>
          {subtitle === undefined || subtitle === null ? null : (
            <div className="yisi-status-card-subtitle">{subtitle}</div>
          )}
        </div>
        <StatusLight activeColor={statusLightColor} motion={statusLightMotion} />
      </div>
      {isRunning && cardSize !== null ? (
        <BorderScan
          aria-hidden="true"
          className="yisi-status-card-border-scan"
          width={cardSize.width}
          height={cardSize.height}
        >
          {null}
        </BorderScan>
      ) : null}
    </div>
  );
}
