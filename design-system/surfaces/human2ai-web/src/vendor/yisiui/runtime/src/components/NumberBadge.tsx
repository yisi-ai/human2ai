"use client";

import type { HTMLAttributes } from "react";

import "../../styles/tokens.css";
import "../../styles/number-badge.css";

import { uiAssetAttributes } from "../internal/uiAssetAttributes";

export const NUMBER_BADGE_DEFAULT_SIZE = 32;
export const NUMBER_BADGE_MIN_VALUE = 1;
export const NUMBER_BADGE_MAX_VALUE = 99;

export interface NumberBadgeProps extends Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
  value: number;
  size?: number;
}

function normalizeValue(value: number): number {
  if (!Number.isFinite(value)) {
    return NUMBER_BADGE_MIN_VALUE;
  }

  return Math.min(NUMBER_BADGE_MAX_VALUE, Math.max(NUMBER_BADGE_MIN_VALUE, Math.trunc(value)));
}

function normalizeSize(size: number): number {
  return Number.isFinite(size) ? Math.max(1, size) : NUMBER_BADGE_DEFAULT_SIZE;
}

export function NumberBadge({
  value,
  size = NUMBER_BADGE_DEFAULT_SIZE,
  className,
  style,
  ...spanProps
}: NumberBadgeProps) {
  const displayValue = normalizeValue(value);
  const fixedSize = `${normalizeSize(size)}px`;

  return (
    <span
      {...spanProps}
      {...uiAssetAttributes("number-badge", "NumberBadge", "component")}
      className={["yisi-number-badge", className].filter(Boolean).join(" ")}
      style={{
        ...style,
        width: fixedSize,
        height: fixedSize,
        minWidth: fixedSize,
        minHeight: fixedSize,
        maxWidth: fixedSize,
        maxHeight: fixedSize,
      }}
    >
      <span className="yisi-number-badge-value">{displayValue}</span>
    </span>
  );
}
