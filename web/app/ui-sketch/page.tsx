"use client";

import { promptTranslationKey } from "../../../locales/promptKeys";
import {
  EMPTY_UI_SKETCH_DRAFT,
  UI_SKETCH_START_STAGE_ID,
  SessionDetails,
  CanvasHistoryControls,
  CanvasDisplayControls,
  CompositionWorkflowView,
  UiSketchCanvas,
  CanvasFrameControls,
  cloneUiSketchDraft,
  insertUiSketchStage,
  UiSketchStateTabs,
  uiSketchStateTabs,
  renameUiSketchState,
  deleteUiSketchState,
  reorderUiSketchStates,
  type UiSketchDraft,
  type UiSketchPromptTranslator,
} from "@human2ai/ui";
import { BasicButton } from "@human2ai/ui/yisiui/basic-button";
import { LoadingState } from "@human2ai/ui/yisiui/loading-state";
import type { TFunction } from "i18next";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type SetStateAction,
} from "react";
import { useTranslation } from "react-i18next";

import type { StyleProcessing } from "../../../src/domain/session";
import { SessionStyleControl } from "../../components/SessionStyleControl";
import { SessionPreviewAction, SessionPreviewProperties } from "../../components/UiSessionPreviews";
import { mergeUiPreviewRefresh } from "../../../src/domain/ui-sketch/session-preview";
import { droppedSessionPreviewUrl, materializeDroppedSessionPreview } from "../../lib/session-preview-drop";
import { useSessionStyle } from "../../lib/use-session-style";
import { Human2AiShell } from "../../components/Human2AiShell";
import {
  Human2AiApiError,
  createUiSketchSession,
  getSession,
  getLatestUiSketchDraft,
  subscribeSessionPreviews,
  imageAssetContentUrl,
  readImageFile,
  listUiSketchDrafts,
  saveUiSketchDraft,
  uploadImageAsset,
  type Human2AiSession,
} from "../../lib/human2ai-api";
import { buildSessionCliCommand } from "../../lib/session-connection";
import { useCanvasHistory } from "../../lib/use-canvas-history";
import styles from "./page.module.css";

const AUTO_SAVE_DELAY_MS = 800;
const EXTERNAL_DRAFT_REFRESH_MS = 3_000;

interface UiSketchSessionSnapshot {
  session: Human2AiSession;
  draft: UiSketchDraft;
  revision: number;
  lastModifiedAt: string;
  styleProcessing?: StyleProcessing;
}

async function loadUiSketchSession(
  sessionId: string,
): Promise<UiSketchSessionSnapshot> {
  const session = await getSession(sessionId);
  if (session.sessionType !== "ui-layout") {
    throw new Error("SESSION_TYPE_MISMATCH");
  }
  const versions = await listUiSketchDrafts(sessionId);
  const latest = versions.at(-1);
  return {
    session,
    draft: latest?.draft ?? cloneUiSketchDraft(EMPTY_UI_SKETCH_DRAFT),
    revision: latest?.revision ?? 0,
    lastModifiedAt: latest?.createdAt ?? session.updatedAt,
    styleProcessing: latest?.styleProcessing,
  };
}

function formatServiceError(error: unknown, t: TFunction): string {
  if (error instanceof Human2AiApiError) {
    if (error.code === "DRAFT_REVISION_CONFLICT") {
      return t("uiSketch.session.revisionConflict", {
        revision: error.details.actualLatestRevision,
      });
    }
    if (error.code === "HTTP_404") {
      return t("uiSketch.session.serviceOutdated");
    }
    return t("errors.serviceSync", { message: error.message });
  }
  if (error instanceof Error && error.message === "SESSION_TYPE_MISMATCH") {
    return t("uiSketch.session.typeMismatch");
  }
  return t("errors.serviceSync", {
    message: error instanceof Error ? error.message : String(error),
  });
}

export default function UiSketchPage() {
  const { t } = useTranslation();

  return (
    <Suspense
      fallback={(
        <LoadingState
          className={styles.routeLoading}
          label={t("uiSketch.session.loading")}
        />
      )}
    >
      <UiSketchPageContent />
    </Suspense>
  );
}

function UiSketchPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedSessionId = searchParams.get("session");
  const requestedStateId = searchParams.get("state");
  const { t, i18n } = useTranslation();
  const translatePrompt = useCallback<UiSketchPromptTranslator>(
    (key, values) => t(
      promptTranslationKey("uiSketch", key),
      values,
    ),
    [t],
  );
  const [draft, setDraft] = useState(() =>
    cloneUiSketchDraft(EMPTY_UI_SKETCH_DRAFT),
  );
  const [sessionId, setSessionId] = useState<string | null>(null);
  const loadDroppedSessionPreview = useCallback((sourceSessionId: string) =>
    materializeDroppedSessionPreview(sessionId!, sourceSessionId), [sessionId]);
  const loadSessionPreviewDragImage = useCallback((sourceSessionId: string) =>
    droppedSessionPreviewUrl(sessionId!, sourceSessionId), [sessionId]);
  const [sessionTitle, setSessionTitle] = useState<string | null>(null);
  const [sessionMetadata, setSessionMetadata] = useState<Human2AiSession | null>(null);
  const [lastModifiedAt, setLastModifiedAt] = useState<string | null>(null);
  const [latestRevision, setLatestRevision] = useState(0);
  const [styleProcessing, setStyleProcessing] = useState<StyleProcessing>();
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sessionLoadFailed, setSessionLoadFailed] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [serviceError, setServiceError] = useState<string | null>(null);
  const [activeStageId, setActiveStageId] = useState(UI_SKETCH_START_STAGE_ID);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [interfaceFrameLocked, setInterfaceFrameLocked] = useState(false);
  const [toolHost, setToolHost] = useState<HTMLDivElement | null>(null);
  const [clearActionHost, setClearActionHost] = useState<HTMLDivElement | null>(null);
  const [displayOptions, setDisplayOptions] = useState({ showHiddenNodes: false, onionSkin: false });
  const draftChangeVersionRef = useRef(0);
  const savedDraftRef = useRef<UiSketchDraft>(draft);
  const saveContextVersionRef = useRef(0);
  const blockedAutoSaveVersionRef = useRef<number | null>(null);
  const revisionConflictRef = useRef(false);
  const locallyCreatedSessionIdRef = useRef<string | null>(null);
  const sessionCreationRef = useRef<Promise<Human2AiSession> | null>(null);
  const sessionStyle = useSessionStyle(sessionId, ensureUiSketchSession, latestRevision);

  const history = useCanvasHistory<UiSketchDraft, string>(draft, ({ draft: restored, context }) => {
    draftChangeVersionRef.current += 1;
    blockedAutoSaveVersionRef.current = null;
    setDraft(restored);
    setDirty(true);
    const tabs = uiSketchStateTabs(restored);
    setActiveStageId(tabs.some(tab => tab.id === context) ? context! : tabs[0].id);
  }, loading || sessionLoadFailed || revisionConflictRef.current);

  useEffect(() => {
    if (
      requestedSessionId
      && requestedSessionId === locallyCreatedSessionIdRef.current
    ) {
      locallyCreatedSessionIdRef.current = null;
      return;
    }

    saveContextVersionRef.current += 1;
    draftChangeVersionRef.current = 0;
    revisionConflictRef.current = false;
    blockedAutoSaveVersionRef.current = null;
    setDirty(false);
    setSessionLoadFailed(false);

    if (!requestedSessionId) {
      const empty = cloneUiSketchDraft(EMPTY_UI_SKETCH_DRAFT);
      history.reset(empty);
      setDraft(empty);
      setSessionId(null);
      setSessionTitle(null);
      setSessionMetadata(null);
      setLastModifiedAt(null);
      setLatestRevision(0);
      setStyleProcessing(undefined);
      setActiveStageId(UI_SKETCH_START_STAGE_ID);
      setInterfaceFrameLocked(false);
      setServiceError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setSessionId(null);
    setSessionTitle(null);
    setSessionMetadata(null);
    setLastModifiedAt(null);
    setInterfaceFrameLocked(false);
    setServiceError(null);
    void loadUiSketchSession(requestedSessionId)
      .then((snapshot) => {
        if (cancelled) return;
        history.reset(snapshot.draft);
        savedDraftRef.current = snapshot.draft;
        setDraft(snapshot.draft);
        setSessionId(snapshot.session.id);
        setSessionTitle(snapshot.session.title);
        setSessionMetadata(snapshot.session);
        setLastModifiedAt(snapshot.lastModifiedAt);
        setLatestRevision(snapshot.revision);
        setStyleProcessing(snapshot.styleProcessing);
        setActiveStageId(uiSketchStateTabs(snapshot.draft).find(state => state.id === requestedStateId)?.id ?? uiSketchStateTabs(snapshot.draft)[0].id);
        setDirty(false);
        setServiceError(null);
      })
      .catch((error) => {
        if (cancelled) return;
        setSessionLoadFailed(true);
        setServiceError(formatServiceError(error, t));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [loadAttempt, requestedSessionId, requestedStateId, t]);

  useEffect(() => {
    const draftChangeVersion = draftChangeVersionRef.current;
    if (
      revisionConflictRef.current
      || loading
      || saving
      || !dirty
      || blockedAutoSaveVersionRef.current === draftChangeVersion
    ) {
      return;
    }

    const saveContextVersion = saveContextVersionRef.current;
    const draftToSave = draft;
    const timer = window.setTimeout(() => {
      void (async () => {
        setSaving(true);
        setServiceError(null);
        try {
          let targetSessionId = sessionId;
          if (!targetSessionId) {
            targetSessionId = await ensureUiSketchSession();
            if (saveContextVersion !== saveContextVersionRef.current) return;
          }

          const saved = await saveUiSketchDraft(
            targetSessionId,
            latestRevision,
            draftToSave,
          );
          if (saveContextVersion !== saveContextVersionRef.current) return;

          blockedAutoSaveVersionRef.current = null;
          setLatestRevision(saved.revision);
          savedDraftRef.current = saved.draft;
          setStyleProcessing(saved.styleProcessing);
          setLastModifiedAt(saved.createdAt);
          if (draftChangeVersionRef.current === draftChangeVersion) {
            setDraft(saved.draft);
            setDirty(false);
          }
        } catch (error) {
          if (saveContextVersion !== saveContextVersionRef.current) return;
          const actualLatestRevision =
            error instanceof Human2AiApiError
            && error.code === "DRAFT_REVISION_CONFLICT"
              ? error.details.actualLatestRevision
              : null;
          if (
            typeof actualLatestRevision === "number"
            && Number.isInteger(actualLatestRevision)
          ) {
            const latest = sessionId ? await getLatestUiSketchDraft(sessionId).catch(() => null) : null;
            if (saveContextVersion !== saveContextVersionRef.current) return;
            const merged = latest && mergeUiPreviewRefresh(history.current(), savedDraftRef.current, latest.draft);
            if (latest && merged) {
              savedDraftRef.current = latest.draft;
              history.synchronize(merged);
              setDraft(merged); setLatestRevision(latest.revision);
              setLastModifiedAt(latest.createdAt);
              return;
            }
            revisionConflictRef.current = true;
            history.reset(history.current());
            setLatestRevision(actualLatestRevision);
          }
          blockedAutoSaveVersionRef.current = draftChangeVersionRef.current;
          setServiceError(formatServiceError(error, t));
        } finally {
          setSaving(false);
        }
      })();
    }, AUTO_SAVE_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [dirty, draft, latestRevision, loading, router, saving, sessionId, t]);

  useEffect(() => {
    if (!sessionId || loading || saving) return;
    let cancelled = false;
    let refreshing = false;

    const observedChangeVersion = draftChangeVersionRef.current;
    const refreshDraft = async () => {
      if (refreshing) return;
      refreshing = true;
      try {
        const latest = await getLatestUiSketchDraft(sessionId, latestRevision);
        if (!cancelled && latest && latest.revision > latestRevision) {
          const base = savedDraftRef.current;
          const merged = mergeUiPreviewRefresh(history.current(), base, latest.draft);
          if (merged) {
            history.synchronize(merged);
            setDraft(current => mergeUiPreviewRefresh(current, base, latest.draft) ?? current);
          } else if (!dirty && observedChangeVersion === draftChangeVersionRef.current) {
            history.reset(latest.draft); setDraft(latest.draft);
            setActiveStageId(uiSketchStateTabs(latest.draft)[0].id);
          } else return;
          savedDraftRef.current = latest.draft;
          setLatestRevision(latest.revision);
          setStyleProcessing(latest.styleProcessing);
          setLastModifiedAt(latest.createdAt);
          blockedAutoSaveVersionRef.current = null;
          setServiceError(null);
        }
      } catch (error) {
        if (!cancelled) setServiceError(formatServiceError(error, t));
      } finally { refreshing = false; }
    };

    void refreshDraft();
    const unsubscribe = subscribeSessionPreviews(sessionId, () => void refreshDraft());
    const timer = window.setInterval(
      () => void refreshDraft(),
      EXTERNAL_DRAFT_REFRESH_MS,
    );
    return () => {
      cancelled = true;
      unsubscribe();
      window.clearInterval(timer);
    };
  }, [dirty, latestRevision, loading, saving, sessionId, t]);

  function updateDraft(action: SetStateAction<UiSketchDraft>, nextStageId = activeStageId): void {
    const next = typeof action === "function" ? action(history.current()) : action;
    const tabs = uiSketchStateTabs(next);
    if (!history.record(next, activeStageId, tabs.some(tab => tab.id === nextStageId) ? nextStageId : tabs[0].id)) return;
    draftChangeVersionRef.current += 1;
    blockedAutoSaveVersionRef.current = null;
    setDraft(next);
    setDirty(true);
  }

  async function ensureUiSketchSession(): Promise<string> {
    if (sessionId) return sessionId;
    const pending = sessionCreationRef.current ?? createUiSketchSession(
      t("uiSketch.session.untitled"),
    );
    sessionCreationRef.current = pending;
    try {
      const session = await pending;
      locallyCreatedSessionIdRef.current = session.id;
      setSessionId(session.id);
      setSessionTitle(session.title);
      setSessionMetadata(session);
      setLastModifiedAt(session.updatedAt);
      router.replace(`/ui-sketch?session=${encodeURIComponent(session.id)}`);
      return session.id;
    } finally {
      if (sessionCreationRef.current === pending) sessionCreationRef.current = null;
    }
  }

  async function uploadCanvasImage(file: File): Promise<string> {
    const targetSessionId = await ensureUiSketchSession();
    return (await uploadImageAsset(targetSessionId, file)).id;
  }

  function createState(sourceId: string): void {
    const id = crypto.randomUUID();
    updateDraft((current) => insertUiSketchStage(current, sourceId, id), id);
    setActiveStageId(id);
  }

  function deleteState(id: string): void {
    const tabs = uiSketchStateTabs(draft);
    const index = tabs.findIndex((tab) => tab.id === id);
    if (tabs.length < 2 || index < 0) return;
    const nextStageId = activeStageId === id ? tabs[index + 1]?.id ?? tabs[index - 1].id : activeStageId;
    setActiveStageId(nextStageId);
    updateDraft((current) => deleteUiSketchState(current, id), nextStageId);
  }

  const stateTabs = uiSketchStateTabs(draft);
  const stageItems = stateTabs.map((tab) => ({
    id: tab.id,
    label: tab.name ?? t("uiSketch.states.defaultName", { number: tab.number }),
  }));
  const selectedStageId = stateTabs.some((tab) => tab.id === activeStageId) ? activeStageId : stateTabs[0].id;


  return (
    <Human2AiShell
      currentSessionId={requestedSessionId}
      onCurrentSessionRename={setSessionTitle}
      title={sessionTitle ?? t("uiSketch.session.new")}
      headerExtra={<CanvasDisplayControls value={displayOptions} onChange={setDisplayOptions}
        hasMultipleStates={stateTabs.length > 1}
        hasPreviousState={stateTabs.findIndex((tab) => tab.id === selectedStageId) > 0}
        disabled={loading || sessionLoadFailed}
        labels={{ showHiddenNodes: t("canvas.display.showHiddenNodes"), onionSkin: t("canvas.display.onionSkin") }} />}
      rightPanelOpen={rightPanelOpen}
      onRightPanelOpenChange={setRightPanelOpen}
      rightPanel={(
        <div className={`${styles.panel} ${loading ? styles.panelIsLoading : ""}`} data-canvas-editor>
          {loading ? (
            <LoadingState
              className={styles.panelLoading}
              label={t("uiSketch.session.loading")}
              compact
            />
          ) : rightPanelOpen ? (
            <>
              <SessionDetails
                createdAt={sessionMetadata?.createdAt ?? null}
                updatedAt={lastModifiedAt}
                nodeCount={draft.rectangles.length + draft.texts.length + draft.images.length}
                agentCommand={sessionId ? async () => t("sessionDetails.agentCommand", {
                  command: buildSessionCliCommand(sessionId, window.location.origin),
                }) : null}
                locale={i18n.resolvedLanguage ?? i18n.language}
                labels={{
                  title: t("sessionDetails.title"),
                  created: t("sessionDetails.created"),
                  updated: t("sessionDetails.updated"),
                  nodes: t("sessionDetails.nodes"),
                  agent: t("sessionDetails.agent"),
                  copyCommand: t("sessionDetails.copyCommand"),
                  copying: t("sessionDetails.copying"),
                  copied: t("clipboard.copied"),
                  copyFailed: t("sessionDetails.copyFailed"),
                  emptyValue: t("sessionDetails.emptyValue"),
                }}
              />
              <SessionStyleControl controller={sessionStyle} category="ui" processing={styleProcessing} disabled={loading || saving} />
              <section>
                <div className={styles.sectionHeading}>
                  <h2>{t("canvas.tools.label")}</h2>
                  <div
                    ref={setClearActionHost}
                    className={styles.sectionHeadingActions}
                  />
                </div>
                <div ref={setToolHost} />
              </section>
              <CanvasFrameControls
                frame={draft.frame} name={t("uiSketch.canvasLabels.frameRange")}
                locked={interfaceFrameLocked} disabled={sessionLoadFailed} onLockedChange={setInterfaceFrameLocked}
                onChange={(frame) => updateDraft((current) => ({ ...current, frame }))}
                labels={{ reset: t("uiSketch.canvasLabels.resetFrame"), lock: t("uiSketch.canvasLabels.lockFrame"),
                  unlock: t("uiSketch.canvasLabels.unlockFrame"), size: t("dimensions.frameSize"),
                  width: t("dimensions.width"), height: t("dimensions.height") }}
              />
            </>
          ) : null}
        </div>
      )}
    >
      <div className={styles.page} data-canvas-editor aria-busy={loading || saving}>
        {serviceError ? (
          <div className={styles.serviceError} role="alert">
            <span>{serviceError}</span>
            {sessionLoadFailed ? (
              <BasicButton size="small" onClick={() => setLoadAttempt((value) => value + 1)}>
                {t("actions.retry")}
              </BasicButton>
            ) : null}
          </div>
        ) : null}

        {loading ? (
          <LoadingState
            className={styles.workspaceLoading}
            variant="image"
            label={t("uiSketch.session.loading")}
          />
        ) : sessionLoadFailed ? null : (
          <CompositionWorkflowView
            data-active-stage={selectedStageId}
            stateControls={(
              <UiSketchStateTabs
                items={stageItems}
                value={selectedStageId}
                labels={{
                  switch: t("uiSketch.views.switch"),
                  add: t("uiSketch.views.enableMotion"),
                  rename: t("actions.rename"),
                  name: t("uiSketch.states.name"),
                  new: t("uiSketch.states.new"),
                  delete: t("uiSketch.states.delete"),
                  cancel: t("actions.cancel"),
                  actions: (name) => t("uiSketch.states.actions", { name }),
                  deleteTitle: (name) => t("uiSketch.states.deleteTitle", { name }),
                }}
                onChange={setActiveStageId}
                onCreate={createState}
                onRename={(id, name) => updateDraft((current) => renameUiSketchState(current, id, name))}
                onDelete={deleteState}
                onReorder={(ids) => updateDraft((current) => reorderUiSketchStates(current, ids))}
              />
            )}
          >
              <CanvasHistoryControls {...history} labels={{ undo: t("canvasHistory.undo"), redo: t("canvasHistory.redo"), label: t("canvasHistory.label") }} />
              <UiSketchCanvas
                sessionPreviewLabel={t("sessionPreview.label")}
                sessionPreviewFailedLabel={t("sessionPreview.failed")}
                onSessionPreviewDrop={sessionId ? loadDroppedSessionPreview : undefined}
                loadSessionPreviewDragImage={sessionId ? loadSessionPreviewDragImage : undefined}
                renderSessionPreviewTool={insert => <SessionPreviewAction sessionId={sessionId} onInsert={insert} disabled={loading || sessionLoadFailed} />}
                renderSessionPreviewEditor={props => sessionId ? <SessionPreviewProperties key={`${sessionId}:${props.image.id}`} sessionId={sessionId} {...props} /> : null}
                className={styles.canvas}
                interactionResetKey={history.restoreToken}
                draft={draft}
                activeStageId={selectedStageId}
                onDraftChange={updateDraft}
                translatePrompt={translatePrompt}
                resolveStylePrompt={sessionStyle.readPromptLine}
                toolHost={rightPanelOpen ? toolHost : null}
                clearActionHost={rightPanelOpen ? clearActionHost : null}
                {...displayOptions}
                showCanvasTools={!rightPanelOpen}
                canvasSideActionPanelDefaultCollapsed
                interfaceFrameLocked={interfaceFrameLocked}
                resolveImageSource={sessionId
                  ? (assetId) => imageAssetContentUrl(sessionId, assetId)
                  : undefined}
                onImageUpload={uploadCanvasImage}
                onReadImageFile={readImageFile}
                imageEditorLabels={{
                  content: t("canvas.imageEditor.content"),
                  upload: t("canvas.imageEditor.upload"),
                  download: t("canvas.imageEditor.download"),
                  downloading: t("canvas.imageEditor.downloading"),
                  downloadFailed: t("canvas.imageEditor.downloadFailed"),
                  replace: t("canvas.imageEditor.replace"),
                  uploading: t("canvas.imageEditor.uploading"),
                  uploadFailed: t("canvas.imageEditor.uploadFailed"),
                  fileTypes: t("canvas.imageEditor.fileTypes"),
                  cropTitle: t("canvas.imageCrop.title"),
                  cropLoadFailed: t("canvas.imageCrop.loadFailed"),
                  svgSource: t("canvas.imageEditor.svgSource"),
                  svgPaste: t("canvas.imageEditor.svgPaste"),
                  svgApply: t("canvas.imageEditor.svgApply"),
                  svgSaveFailed: t("canvas.imageEditor.svgSaveFailed"),
                  svgCopy: t("canvas.imageEditor.svgCopy"),
                  svgCopying: t("canvas.imageEditor.svgCopying"),
                  svgCopyFailed: t("canvas.imageEditor.svgCopyFailed"),
                  sourceLoading: t("canvas.imageEditor.sourceLoading"),
                  sourceLoadFailed: t("canvas.imageEditor.sourceLoadFailed"),
                  svgCopied: t("clipboard.copied"),
                  cancel: t("actions.cancel"),
                  retry: t("actions.retry"),
                }}
                labels={{
                  canvas: t("uiSketch.canvas"),
                  canvasViewport: t("uiSketch.canvasLabels.canvasViewport"),
                  scene: t("uiSketch.canvasLabels.scene"),
                  region: t("uiSketch.canvasLabels.region"),
                  addRegion: t("uiSketch.canvasLabels.addRegion"),
                  text: t("uiSketch.canvasLabels.text"),
                  addText: t("uiSketch.canvasLabels.addText"),
                  image: t("canvas.imageNode.label"),
                  addImage: t("canvas.imageNode.add"),
                  newText: t("uiSketch.canvasLabels.newText"),
                  overallNote: t("notes.global.label"),
                  clearCanvas: t("uiSketch.canvasLabels.clearCanvas"),
                  clearCanvasConfirmTitle: t("uiSketch.canvasLabels.clearCanvasConfirmTitle"),
                  clearCanvasConfirmDescription: t("uiSketch.canvasLabels.clearCanvasConfirmDescription"),
                  clearCanvasCancel: t("actions.cancel"),
                  bringToFront: t("canvasLayers.bringToFront"),
                  bringForward: t("canvasLayers.bringForward"),
                  sendBackward: t("canvasLayers.sendBackward"),
                  sendToBack: t("canvasLayers.sendToBack"),
                  groupItems: t("uiSketch.canvasLabels.groupItems"),
                  ungroupItems: t("uiSketch.canvasLabels.ungroupItems"),
                  copyGroup: t("clipboard.group"),
                  copyPrompt: t("clipboard.copyPrompt"),
                  promptPreview: t("clipboard.promptPreview"),
                  promptPreviewLoading: t("clipboard.promptPreviewLoading"),
                  promptPreviewFailed: t("clipboard.promptPreviewFailed"),
                  copySketch: t("clipboard.copyPreview"),
                  previewImage: t("clipboard.previewImage"),
                  copyAllStages: t("uiSketch.motion.copyPrompt"),
                  overallNoteTitle: t("uiSketch.globalNote.title"),
                  overallNotePlaceholder: t("uiSketch.globalNote.placeholder"),
                  overallNoteAriaLabel: t("uiSketch.globalNote.ariaLabel"),
                  fitFrame: t("uiSketch.canvasLabels.fitFrame"),
                  interactionHelp: t("canvas.viewport.instructions"),
                  sideActions: t("uiSketch.canvasLabels.sideActions"),
                  collapseSideActions: t("uiSketch.canvasLabels.collapseSideActions"),
                  expandSideActions: t("uiSketch.canvasLabels.expandSideActions"),
                  frameAction: t("uiSketch.canvasLabels.frameAction"),
                  frameRange: t("uiSketch.canvasLabels.frameRange"),
                  missingRegionNote: t("uiSketch.canvasLabels.missingRegionNote"),
                  editRegionNote: t("uiSketch.canvasLabels.editRegionNote"),
                  editText: t("uiSketch.canvasLabels.editText"),
                  nodeDescription: t("canvas.node.nodeDescription"),
                  originUser: t("canvas.node.originUser"),
                  originAgent: t("canvas.node.originAgent"),
                  originImport: t("canvas.node.originImport"),
                  note: t("notes.element.label"),
                  textContent: t("textContent.label"),
                  regionPlaceholder: t("notes.element.regionPlaceholder"),
                  textPlaceholder: t("textContent.uiSketchPlaceholder"),
                  textNotePlaceholder: t("notes.element.textPlaceholder"),
                  imageNotePlaceholder: t("notes.element.nodePlaceholder"),
                  shapeKind: t("canvasNodeEditor.shapeKind"),
                  emptyText: t("uiSketch.canvasLabels.emptyText"),
                  visualWeight: t("visualWeight.label"),
                  visibility: t("canvas.nodeVisibility.visibility"),
                  visible: t("canvas.nodeVisibility.visible"),
                  hidden: t("canvas.nodeVisibility.hidden"),
                  weightAuto: t("visualWeight.auto"),
                  weightHigh: t("visualWeight.high"),
                  weightMedium: t("visualWeight.medium"),
                  weightLow: t("visualWeight.low"),
                  weightDecorative: t("visualWeight.decorative"),
                  fontSize: t("uiSketch.canvasLabels.fontSize"),
                  decreaseFontSize: t("uiSketch.canvasLabels.decreaseFontSize"),
                  increaseFontSize: t("uiSketch.canvasLabels.increaseFontSize"),
                  cancel: t("actions.cancel"),
                  deleteRegion: t("actions.deleteRegion"),
                  deleteText: t("actions.deleteText"),
                  deleteNode: t("actions.deleteNode"),
                  confirmDeleteRegion: t("confirmations.deleteRegion"),
                  confirmDeleteText: t("confirmations.deleteText"),
                  confirmDeleteNode: t("confirmations.deleteNode"),
                  cancelDelete: t("actions.keep"),
                  promptUnsupported: t("clipboard.promptUnsupported"),
                  promptCopied: t("clipboard.copied"),
                  promptCopyFailed: t("clipboard.promptFailed"),
                  sketchCopied: t("clipboard.copied"),
                  sketchDownloaded: t("clipboard.previewDownloaded"),
                  sketchCopyFailed: t("clipboard.previewFailed"),
                  selectedItemsPrefix: t("uiSketch.canvasLabels.selectedItemsPrefix"),
                  selectedItemsSuffix: t("uiSketch.canvasLabels.selectedItemsSuffix"),
                  noSelection: t("uiSketch.canvasLabels.noSelection"),
                }}
                aria-label={t("uiSketch.canvas")}
              />
          </CompositionWorkflowView>
        )}
      </div>
    </Human2AiShell>
  );
}
