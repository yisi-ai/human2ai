"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { SpatialWorkspaceView, SessionDetails, CanvasHistoryControls, type SpatialLabels } from "@human2ai/ui";
import { BasicButton } from "@human2ai/ui/yisiui/basic-button";
import { LoadingState } from "@human2ai/ui/yisiui/loading-state";
import { createSpatialDraft, applySpatialOperations, SPATIAL_RENDER_PASSES, type SpatialDraft, type SpatialOperation } from "../../../src/domain/spatial";
import { Human2AiShell } from "../../components/Human2AiShell";
import { SessionStyleControl } from "../../components/SessionStyleControl";
import { createSpatialSession, getSession, getLatestSpatialDraftVersion, applySpatialEdits, saveSpatialDraft, restoreSpatialDraft, spatialCameraUrl, spatialCameraBoxUrl, Human2AiApiError, type Human2AiSession } from "../../lib/human2ai-api";
import { buildSessionCliCommand } from "../../lib/session-connection";
import { useCanvasHistory } from "../../lib/use-canvas-history";
import { useSessionStyle } from "../../lib/use-session-style";
import { SpatialEditQueue } from "../../lib/spatial-edit-queue";
import { availableSpatialCameraPreviews, updateSpatialCameraPreviews, type SpatialCameraPreviewState } from "../../lib/spatial-camera-previews";
import zh from "../../../locales/zh-CN/common.json";

export default function SpatialPage() {
  const { t } = useTranslation();
  return <Suspense fallback={<LoadingState label={t("spatial.title")} />}><SpatialSessionPage /></Suspense>;
}

