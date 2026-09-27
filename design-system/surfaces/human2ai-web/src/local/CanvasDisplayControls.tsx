"use client";

import { BlockOutlined, EyeOutlined } from "@ant-design/icons";
import { BasicButton } from "@human2ai/ui/yisiui/basic-button";
import type { ReactNode } from "react";
import { uiAssetAttributes } from "../vendor/yisiui/runtime/src/assetMarker";
import zh from "../../../../../locales/zh-CN/common.json";
import "./CanvasDisplayControls.css";

export interface CanvasDisplayOptions {
  showHiddenNodes: boolean;
  onionSkin: boolean;
}

export interface CanvasDisplayControlsProps {
  value: CanvasDisplayOptions;
  onChange: (value: CanvasDisplayOptions) => void;
  hasPreviousState: boolean;
  disabled?: boolean;
  labels?: { showHiddenNodes: string; onionSkin: string };
}

export function CanvasDisplayControls({
  value, onChange, hasPreviousState, disabled = false, labels = zh.canvas.display,
}: CanvasDisplayControlsProps) {
  return (
    <div
      {...uiAssetAttributes({ namespace: "human2ai", id: "canvas-display-controls", name: "CanvasDisplayControls", category: "module", origin: "project", status: "candidate" })}
      className="human2ai-canvas-display-controls"
    >
      {([
        { key: "showHiddenNodes", icon: <EyeOutlined aria-hidden="true" />, enabled: value.showHiddenNodes, disabled },
        { key: "onionSkin", icon: <BlockOutlined aria-hidden="true" />, enabled: value.onionSkin && hasPreviousState, disabled: disabled || !hasPreviousState },
      ] as const).map((option) => (
        <BasicButton key={option.key} mode="with-icon" size="small" icon={option.icon}
          aria-label={labels[option.key]} title={labels[option.key]}
          aria-pressed={option.enabled} disabled={option.disabled}
          backgroundColor={option.enabled ? "color.action.primaryActive" : "none"}
          textColor={option.enabled ? "color.text.onPrimary" : "color.text.secondary"}
          onClick={() => onChange({ ...value, [option.key]: !value[option.key] })}>
          {labels[option.key]}
        </BasicButton>
      ))}
    </div>
  );
}

export function CanvasOnionSkin({ stateId, children }: { stateId: string; children: ReactNode }) {
  return <g className="human2ai-canvas-onion-skin" data-canvas-onion-skin={stateId} aria-hidden="true">{children}</g>;
}
