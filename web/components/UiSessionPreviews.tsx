"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import { AppstoreOutlined } from "@ant-design/icons";
import { BasicButton } from "@human2ai/ui/yisiui/basic-button";
import { CompositeButton } from "@human2ai/ui/yisiui/composite-button";
import type { CascadeSelectorOption } from "@human2ai/ui/yisiui/cascade-selector";
import { SessionPreviewPicker, type UiSketchSessionPreviewEditorProps } from "@human2ai/ui";
import type { UiSketchImage } from "../../src/domain/ui-sketch/types";
import { previewSourceKey, type SessionPreviewSource } from "../../src/domain/session/preview";
import type { MaterializedSessionPreview } from "../../src/domain/ui-sketch/session-preview";
import { getSession, listSessionGroups, listSessionPreviewSources, materializeSessionPreview, sessionPreviewUrl, subscribeSessionPreviews, type SessionGroup, type SessionPreviewSourceOption } from "../lib/human2ai-api";

export function SessionPreviewAction({ sessionId, onInsert, disabled = false }: {
  sessionId: string | null; onInsert(preview: MaterializedSessionPreview): void; disabled?: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [sessionId]);
  return <>
    <CompositeButton icon={<AppstoreOutlined aria-hidden="true" />} label={t("sessionPreview.label")}
      collapsedLabel={t("sessionPreview.add")} disabled={disabled} onClick={() => setOpen(true)} />
    {open && <SessionPreviewEditor key={sessionId} sessionId={sessionId} onCommit={onInsert} onCancel={() => setOpen(false)} />}
  </>;
}

export function SessionPreviewProperties({ sessionId, onReplace, ...props }: UiSketchSessionPreviewEditorProps & { sessionId: string }) {
  return <SessionPreviewEditor {...props} sessionId={sessionId} onCommit={onReplace} />;
}

interface PreviewSources {
  sources: SessionPreviewSourceOption[];
  groups: SessionGroup[];
  projectRequired: boolean;
}

