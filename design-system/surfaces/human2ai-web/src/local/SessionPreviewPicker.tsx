import { useMemo, type ReactNode } from "react";
import { Alert, Modal, Spin } from "antd";
import { BasicButton } from "@human2ai/ui/yisiui/basic-button";
import { CascadeSelector, type CascadeSelectorLabels, type CascadeSelectorOption } from "@human2ai/ui/yisiui/cascade-selector";
import { uiAssetAttributes } from "../vendor/yisiui/runtime/src/assetMarker";
import "./SessionPreviewPicker.css";

export interface SessionPreviewPickerLabels {
  group: string; session: string; output: string; label: string;
  projectRequired: string; cancel: string; create: string; retry: string;
}

export interface SessionPreviewPickerProps {
  open: boolean;
  mode: "create" | "edit";
  labels: SessionPreviewPickerLabels;
  selectorLabels: CascadeSelectorLabels;
  options: readonly CascadeSelectorOption[];
  value: readonly string[];
  title?: ReactNode;
  actions?: ReactNode;
  deleteAction?: ReactNode;
  preview?: ReactNode;
  previewActions?: ReactNode;
  previewUrl?: string;
  loading?: boolean;
  saving?: boolean;
  error?: string;
  warning?: string;
  projectRequired?: boolean;
  onChange(value: string[]): void;
  onRetry(): void;
  onCancel(): void;
  onInsert?(): void;
  onPreviewError?(): void;
}

export function SessionPreviewPicker(props: SessionPreviewPickerProps) {
  const { labels, loading, saving } = props;
  const columns = useMemo(() => [
    { "aria-label": labels.group, width: 1, loading },
    { "aria-label": labels.session, width: 1.5, loading },
    { "aria-label": labels.output, width: 1, loading },
  ], [labels.group, labels.session, labels.output, loading]);
  return <Modal open={props.open} title={props.title ?? labels.label} width={920}
    onCancel={() => { if (!saving) props.onCancel(); }} closable={{ "aria-label": labels.cancel, disabled: saving }}
    keyboard={!saving} mask={{ closable: !saving }} destroyOnHidden
    footer={props.mode === "create" ? <BasicButton type="primary" loading={saving}
      disabled={loading || saving || !props.previewUrl || Boolean(props.error)} onClick={props.onInsert}>{labels.create}</BasicButton>
      : props.deleteAction ? <div className="human2ai-session-preview-picker__delete-action">{props.deleteAction}</div> : null}>
    <div {...uiAssetAttributes({ namespace: "human2ai", id: "session-preview-picker", name: "SessionPreviewPicker", category: "module", origin: "project", status: "candidate" })}
      className="human2ai-session-preview-picker" aria-busy={saving || loading || undefined}>
      {props.projectRequired ? <Alert type="info" title={labels.projectRequired} /> : <>
        <CascadeSelector aria-label={labels.label} options={props.options} columns={columns}
          value={props.value} onChange={props.onChange} disabled={loading} height={250} width="100%" labels={props.selectorLabels} />
        {props.error && <Alert type="error" title={props.error} action={<BasicButton onClick={props.onRetry}>{labels.retry}</BasicButton>} />}
        {props.warning && <Alert type="warning" title={props.warning} />}
      </>}
      <div className="human2ai-session-preview-picker__content">
        <div className="human2ai-session-preview-picker__actions">{props.actions}</div>
        <div className="human2ai-session-preview-picker__preview-column">
          <Spin spinning={Boolean(saving)}>
            <div className="human2ai-session-preview-picker__preview">
              {props.preview ?? (props.previewUrl && <img key={props.previewUrl} src={props.previewUrl}
                alt={labels.label} onError={props.onPreviewError} draggable={false} />)}
            </div>
          </Spin>
          {props.previewActions && <div className="human2ai-session-preview-picker__preview-actions">{props.previewActions}</div>}
        </div>
      </div>
    </div>
  </Modal>;
}
