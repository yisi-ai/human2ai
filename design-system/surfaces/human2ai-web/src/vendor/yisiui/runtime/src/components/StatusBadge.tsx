"use client";

import { CheckCircleOutlined, CloseCircleOutlined, InfoCircleOutlined, LoadingOutlined, WarningOutlined } from "@ant-design/icons";
import { Tag, Tooltip } from "antd";
import type { ReactNode } from "react";

import "../../styles/tokens.css";
import "../../styles/status-badge-base.css";
import "../../styles/status-badge-a11y.css";
import "../../styles/status-badge-antd.css";

import { uiAssetAttributes } from "../internal/uiAssetAttributes";

export type StatusTone = "default" | "info" | "success" | "warning" | "danger" | "processing";
export type StatusBadgeMode = "icon-text" | "text-only" | "icon-only";

const TONE_CONFIG: Record<StatusTone, { color?: string; icon?: ReactNode }> = {
  default: {},
  info: { color: "blue", icon: <InfoCircleOutlined /> },
  success: { color: "green", icon: <CheckCircleOutlined /> },
  warning: { color: "orange", icon: <WarningOutlined /> },
  danger: { color: "red", icon: <CloseCircleOutlined /> },
  processing: { color: "processing", icon: <LoadingOutlined /> },
};

export interface StatusBadgeProps {
  label: ReactNode;
  tone?: StatusTone;
  icon?: ReactNode;
  mode?: StatusBadgeMode;
  tooltip?: ReactNode;
}

export function StatusBadge({
  label,
  tone = "default",
  icon,
  mode = "icon-text",
  tooltip,
}: StatusBadgeProps) {
  const config = TONE_CONFIG[tone];
  const resolvedIcon = icon ?? config.icon;
  const badge = (
    <Tag
      {...uiAssetAttributes("status-badge", "StatusBadge", "component")}
      className={["yisi-status-badge", `yisi-status-badge-${mode}`].join(" ")}
      color={config.color}
      icon={mode === "text-only" ? undefined : resolvedIcon}
      aria-label={mode === "icon-only" && typeof label === "string" ? label : undefined}
    >
      {mode === "icon-only" ? (
        <span className="yisi-status-badge-visually-hidden">{label}</span>
      ) : (
        label
      )}
    </Tag>
  );

  return <Tooltip title={tooltip === undefined ? label : tooltip}>{badge}</Tooltip>;
}
