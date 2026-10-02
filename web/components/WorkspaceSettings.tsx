"use client";

import { SettingOutlined } from "@ant-design/icons";
import { BasicButton } from "@human2ai/ui/yisiui/basic-button";
import { Human2AiSettingsPanel, type Human2AiSettingsLabels, type RetentionInputs } from "@human2ai/ui";
import { ConfigProvider, Modal } from "antd";
import { antdTheme } from "@human2ai/ui/yisiui/antd-theme";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { RETENTION_DEFAULTS, MAX_RETENTION_DAYS, type WorkspaceSettings as Settings } from "../../src/domain/session/storage";
import type { TrashSession } from "../../src/domain/session/types";
import { getWorkspaceSettings, listTrashSessions, restoreTrashSession, deleteTrashSession, clearTrash, Human2AiApiError } from "../lib/human2ai-api";
import { WorkspaceSettingsAutosave } from "../lib/workspace-settings-autosave";

function inputs(settings: Settings): RetentionInputs {
  return { imageRetentionDays: String(settings.imageRetentionDays), historyRetentionDays: String(settings.historyRetentionDays),
    trashRetentionDays: String(settings.trashRetentionDays) };
}

export function WorkspaceSettings({ onRestored }: { onRestored(): void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  return <>
    <BasicButton mode="icon-only" backgroundColor="none" icon={<SettingOutlined />} iconLabel={t("settings.title")}
      title={t("settings.title")} onClick={() => { setMounted(true); setOpen(true); }} />
    {mounted ? <SettingsDialog open={open} afterClose={() => setMounted(false)} onClose={() => setOpen(false)} onRestored={onRestored} /> : null}
  </>;
}

function SettingsDialog({ open, afterClose, onClose, onRestored }: { open: boolean; afterClose(): void; onClose(): void; onRestored(): void }) {
  const { t, i18n } = useTranslation();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [values, setValues] = useState<RetentionInputs>({ imageRetentionDays: "", historyRetentionDays: "", trashRetentionDays: "" });
  const [sessions, setSessions] = useState<TrashSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [retryAvailable, setRetryAvailable] = useState(false);
  const autosave = useRef<WorkspaceSettingsAutosave | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearTimer = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; };
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(null);
    void Promise.all([getWorkspaceSettings(), listTrashSessions()]).then(([nextSettings, nextSessions]) => {
      if (cancelled) return;
      setSettings(nextSettings); setValues(inputs(nextSettings)); setSessions(nextSessions);
      autosave.current = new WorkspaceSettingsAutosave(nextSettings);
    }).catch(() => { if (!cancelled) setError("errors.operationFailed"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [attempt]);
  useEffect(() => () => {
    clearTimer();
    void autosave.current?.flush().catch(() => {});
  }, []);

  const save = async (retry = false, reset = false) => {
    const queue = autosave.current;
    if (!queue) return true;
    clearTimer();
    setBusy(reset ? "reset" : "save"); setError(null); setRetryAvailable(false);
    try {
      await (retry ? queue.retry() : queue.flush());
      return true;
    } catch (error) {
      setError(error instanceof Human2AiApiError && error.code === "REVISION_CONFLICT" ? "settings.conflict" : "errors.operationFailed");
      setRetryAvailable(true);
      return false;
    } finally { setBusy(null); }
  };
  const change = (key: keyof RetentionInputs, value: string) => {
    setValues(current => ({ ...current, [key]: value }));
    const days = Number(value);
    if (!Number.isInteger(days) || days < 1 || days > MAX_RETENTION_DAYS) return;
    autosave.current?.change(key, days);
    clearTimer();
    timer.current = setTimeout(() => { timer.current = null; void save(); }, 350);
  };
  const reset = () => {
    setValues(current => ({ ...current, imageRetentionDays: String(RETENTION_DEFAULTS.imageRetentionDays),
      historyRetentionDays: String(RETENTION_DEFAULTS.historyRetentionDays) }));
    autosave.current?.change("imageRetentionDays", RETENTION_DEFAULTS.imageRetentionDays);
    autosave.current?.change("historyRetentionDays", RETENTION_DEFAULTS.historyRetentionDays);
    void save(false, true);
  };
  const close = async () => { if (await save()) onClose(); };
  const restore = async (id: string) => {
    const session = sessions.find(item => item.id === id);
    if (!session || busy) return;
    if (!await save()) return;
    setBusy(id); setError(null);
    try {
      await restoreTrashSession(id, session.revision);
      setSessions(current => current.filter(item => item.id !== id));
      onRestored();
    } catch { setError("errors.operationFailed"); }
    finally { setBusy(null); }
  };
  const remove = async (id?: string) => {
    const session = id ? sessions.find(item => item.id === id) : undefined;
    if (busy || (id && !session) || !await save()) return;
    setBusy(id ? `delete:${id}` : "clear-trash"); setError(null);
    try {
      if (session) await deleteTrashSession(session.id, session.revision);
      else await clearTrash();
      setSessions(current => id ? current.filter(item => item.id !== id) : []);
    } catch { setError("errors.operationFailed"); }
    finally { setBusy(null); }
  };
  const labels = Object.fromEntries(["title", "navigationLabel", "close", "autoRelease", "trash", "imageDays", "imageHint",
    "historyDays", "historyHint", "trashDays", "trashHint", "resetDefaults", "restoreSession", "deleteNow", "clearTrash", "clearTrashConfirm",
    "permanentDeleteHint", "emptyTrash", "deletedAt", "loading"]
    .map(key => [key, t(`settings.${key}`)])) as unknown as Human2AiSettingsLabels;
  labels.retry = t("actions.retry");
  labels.cancel = t("actions.cancel");
  labels.deleteNowConfirm = title => t("settings.deleteNowConfirm", { title });
  labels.daysUnit = value => t("settings.daysUnit", { count: Number(value) });
  const invalid = !!settings && Object.values(values).some(value => !Number.isInteger(Number(value)) || Number(value) < 1 || Number(value) > MAX_RETENTION_DAYS);
  return <ConfigProvider theme={antdTheme}><Modal open={open} afterClose={afterClose} centered width={880} footer={null} closable={false} title={labels.title} onCancel={() => { void close(); }}
    styles={{ header: { display: "none" }, body: { padding: 0 } }}>
    <Human2AiSettingsPanel labels={labels} values={values}
      sessions={sessions.map(session => ({ ...session, deletedAt: new Date(session.deletedAt).toLocaleString(i18n.resolvedLanguage) }))}
      loading={loading} error={error ? t(error) : invalid ? t("settings.invalidDays") : null} unavailable={!settings} busy={busy} retryAvailable={retryAvailable}
      onChange={change} onReset={reset}
      onRestore={id => { void restore(id); }} onDelete={remove} onClearTrash={() => remove()}
      onRetry={() => { if (settings) void save(true); else setAttempt(current => current + 1); }} onClose={() => { void close(); }} />
  </Modal></ConfigProvider>;
}