function SpatialSessionPage() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const params = useSearchParams();
  const sessionId = params.get("session");
  const [panelHost, setPanelHost] = useState<HTMLDivElement | null>(null);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [displayPreferences, setDisplayPreferences] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        return {
          showCameras: window.localStorage.getItem("human2ai.spatial.showCameras") !== "false",
          showRig: window.localStorage.getItem("human2ai.spatial.showRig") !== "false",
        };
      } catch { /* Keep the defaults when browser storage is unavailable. */ }
    }
    return { showCameras: true, showRig: true };
  });
  const [session, setSession] = useState<Human2AiSession | null>(null);
  const [draft, setDraft] = useState<SpatialDraft>(createSpatialDraft);
  const [revision, setRevision] = useState(0);
  const [cameraPreviews, setCameraPreviews] = useState<SpatialCameraPreviewState>();
  const cameraPreviewRevisions = useMemo(() => new Map(SPATIAL_RENDER_PASSES.map(pass => [pass, availableSpatialCameraPreviews(cameraPreviews, draft, pass)])), [cameraPreviews, draft]);
  const sessionStyle = useSessionStyle(sessionId, async () => sessionId!, revision);
  const [loading, setLoading] = useState(Boolean(sessionId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [constrained, setConstrained] = useState(false);
  const [reload, setReload] = useState(0);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [initialContext] = useState(() => ({ queue: new SpatialEditQueue(draft, 0), busy: false, stopped: false }));
  const state = useRef(initialContext);
  const history = useCanvasHistory(draft, ({ draft: restored }) => {
    state.current.queue.restore(restored);
    setDraft(restored);
    setConstrained(false);
  }, !sessionId || loading || Boolean(error));
  const emptyDraft = useRef(() => createSpatialDraft());
  emptyDraft.current = () => { const empty = createSpatialDraft(); empty.cameras[0].name = t("spatial.camera", { number: 1 }); return empty; };
  const labels = Object.fromEntries(Object.keys(zh.spatial).map(key => [key, t(`spatial.${key}`)])) as SpatialLabels;

  const changeDisplayPreference = (key: keyof typeof displayPreferences, visible: boolean) => {
    setDisplayPreferences(current => ({ ...current, [key]: visible }));
    try {
      window.localStorage.setItem(`human2ai.spatial.${key}`, String(visible));
    } catch { /* The current view remains usable without persistent storage. */ }
  };

  useEffect(() => {
    const context = { queue: new SpatialEditQueue(emptyDraft.current(), 0), busy: false, stopped: false };
    history.reset(context.queue.draft);
    state.current = context;
    let disposed = false;
    let writing = false;
    setError(null); setSession(null); setLoading(Boolean(sessionId)); setSaving(false); setConstrained(false);
    setCameraPreviews(undefined);
    setDraft(context.queue.draft); setRevision(0); setUpdatedAt(null);
    if (!sessionId) { setDraft(context.queue.draft); setRevision(0); return; }
    const receive = (next: Awaited<ReturnType<typeof getLatestSpatialDraftVersion>>) => {
      context.queue = new SpatialEditQueue(next?.draft ?? emptyDraft.current(), next?.revision ?? 0);
      history.reset(context.queue.draft);
      setDraft(context.queue.draft); setRevision(context.queue.revision); setUpdatedAt(next?.createdAt ?? null);
      setCameraPreviews(previous => next ? updateSpatialCameraPreviews(previous, next.draft, next.revision) : undefined);
    };
    void Promise.all([getSession(sessionId), getLatestSpatialDraftVersion(sessionId)]).then(([metadata, latest]) => {
      if (disposed) return;
      if (metadata.sessionType !== "spatial") throw new Error("SESSION_TYPE_MISMATCH");
      setSession(metadata); receive(latest); setLoading(false);
    }).catch(() => { if (!disposed) { setError("spatial.loadFailed"); context.stopped = true; setLoading(false); } });
    const beforeUnload = (event: BeforeUnloadEvent) => { if (context.queue.pending || writing) event.preventDefault(); };
    const synchronize = async () => {
      if (context.busy || context.stopped || (disposed && !context.queue.pending)) return;
      if (document.hidden && !context.queue.pending) return;
      context.busy = true;
      try {
        if (context.queue.pending) {
          writing = true;
          if (!disposed) setSaving(true);
          await context.queue.flush({
            saveInitial: initial => saveSpatialDraft(sessionId, 0, initial),
            apply: (revision, operations) => applySpatialEdits(sessionId, revision, operations),
            restore: (revision, target) => restoreSpatialDraft(sessionId, revision, target),
          }, saved => {
            if (!disposed) {
              setRevision(saved.revision); setUpdatedAt(saved.createdAt); setDraft(context.queue.draft); setError(null);
              setCameraPreviews(previous => updateSpatialCameraPreviews(previous, saved.draft, saved.revision));
            }
          });
        } else {
          const next = await getLatestSpatialDraftVersion(sessionId, context.queue.revision);
          if (disposed || context.queue.pending) return;
          if (next && next.revision !== context.queue.revision) receive(next);
        }
      } catch (failure) {
        context.stopped = true;
        if (!disposed) setError(failure instanceof Human2AiApiError && failure.status === 409 ? "spatial.conflict" : "spatial.saveFailed");
      } finally {
        context.busy = false; writing = false;
        if (!disposed) setSaving(false);
        else if (context.queue.pending && !context.stopped) void synchronize();
        else window.removeEventListener("beforeunload", beforeUnload);
      }
    };
    const timer = window.setInterval(() => void synchronize(), 800);
    const visible = () => { if (!document.hidden) void synchronize(); };
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      disposed = true; clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
      // Client navigation must finish the queued revision even after unmount.
      if (context.queue.pending && !context.stopped) void synchronize();
      else if (!writing) window.removeEventListener("beforeunload", beforeUnload);
    };
  }, [sessionId, reload]);

  const edit = (operation: SpatialOperation) => {
    if (!sessionId || loading || state.current.stopped) return;
    try {
      const result = applySpatialOperations(state.current.queue.draft, [operation]);
      if (!history.record(result.draft)) { setConstrained(result.constrained); return; }
      state.current.queue.edit(operation, result.draft);
      setDraft(result.draft); setConstrained(result.constrained);
    } catch { setConstrained(true); }
  };
  const retry = () => {
    if (error === "spatial.saveFailed") { state.current.stopped = false; setError(null); }
    else setReload(value => value + 1);
  };
  return <Human2AiShell title={session?.title ?? t("spatial.title")} currentSessionId={sessionId} onCurrentSessionRename={title => setSession(value => value ? { ...value, title } : value)}
    rightPanelOpen={rightPanelOpen} onRightPanelOpenChange={setRightPanelOpen}
    rightPanel={sessionId ? <div ref={setPanelHost} className="spatial-panel-host" /> : undefined}>
    {!sessionId ? <BasicButton onClick={async () => { const created = await createSpatialSession(t("spatial.untitled")); router.push(`/spatial?session=${encodeURIComponent(created.id)}`); }}>{t("spatial.newSpace")}</BasicButton> : <SpatialWorkspaceView
      key={`${sessionId}/${reload}`} draft={draft} initialCameraId={params.get("camera")} labels={labels} actions={{ retry: t("actions.retry"), delete: t("actions.delete"), cancel: t("actions.cancel") }} onOperation={edit}
      showCameras={displayPreferences.showCameras} onShowCamerasChange={visible => changeDisplayPreference("showCameras", visible)}
      showRig={displayPreferences.showRig} onShowRigChange={visible => changeDisplayPreference("showRig", visible)}
      panelHost={panelHost} toolsLabel={t("canvas.tools.label")} noteLabel={t("notes.element.label")} copiedLabel={t("clipboard.copied")} onRequestProperties={() => setRightPanelOpen(true)}
      loading={loading} disabled={Boolean(error) || loading} error={error ? t(error) : constrained ? t("spatial.constrained") : null}
      onRetry={error ? retry : undefined} interactionResetKey={history.restoreToken}
      historyControls={<CanvasHistoryControls {...history} labels={{ undo: t("canvasHistory.undo"), redo: t("canvasHistory.redo"), label: t("canvasHistory.label") }} />}
      cameraSource={(id, pass) => {
        const previewRevision = cameraPreviewRevisions.get(pass ?? "color")?.get(id);
        return !loading && !error && session?.id === sessionId && previewRevision ? spatialCameraUrl(sessionId, id, previewRevision, pass) : undefined;
      }}
      cameraBoxSource={(id, view, pass) => !loading && !saving && !state.current.queue.pending && !error && session?.id === sessionId && revision > 0 ? spatialCameraBoxUrl(sessionId, id, revision, view, pass) : undefined}
      details={<><SessionDetails createdAt={session?.createdAt ?? null} updatedAt={updatedAt} nodeCount={draft.characters.length + draft.objects.length + draft.cameras.length + (draft.cameraBoxes?.length ?? 0)} locale={i18n.resolvedLanguage ?? "zh-CN"}
        agentCommand={() => Promise.resolve(t("sessionDetails.agentCommand", { command: buildSessionCliCommand(sessionId, window.location.origin) }))}
        labels={{ title: t("sessionDetails.title"), created: t("sessionDetails.created"), updated: t("sessionDetails.updated"), nodes: t("sessionDetails.nodes"), agent: t("sessionDetails.agent"), copyCommand: t("sessionDetails.copyCommand"), copying: t("sessionDetails.copying"), copied: t("clipboard.copied"), copyFailed: t("sessionDetails.copyFailed"), emptyValue: t("sessionDetails.emptyValue") }} />
        <SessionStyleControl controller={sessionStyle} category="spatial" showProcessingStatus={false} disabled={loading || saving || Boolean(error)} />
      </>}
    />}
  </Human2AiShell>;
}