function SessionPreviewEditor({ sessionId, onCommit, onCancel, image, title, actions, deleteAction, preview, onSnapshot }: {
  sessionId: string | null;
  onCommit(preview: MaterializedSessionPreview): void;
  onCancel(): void;
  image?: UiSketchImage;
  title?: ReactNode;
  actions?: ReactNode;
  deleteAction?: ReactNode;
  preview?: ReactNode;
  onSnapshot?(): void;
}) {
  const { t } = useTranslation(), router = useRouter();
  const [data, setData] = useState<PreviewSources>();
  const [path, setPath] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false), [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const generation = useRef(0);
  const currentCommit = useRef(onCommit); currentCommit.current = onCommit;
  useLayoutEffect(() => () => { generation.current++; }, [sessionId]);
  useEffect(() => {
    let cancelled = false, running = false, queued = false;
    const load = async () => {
      if (running) { queued = true; return; }
      running = true;
      try {
        const [session, sources, groups] = sessionId
          ? await Promise.all([getSession(sessionId), listSessionPreviewSources(sessionId), listSessionGroups()])
          : [null, [], []] as const;
        if (!cancelled) {
          const next: PreviewSources = { sources: sources.filter(source => source.outputs.length),
            groups: groups.filter(group => group.projectId === session?.projectId), projectRequired: !session?.projectId };
          // SSE can repeat unchanged source lists; retain the selector's options and scroll state.
          setData(current => JSON.stringify(current) === JSON.stringify(next) ? current : next);
          setLoadFailed(false);
        }
      } catch { if (!cancelled) setLoadFailed(true); }
      finally {
        running = false;
        if (!cancelled) {
          setLoading(false);
          if (queued) { queued = false; void load(); }
        }
      }
    };
    setLoading(true);
    void load();
    const unsubscribe = sessionId ? subscribeSessionPreviews(sessionId, () => void load()) : undefined;
    return () => { cancelled = true; unsubscribe?.(); };
  }, [sessionId, attempt]);

  const options = useMemo<CascadeSelectorOption[]>(() => {
    if (!data) return [];
    const sessions = new Map(data.sources.map(({ session, outputs }) => [session.id, {
      key: session.id, label: session.title,
      children: outputs.map(output => ({ key: output.id, label: output.name ?? t("uiSketch.states.defaultName", { number: output.number }) })),
    }]));
    const grouped = new Set(data.groups.flatMap(group => group.sessionIds));
    const result: CascadeSelectorOption[] = data.groups.map(group => ({ key: `group:${group.id}`, label: group.name,
      children: group.sessionIds.flatMap(id => sessions.has(id) ? [sessions.get(id)!] : []) }));
    const ungrouped = [...sessions.values()].filter(session => !grouped.has(session.key));
    if (ungrouped.length) result.push({ key: "ungrouped", label: t("workspaceSidebar.ungroupedSessions"), children: ungrouped });
    return result;
  }, [data, t]);
  const reference = image?.previewReference;
  const committedOutputId = reference && (reference.sessionType === "spatial" ? reference.cameraId : reference.stateId);
  const committedGroup = options.find(group => group.children?.some(session => session.key === reference?.sessionId));
  const value = path ?? (reference && committedGroup ? [committedGroup.key, reference.sessionId, committedOutputId!] : []);
  const selected = data?.sources.find(source => source.session.id === value[1]);
  const output = selected?.outputs.find(item => item.id === value[2]);
  const source: SessionPreviewSource | undefined = selected && output ? selected.session.sessionType === "spatial"
    ? { sessionId: selected.session.id, sessionType: "spatial", cameraId: output.id }
    : { sessionId: selected.session.id, sessionType: selected.session.sessionType, stateId: output.id } : undefined;
  const unavailable = Boolean(reference && data && !data.sources.some(item => item.session.id === reference.sessionId && item.outputs.some(output => output.id === committedOutputId)));
  const previewUrl = sessionId && source ? sessionPreviewUrl(sessionId, source) : undefined;
  const commit = async (next: SessionPreviewSource) => {
    if (!sessionId) return;
    const token = ++generation.current;
    setSaving(true); setError(false);
    try {
      const result = await materializeSessionPreview(sessionId, next);
      if (generation.current !== token) return;
      currentCommit.current(result);
      if (image) setPath(null); else onCancel();
    } catch { if (generation.current === token) setError(true); }
    finally { if (generation.current === token) setSaving(false); }
  };
  const change = (next: string[]) => {
    generation.current++;
    setPath(next); setError(false); setSaving(false);
    if (!image || next.length !== 3) return;
    const selected = data?.sources.find(item => item.session.id === next[1]);
    if (!selected?.outputs.some(item => item.id === next[2])) return;
    const nextSource: SessionPreviewSource = selected.session.sessionType === "spatial"
      ? { sessionId: next[1], sessionType: "spatial", cameraId: next[2] }
      : { sessionId: next[1], sessionType: selected.session.sessionType, stateId: next[2] };
    if (!reference || previewSourceKey(nextSource) !== previewSourceKey(reference)) void commit(nextSource);
  };
  const selectorLabels = useMemo(() => ({
    level: (level: number) => t(["sessionPreview.group", "sessionPreview.session", "sessionPreview.output"][level - 1]),
    search: t("sessionPreview.search"), searchPlaceholder: t("sessionPreview.search"), clearSearch: t("sessionPreview.clearSearch"),
    chooseParent: t("sessionPreview.chooseParent"), empty: t("sessionPreview.empty"), noChildren: t("sessionPreview.noChildren"),
    loading: t("sessionPreview.loading"), descendantMatches: (count: number) => t("sessionPreview.descendantMatches", { count }),
    searchResults: (count: number) => t("sessionPreview.searchResults", { count }),
  }), [t]);
  return <SessionPreviewPicker open mode={image ? "edit" : "create"} title={title}
    labels={{ label: t("sessionPreview.label"), group: t("sessionPreview.group"), session: t("sessionPreview.session"), output: t("sessionPreview.output"),
      projectRequired: t("sessionPreview.projectRequired"), cancel: t("actions.cancel"), create: t("actions.create"), retry: t("actions.retry") }}
    selectorLabels={selectorLabels} options={options} value={value} onChange={change} loading={loading} saving={saving}
    projectRequired={data?.projectRequired} error={loadFailed || error ? t("sessionPreview.failed") : undefined}
    warning={unavailable ? t("sessionPreview.unavailable") : undefined} previewUrl={previewUrl}
    preview={image ? preview : previewUrl && <img key={`${previewUrl}:${attempt}`} src={previewUrl} alt={t("sessionPreview.label")}
      draggable={false} onError={() => setError(true)} />}
    actions={actions}
    deleteAction={deleteAction}
    previewActions={<>
      <BasicButton disabled={!source || saving} onClick={() => {
        if (!source) return;
        const path = source.sessionType === "spatial" ? "spatial" : source.sessionType === "ui-layout" ? "ui-sketch" : "composition";
        router.push(`/${path}?session=${encodeURIComponent(source.sessionId)}&${source.sessionType === "spatial" ? "camera" : "state"}=${encodeURIComponent(output!.id)}`);
      }}>{t("sessionPreview.openSource")}</BasicButton>
      {image && <BasicButton disabled={!image.assetId || saving} onClick={onSnapshot}>{t("spatial.snapshot")}</BasicButton>}
    </>}
    onRetry={() => {
      if (image && error && source) void commit(source);
      else { setError(false); setAttempt(value => value + 1); }
    }}
    onCancel={() => { generation.current++; onCancel(); }} onInsert={() => { if (source && !saving) void commit(source); }} />;
}
