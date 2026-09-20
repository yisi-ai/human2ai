"use client";

import { RedoOutlined, UndoOutlined } from "@ant-design/icons";
import { BasicButton } from "@human2ai/ui/yisiui/basic-button";
import { useEffect, useState } from "react";
import { uiAssetAttributes } from "../vendor/yisiui/runtime/src/assetMarker";
import "./CanvasHistoryControls.css";

export interface CanvasHistoryControlsProps {
  canUndo: boolean;
  canRedo: boolean;
  undo(): void;
  redo(): void;
  labels: { undo: string; redo: string; label: string };
}

export function CanvasHistoryControls({ canUndo, canRedo, undo, redo, labels }: CanvasHistoryControlsProps) {
  const [mac, setMac] = useState(false);
  useEffect(() => { setMac(/Mac/.test(navigator.platform)); }, []);
  return <div {...uiAssetAttributes({ namespace: "human2ai", id: "canvas-history-controls", name: "CanvasHistoryControls", category: "module", origin: "project", status: "candidate" })}
    className="human2ai-canvas-history-controls" role="group" aria-label={labels.label}>
    <BasicButton mode="icon-only" size="small" icon={<UndoOutlined aria-hidden="true" />} iconLabel={labels.undo}
      title={`${labels.undo} (${mac ? "⌘Z" : "Ctrl+Z"})`} aria-keyshortcuts="Control+z Meta+z"
      disabled={!canUndo} onClick={undo} />
    <BasicButton mode="icon-only" size="small" icon={<RedoOutlined aria-hidden="true" />} iconLabel={labels.redo}
      title={`${labels.redo} (${mac ? "⌘⇧Z" : "Ctrl+Shift+Z"})`} aria-keyshortcuts="Control+Shift+z Meta+Shift+z Control+y"
      disabled={!canRedo} onClick={redo} />
  </div>;
}
