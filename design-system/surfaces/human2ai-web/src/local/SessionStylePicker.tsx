"use client";

import { CloseOutlined, DownOutlined } from "@ant-design/icons";
import { Modal, Tooltip } from "antd";
import { useId, useState } from "react";

import type { StyleCategory, StyleEntry } from "../../../../../src/domain/style";
import { uiAssetAttributes } from "../vendor/yisiui/runtime/src/assetMarker";
import { BasicButton } from "../vendor/yisiui/runtime/src/components/BasicButton";
import { StyleLibraryView, type StyleLibraryLabels } from "./StyleLibraryView";

import "./SessionStylePicker.css";

export interface SessionStylePickerLabels {
  title: string;
  choose: string;
  dialogTitle: string;
  unbind: string;
  select: string;
  pending: string;
}

export interface SessionStylePickerProps {
  styles: readonly StyleEntry[];
  currentStyle: StyleEntry | null;
  category: StyleCategory;
  labels: SessionStylePickerLabels;
  libraryLabels: StyleLibraryLabels;
  imageUrl: (styleId: string, referenceId: string) => string;
  modelUrl?: (styleId: string, modelId: string) => string;
  onBind: (styleId: string | null) => Promise<void>;
  onRetry: () => void;
  loading?: boolean;
  saving?: boolean;
  disabled?: boolean;
  error?: string | null;
  pending?: boolean;
}

export function SessionStylePicker({
  styles, currentStyle, category, labels, libraryLabels, imageUrl, modelUrl,
  onBind, onRetry, loading = false, saving = false, disabled = false, error, pending = false,
}: SessionStylePickerProps) {
  const [open, setOpen] = useState(false);
  const headingId = useId();

  return (
    <section
      {...uiAssetAttributes({ namespace: "human2ai", id: "session-style-picker", name: "SessionStylePicker", category: "module", origin: "project", status: "candidate" })}
      className="human2ai-session-style-picker"
      aria-labelledby={headingId}
    >
      <h2 id={headingId}>{labels.title}</h2>
      <div className="human2ai-session-style-picker__controls">
        <BasicButton
          className="human2ai-session-style-picker__choose"
          mode="with-icon"
          icon={<DownOutlined aria-hidden="true" />}
          disabled={disabled || saving}
          loading={saving}
          onClick={() => setOpen(true)}
        >{currentStyle?.name ?? labels.choose}</BasicButton>
        {currentStyle ? (
          <Tooltip title={labels.unbind}>
            <BasicButton
              type="text"
              mode="icon-only"
              icon={<CloseOutlined aria-hidden="true" />}
              aria-label={labels.unbind}
              disabled={disabled || saving || loading}
              onClick={() => void onBind(null).catch(() => undefined)}
            />
          </Tooltip>
        ) : null}
      </div>
      {currentStyle && pending ? <p className="human2ai-session-style-picker__status" role="status">{labels.pending}</p> : null}
      {error ? <p className="human2ai-session-style-picker__error" role="alert">{error}</p> : null}
      <Modal
        open={open}
        title={labels.dialogTitle}
        closable={{ "aria-label": libraryLabels.closePreview, disabled: saving }}
        closeIcon={<CloseOutlined aria-hidden="true" />}
        width={1000}
        footer={null}
        onCancel={() => { if (!saving) setOpen(false); }}
        destroyOnHidden
      >
        <StyleLibraryView
          styles={styles}
          labels={libraryLabels}
          loading={loading}
          errorMessage={error}
          imageUrl={imageUrl}
          modelUrl={modelUrl}
          initialCategory={category}
          onRetry={onRetry}
          selection={{
            label: labels.select,
            onSelect: async (style) => {
              await onBind(style.id);
              setOpen(false);
            },
          }}
        />
      </Modal>
    </section>
  );
}
