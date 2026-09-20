"use client";

import type { HTMLAttributes } from "react";

import "../../styles/tokens.css";
import "../../styles/status-light.css";

import { uiAssetAttributes } from "../internal/uiAssetAttributes";

export const STATUS_LIGHT_COLORS = ["green", "yellow", "red"] as const;
export type StatusLightColor = (typeof STATUS_LIGHT_COLORS)[number];
export type StatusLightMotion = "steady" | "blink";
export const STATUS_LIGHT_BACKGROUND_MODES = ["none", "dark"] as const;
export type StatusLightBackgroundMode = (typeof STATUS_LIGHT_BACKGROUND_MODES)[number];

const COLOR_LABELS: Record<StatusLightColor, string> = {
  green: "绿色",
  yellow: "黄色",
  red: "红色",
};

export interface StatusLightProps extends Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
  activeColor?: StatusLightColor;
  motion?: StatusLightMotion;
  backgroundMode?: StatusLightBackgroundMode;
}

export function StatusLight({
  activeColor = "green",
  motion = "steady",
  backgroundMode = "none",
  className,
  style,
  role,
  "aria-label": ariaLabel,
  ...spanProps
}: StatusLightProps) {
  const resolvedAriaLabel =
    ariaLabel ?? `${COLOR_LABELS[activeColor]}状态灯，${motion === "blink" ? "闪烁" : "常亮"}`;

  return (
    <span
      {...spanProps}
      {...uiAssetAttributes("status-light", "StatusLight", "component")}
      className={[
        "yisi-status-light",
        `yisi-status-light-motion-${motion}`,
        `yisi-status-light-background-${backgroundMode}`,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      role={role ?? "img"}
      aria-label={resolvedAriaLabel}
      style={style}
    >
      {STATUS_LIGHT_COLORS.map((color) => (
        <span
          key={color}
          className={[
            "yisi-status-light-lamp",
            `yisi-status-light-lamp-${color}`,
            color === activeColor ? "yisi-status-light-lamp-active" : undefined,
          ]
            .filter(Boolean)
            .join(" ")}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}
