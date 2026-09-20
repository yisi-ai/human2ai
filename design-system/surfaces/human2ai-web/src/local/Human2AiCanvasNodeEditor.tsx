"use client";

import {
  TextMarkEditor,
  TextMarkEditorField,
  TextMarkEditorTextArea,
} from "@human2ai/ui/yisiui/text-mark-editor";
import { Select } from "antd";
import type { CSSProperties, ReactNode } from "react";

import type {
  CompositionNodeMetadata,
  CompositionNodeMetadataPatch,
  CompositionShotScale,
} from "../../../../../src/domain/composition";
import { uiAssetAttributes } from "../vendor/yisiui/runtime/src/assetMarker";

import "./Human2AiCanvasNodeEditor.css";

export type Human2AiCanvasNodeKind = "shape" | "point" | "line" | "text" | "image";
export type Human2AiCanvasNodeEditorAutoFocusField = "note" | "none";

export interface Human2AiCanvasNodeEditorLabels {
  title: string;
  note: string;
  notePlaceholder: string;
  shotScale: string;
  shotScaleAuto: string;
  shotScaleForeground: string;
  shotScaleMidground: string;
  shotScaleBackground: string;
  deleteNode: string;
  confirmDeleteNode: string;
  cancelDelete: string;
  shapeKind: string;
  pointKind: string;
  lineKind: string;
  textKind: string;
  imageKind: string;
  nodeDescription: string;
  originUser: string;
  originAgent: string;
  originImport: string;
}

export interface Human2AiCanvasNodeEditorProps {
  nodeKind: Human2AiCanvasNodeKind;
  metadata: CompositionNodeMetadata;
  onMetadataChange: (patch: CompositionNodeMetadataPatch) => void;
  onRequestClose: () => void;
  onDelete?: () => void;
  labels?: Partial<Human2AiCanvasNodeEditorLabels>;
  leadingFields?: ReactNode;
  propertyFields?: ReactNode;
  trailingFields?: ReactNode;
  autoFocusField?: Human2AiCanvasNodeEditorAutoFocusField;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
  "aria-label"?: string;
}

const DEFAULT_LABELS: Human2AiCanvasNodeEditorLabels = {
  title: "编辑节点",
  note: "备注",
  notePlaceholder: "说明这个节点表达什么",
  shotScale: "景别",
  shotScaleAuto: "自动",
  shotScaleForeground: "前景",
  shotScaleMidground: "中景",
  shotScaleBackground: "背景",
  deleteNode: "删除节点",
  confirmDeleteNode: "确认删除这个节点？",
  cancelDelete: "保留",
  shapeKind: "形状",
  pointKind: "点",
  lineKind: "线",
  textKind: "文字",
  imageKind: "图像",
  nodeDescription: "节点说明",
  originUser: "user",
  originAgent: "agent",
  originImport: "import",
};

export function Human2AiCanvasNodeEditor({
  nodeKind,
  metadata,
  onMetadataChange,
  onRequestClose,
  onDelete,
  labels: labelOverrides,
  leadingFields,
  propertyFields,
  trailingFields,
  autoFocusField = "note",
  disabled = false,
  className,
  style,
  "aria-label": ariaLabel,
}: Human2AiCanvasNodeEditorProps) {
  const labels = { ...DEFAULT_LABELS, ...labelOverrides };
  const kind = kindLabel(nodeKind, labels);
  const shotScaleOptions: Array<{ value: CompositionShotScale; label: string }> = [
    { value: "auto", label: labels.shotScaleAuto },
    { value: "foreground", label: labels.shotScaleForeground },
    { value: "midground", label: labels.shotScaleMidground },
    { value: "background", label: labels.shotScaleBackground },
  ];

  return (
    <TextMarkEditor
      open
      title={`${labels.title} · ${kind}`}
      selectedText={kind}
      selectedTextLabel={labels.title}
      saveLabel=""
      cancelLabel=""
      onCancel={onRequestClose}
      onSave={() => undefined}
      deleteAction={onDelete && !disabled ? {
        label: labels.deleteNode,
        confirmTitle: labels.confirmDeleteNode,
        confirmCancelLabel: labels.cancelDelete,
        onConfirm: onDelete,
      } : undefined}
    >
      <div
        {...uiAssetAttributes({
          namespace: "human2ai",
          id: "canvas-node-editor",
          name: "Human2AiCanvasNodeEditor",
          category: "module",
          origin: "project",
          status: "candidate",
        })}
        className={["human2ai-canvas-node-editor", className].filter(Boolean).join(" ")}
        style={style}
        aria-label={ariaLabel}
        aria-disabled={disabled || undefined}
        data-human2ai-auto-save-node-editor
        data-node-kind={nodeKind}
        data-empty={metadata.note || metadata.shotScale !== "auto" ? "false" : "true"}
      >
        <div className="human2ai-canvas-node-editor__primary-fields">
          <span className="human2ai-canvas-node-editor__origin">
            {metadata.origin === "agent" ? labels.originAgent : metadata.origin === "import" ? labels.originImport : labels.originUser}
          </span>
          {metadata.origin !== "user" && metadata.annotation.trim() ? (
            <TextMarkEditorField label={labels.nodeDescription}>
              <p className="human2ai-canvas-node-editor__description">{metadata.annotation}</p>
            </TextMarkEditorField>
          ) : null}
          {leadingFields}

          <TextMarkEditorField label={labels.note}>
            <TextMarkEditorTextArea
              name="nodeNote"
              autoFocus={autoFocusField === "note"}
              value={metadata.note}
              placeholder={labels.notePlaceholder}
              aria-label={labels.note}
              disabled={disabled}
              onChange={(event) => onMetadataChange({ note: event.target.value })}
            />
          </TextMarkEditorField>

          <div className="human2ai-canvas-node-editor__properties">
            <TextMarkEditorField label={labels.shotScale}>
              <Select
                className="human2ai-canvas-node-editor__property-select human2ai-canvas-node-editor__shot-scale-select"
                value={metadata.shotScale}
                options={shotScaleOptions}
                aria-label={labels.shotScale}
                disabled={disabled}
                onChange={(shotScale: CompositionShotScale) => onMetadataChange({ shotScale })}
              />
            </TextMarkEditorField>
            {propertyFields}
          </div>
        </div>

        {trailingFields ? (
          <aside className="human2ai-canvas-node-editor__side-fields">
            {trailingFields}
          </aside>
        ) : null}
      </div>
    </TextMarkEditor>
  );
}

function kindLabel(
  kind: Human2AiCanvasNodeKind,
  labels: Human2AiCanvasNodeEditorLabels,
): string {
  if (kind === "shape") return labels.shapeKind;
  if (kind === "point") return labels.pointKind;
  if (kind === "line") return labels.lineKind;
  if (kind === "text") return labels.textKind;
  return labels.imageKind;
}
