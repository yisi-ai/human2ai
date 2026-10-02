"use client";

import { DeleteOutlined, FieldTimeOutlined, InfoCircleOutlined } from "@ant-design/icons";
import { BasicButton } from "@human2ai/ui/yisiui/basic-button";
import { ConfirmAction } from "@human2ai/ui/yisiui/confirm-action";
import { LoadingState } from "@human2ai/ui/yisiui/loading-state";
import { SectionNavigationPanel } from "@human2ai/ui/yisiui/section-navigation-panel";
import { Input, Tooltip } from "antd";
import { useId, useState } from "react";
import { MAX_RETENTION_DAYS } from "../../../../../src/domain/session/storage";
import { uiAssetAttributes } from "../vendor/yisiui/runtime/src/assetMarker";
import "./Human2AiSettingsPanel.css";

export interface RetentionInputs {
  imageRetentionDays: string;
  historyRetentionDays: string;
  trashRetentionDays: string;
}
export type SettingsSection = "autoRelease" | "trash";
export interface Human2AiSettingsLabels {
  title: string;
  navigationLabel: string;
  close: string;
  autoRelease: string;
  trash: string;
  imageDays: string;
  imageHint: string;
  historyDays: string;
  historyHint: string;
  trashDays: string;
  trashHint: string;
  resetDefaults: string;
  daysUnit(value: string): string;
  restoreSession: string;
  deleteNow: string;
  deleteNowConfirm(title: string): string;
  clearTrash: string;
  clearTrashConfirm: string;
  permanentDeleteHint: string;
  cancel: string;
  emptyTrash: string;
  deletedAt: string;
  loading: string;
  retry: string;
}
export interface Human2AiSettingsPanelProps {
  labels: Human2AiSettingsLabels;
  values: RetentionInputs;
  sessions: readonly { id: string; title: string; deletedAt: string }[];
  loading?: boolean;
  error?: string | null;
  unavailable?: boolean;
  retryAvailable?: boolean;
  busy?: string | null;
  initialSection?: SettingsSection;
  onChange(key: keyof RetentionInputs, value: string): void;
  onReset(): void;
  onRestore(id: string): void;
  onDelete(id: string): void | Promise<void>;
  onClearTrash(): void | Promise<void>;
  onRetry(): void;
  onClose(): void;
}

export function Human2AiSettingsPanel({ labels, values, sessions, loading, error, unavailable, retryAvailable, busy,
  initialSection = "autoRelease", onChange, onReset, onRestore, onDelete, onClearTrash, onRetry, onClose }: Human2AiSettingsPanelProps) {
  const [section, setSection] = useState<SettingsSection>(initialSection);
  const id = useId();
  const field = (key: keyof RetentionInputs, label: string, hint: string) => <div className="human2ai-settings__field">
    <div className="human2ai-settings__label"><label htmlFor={`${id}-${key}`}>{label}</label>
      <Tooltip title={hint}><InfoCircleOutlined tabIndex={0} aria-label={hint} /></Tooltip>
    </div>
    <div className="human2ai-settings__value">
      <Input id={`${id}-${key}`} type="number" min={1} max={MAX_RETENTION_DAYS} step={1} inputMode="numeric"
        aria-describedby={`${id}-${key}-unit`} value={values[key]} disabled={!!busy && busy !== "save"}
        onChange={event => onChange(key, event.target.value)} />
      <span id={`${id}-${key}-unit`}>{labels.daysUnit(values[key])}</span>
    </div>
  </div>;
  return <section className="human2ai-settings" {...uiAssetAttributes({ namespace: "human2ai", id: "settings-panel",
    name: "Human2AiSettingsPanel", category: "module", origin: "project", status: "candidate" })}>
    <SectionNavigationPanel title={labels.title} closeLabel={labels.close}
    navigationLabel={labels.navigationLabel} activeKey={section} onClose={onClose}
    items={[{ key: "autoRelease", label: labels.autoRelease, icon: <FieldTimeOutlined aria-hidden="true" /> },
      { key: "trash", label: labels.trash, icon: <DeleteOutlined aria-hidden="true" /> }]}
    onActiveKeyChange={key => setSection(key as SettingsSection)}
    content={<div className={`human2ai-settings__content${section === "trash" ? " human2ai-settings__content--trash" : ""}`}>
      {error ? <div role="alert" className="human2ai-settings__error">{error}
        {retryAvailable ? <BasicButton disabled={!!busy} onClick={onRetry}>{labels.retry}</BasicButton> : null}
      </div> : null}
      {loading ? <LoadingState label={labels.loading} rows={3} /> : unavailable ? <BasicButton onClick={onRetry}>{labels.retry}</BasicButton> : <>
        <div>
          {section === "autoRelease" ? <>
            {field("imageRetentionDays", labels.imageDays, labels.imageHint)}
            {field("historyRetentionDays", labels.historyDays, labels.historyHint)}
          </> : field("trashRetentionDays", labels.trashDays, labels.trashHint)}
          {section === "autoRelease" ? <div className="human2ai-settings__actions">
            <BasicButton loading={busy === "reset"} disabled={!!busy && busy !== "save"} onClick={onReset}>{labels.resetDefaults}</BasicButton>
          </div> : null}
        </div>
        {section === "trash" ? <div className="human2ai-settings__trash">
          <div className="human2ai-settings__actions">
            <ConfirmAction title={labels.clearTrashConfirm} description={labels.permanentDeleteHint}
              confirmLabel={labels.clearTrash} cancelLabel={labels.cancel} loading={busy === "clear-trash"}
              disabled={!!busy || !sessions.length} onConfirm={onClearTrash}>{labels.clearTrash}</ConfirmAction>
          </div>
          <div className="human2ai-settings__trash-list">
          {sessions.length ? sessions.map(session => <div className="human2ai-settings__session" key={session.id}>
            <div className="human2ai-settings__session-info">
              <div className="human2ai-settings__session-title" title={session.title}>{session.title}</div>
              <div className="human2ai-settings__timestamp">{labels.deletedAt} · {session.deletedAt}</div>
            </div>
            <BasicButton size="small" color="primary" variant="solid" loading={busy === session.id} disabled={!!busy}
              onClick={() => onRestore(session.id)}>{labels.restoreSession}</BasicButton>
            <ConfirmAction size="small" title={labels.deleteNowConfirm(session.title)} description={labels.permanentDeleteHint}
              confirmLabel={labels.deleteNow} cancelLabel={labels.cancel} loading={busy === `delete:${session.id}`}
              disabled={!!busy} onConfirm={() => onDelete(session.id)}>{labels.deleteNow}</ConfirmAction>
          </div>) : <div className="human2ai-settings__empty">{labels.emptyTrash}</div>}
          </div>
        </div> : null}
      </>}
    </div>} />
  </section>;
}
