"use client";

import { useReducer, useRef } from "react";
import { LockOutlined, ReloadOutlined, UnlockOutlined } from "@ant-design/icons";
import { BasicButton } from "@human2ai/ui/yisiui/basic-button";
import { AspectRatioSelector } from "@human2ai/ui/yisiui/aspect-ratio-selector";
import { DEFAULT_CANVAS_FRAME, MINIMUM_CANVAS_FRAME_SIZE, canvasFrameForRatio, resizeCanvasFrame, type CanvasFrameBounds } from "../../../../../src/domain/canvas-frame";
import { uiAssetAttributes } from "../vendor/yisiui/runtime/src/assetMarker";
import "./CanvasFrameControls.css";

export interface CanvasFrameControlsProps {
  frame: CanvasFrameBounds;
  name: string;
  locked: boolean;
  disabled?: boolean;
  onChange: (frame: CanvasFrameBounds) => void;
  onLockedChange: (locked: boolean) => void;
  labels: { reset: string; lock: string; unlock: string; size: string; width: string; height: string };
}

/** Shared UI-frame controls: numeric values are pixels; presets retain the width. */
export function CanvasFrameControls({ frame, name, locked, disabled, onChange, onLockedChange, labels }: CanvasFrameControlsProps) {
  const presetChange = useRef(false);
  const [, refreshInputs] = useReducer((revision: number) => revision + 1, 0);
  const change = (next: CanvasFrameBounds) => { if (next !== frame) onChange(next); };
  const inputDimension = (target: EventTarget | null) => {
    if (!(target instanceof HTMLInputElement) || target.type !== "number") return null;
    const label = target.getAttribute("aria-label");
    return label === labels.width ? "width" : label === labels.height ? "height" : null;
  };
  const changeInput = (dimension: "width" | "height", value: number) => {
    change(resizeCanvasFrame(frame, { ...frame, [dimension]: Math.max(MINIMUM_CANVAS_FRAME_SIZE, Math.round(value)) }));
    // Resync the selector's input even when rounding leaves the draft unchanged.
    refreshInputs();
  };
  return <section {...uiAssetAttributes({ namespace: "human2ai", id: "canvas-frame-controls", name: "CanvasFrameControls",
    category: "module", origin: "project", status: "candidate" })}>
    <div className="human2ai-canvas-frame-controls__heading">
      <h2>{name}</h2>
      <div className="human2ai-canvas-frame-controls__actions">
        <BasicButton mode="icon-only" size="small" icon={<ReloadOutlined />}
          iconLabel={labels.reset} title={labels.reset} backgroundColor="none" textColor="color.text.secondary"
          disabled={disabled || locked} onClick={() => onChange({ ...DEFAULT_CANVAS_FRAME })} />
        <BasicButton mode="icon-only" size="small" icon={locked ? <LockOutlined /> : <UnlockOutlined />}
          iconLabel={locked ? labels.unlock : labels.lock} title={locked ? labels.unlock : labels.lock}
          aria-pressed={locked} backgroundColor={locked ? "color.action.primaryActive" : "none"}
          textColor={locked ? "color.text.onPrimary" : "color.text.secondary"}
          disabled={disabled} onClick={() => onLockedChange(!locked)} />
      </div>
    </div>
    <div className="human2ai-canvas-frame-controls__size"
      onKeyDownCapture={event => {
        const dimension = inputDimension(event.target);
        if (!dimension || event.ctrlKey || event.metaKey || event.altKey) return;
        if ([".", ",", "e", "E", "+", "-"].includes(event.key)) event.preventDefault();
        if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
        event.preventDefault();
        const input = event.target as HTMLInputElement;
        const value = Number.isFinite(input.valueAsNumber) ? input.valueAsNumber : frame[dimension];
        changeInput(dimension, Math.round(value) + (event.key === "ArrowUp" ? 1 : -1));
      }}
      onPasteCapture={event => {
        const dimension = inputDimension(event.target);
        if (!dimension) return;
        const text = event.clipboardData.getData("text/plain").trim();
        const value = Number(text);
        if (!text || !Number.isFinite(value) || /^\d+$/.test(text)) return;
        event.preventDefault();
        changeInput(dimension, value);
      }}>
      <AspectRatioSelector ratio={{ width: Math.max(1, Math.round(frame.width)), height: Math.max(1, Math.round(frame.height)) }} disabled={disabled || locked}
        onChange={(_key, option) => { presetChange.current = true; change(canvasFrameForRatio(frame, option)); }}
        onRatioChange={(size) => {
          if (presetChange.current) { presetChange.current = false; return; }
          change(resizeCanvasFrame(frame, size));
          if (!Number.isInteger(size.width) || !Number.isInteger(size.height)) refreshInputs();
        }} title={labels.size} widthLabel={labels.width} heightLabel={labels.height} aria-label={name} />
    </div>
  </section>;
}
