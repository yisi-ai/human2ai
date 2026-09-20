"use client";

import { promptTranslationKey } from "../../../locales/promptKeys";
import {
  LockOutlined,
  ReloadOutlined,
  UnlockOutlined,
} from "@ant-design/icons";
import {
  EMPTY_UI_SKETCH_DRAFT,
  UI_SKETCH_START_STAGE_ID,
  SessionDetails,
  CanvasHistoryControls,
  CompositionWorkflowView,
  UiSketchCanvas,
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
import {
  AspectRatioSelector,
  type AspectRatioOption,
  type AspectRatioValue,
} from "@human2ai/ui/yisiui/aspect-ratio-selector";
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
import { useSessionStyle } from "../../lib/use-session-style";
import { Human2AiShell } from "../../components/Human2AiShell";
import {
  Human2AiApiError,
  createUiSketchSession,
  getSession,
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
const MINIMUM_INTERFACE_FRAME_SIZE = 10;

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
          rows={10}
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
  const presetRatioChangeRef = useRef(false);
  const draftChangeVersionRef = useRef(0);
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
        setDraft(snapshot.draft);
        setSessionId(snapshot.session.id);
        setSessionTitle(snapshot.session.title);
        setSessionMetadata(snapshot.session);
        setLastModifiedAt(snapshot.lastModifiedAt);
        setLatestRevision(snapshot.revision);
        setStyleProcessing(snapshot.styleProcessing);
        setActiveStageId(UI_SKETCH_START_STAGE_ID);
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
  }, [loadAttempt, requestedSessionId, t]);

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
    if (!sessionId || loading || dirty || saving) return;
    let cancelled = false;

    const observedChangeVersion = draftChangeVersionRef.current;
    const refreshDraft = async () => {
      try {
        const versions = await listUiSketchDrafts(sessionId);
        const latest = versions.at(-1);
        if (!cancelled && observedChangeVersion === draftChangeVersionRef.current && latest && latest.revision > latestRevision) {
          history.reset(latest.draft);
          setDraft(latest.draft);
          setLatestRevision(latest.revision);
          setStyleProcessing(latest.styleProcessing);
          setLastModifiedAt(latest.createdAt);
          setActiveStageId(UI_SKETCH_START_STAGE_ID);
          blockedAutoSaveVersionRef.current = null;
          setServiceError(null);
        }
      } catch (error) {
        if (!cancelled) setServiceError(formatServiceError(error, t));
      }
    };

    void refreshDraft();
    const timer = window.setInterval(
      () => void refreshDraft(),
      EXTERNAL_DRAFT_REFRESH_MS,
    );
    return () => {
      cancelled = true;
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

  function resizeInterfaceFrame(nextSize: AspectRatioValue): void {
    const width = Math.round(nextSize.width);
    const height = Math.round(nextSize.height);
    if (
      width < MINIMUM_INTERFACE_FRAME_SIZE
      || height < MINIMUM_INTERFACE_FRAME_SIZE
    ) {
      return;
    }
    updateDraft((current) => {
      const centerX = current.frame.x + current.frame.width / 2;
      const centerY = current.frame.y + current.frame.height / 2;
      return {
        ...current,
        frame: {
          x: centerX - width / 2,
          y: centerY - height / 2,
          width,
          height,
        },
      };
    });
  }

  function selectInterfaceFrameRatio(option: AspectRatioOption): void {
    presetRatioChangeRef.current = true;
    resizeInterfaceFrame({
      width: draft.frame.width,
      height: draft.frame.width * option.height / option.width,
    });
  }

  function resetInterfaceFrame(): void {
    updateDraft((current) => ({
      ...current,
      frame: { ...EMPTY_UI_SKETCH_DRAFT.frame },
    }));
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
      rightPanelOpen={rightPanelOpen}
      onRightPanelOpenChange={setRightPanelOpen}
      rightPanel={(
        <div className={styles.panel} data-canvas-editor>
          {loading ? (
            <LoadingState
              className={styles.panelLoading}
              label={t("uiSketch.session.loading")}
              rows={8}
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
              <section>
                <div className={styles.sectionHeading}>
                  <h2>{t("uiSketch.canvasLabels.frameRange")}</h2>
                  <div className={styles.sectionHeadingActions}>
                    <BasicButton
                      mode="icon-only"
                      size="small"
                      icon={<ReloadOutlined />}
                      iconLabel={t("uiSketch.canvasLabels.resetFrame")}
                      title={t("uiSketch.canvasLabels.resetFrame")}
                      backgroundColor="none"
                      textColor="color.text.secondary"
                      disabled={sessionLoadFailed || interfaceFrameLocked}
                      onClick={resetInterfaceFrame}
                    />
                    <BasicButton
                      mode="icon-only"
                      size="small"
                      icon={interfaceFrameLocked ? <LockOutlined /> : <UnlockOutlined />}
                      iconLabel={
                        interfaceFrameLocked
                          ? t("uiSketch.canvasLabels.unlockFrame")
                          : t("uiSketch.canvasLabels.lockFrame")
                      }
                      title={
                        interfaceFrameLocked
                          ? t("uiSketch.canvasLabels.unlockFrame")
                          : t("uiSketch.canvasLabels.lockFrame")
                      }
                      aria-pressed={interfaceFrameLocked}
                      backgroundColor={
                        interfaceFrameLocked ? "color.action.primaryActive" : "none"
                      }
                      textColor={
                        interfaceFrameLocked ? "color.text.onPrimary" : "color.text.secondary"
                      }
                      disabled={sessionLoadFailed}
                      onClick={() => setInterfaceFrameLocked((locked) => !locked)}
                    />
                  </div>
                </div>
                <div className={styles.aspectRatioSelector}>
                  <AspectRatioSelector
                    ratio={{
                      width: draft.frame.width,
                      height: draft.frame.height,
                    }}
                    disabled={sessionLoadFailed || interfaceFrameLocked}
                    onChange={(_key, option) => selectInterfaceFrameRatio(option)}
                    onRatioChange={(ratio) => {
                      if (presetRatioChangeRef.current) {
                        presetRatioChangeRef.current = false;
                        return;
                      }
                      resizeInterfaceFrame(ratio);
                    }}
                    title={t("uiSketch.canvasLabels.rangeTitle")}
                    widthLabel={t("dimensions.width")}
                    heightLabel={t("dimensions.height")}
                    aria-label={t("uiSketch.canvasLabels.frameRange")}
                  />
                </div>
              </section>
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
            label={t("uiSketch.session.loading")}
            rows={10}
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
                  reorderHint: t("uiSketch.states.reorderHint"),
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
                className={styles.canvas}
                interactionResetKey={history.restoreToken}
                draft={draft}
                activeStageId={selectedStageId}
                onDraftChange={updateDraft}
                translatePrompt={translatePrompt}
                resolveStylePrompt={sessionStyle.readPromptLine}
                toolHost={rightPanelOpen ? toolHost : null}
                clearActionHost={rightPanelOpen ? clearActionHost : null}
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
                  copySketch: t("clipboard.copyPreview"),
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
                  visibility: t("uiSketch.canvasLabels.visibility"),
                  visible: t("uiSketch.canvasLabels.visible"),
                  hidden: t("uiSketch.canvasLabels.hidden"),
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
