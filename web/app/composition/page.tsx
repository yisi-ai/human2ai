"use client";

import { promptTranslationKey } from "../../../locales/promptKeys";
import {
  AimOutlined,
  CameraOutlined,
  CopyOutlined,
  DeleteOutlined,
  FileTextOutlined,
  FontSizeOutlined,
  LineOutlined,
  LockOutlined,
  PictureOutlined,
  UnlockOutlined,
} from "@ant-design/icons";
import {
  COMPOSITION_FRAME_ID,
  CompactDropdownSelect,
  CompositionWorkflowView,
  CompositionPlanningPanel,
  type CompositionPlanningLabels,
  UiSketchStateTabs,
  SessionDetails,
  CanvasHistoryControls,
  buildCompositionPrompt,
  copyCompositionSketchPng,
  type CompositionPromptTranslator,
  type CompositionCanvasViewportAction,
  type CompositionPlacementTool,
} from "@human2ai/ui";
import {
  AspectRatioSelector,
  type AspectRatioValue,
} from "@human2ai/ui/yisiui/aspect-ratio-selector";
import { BasicButton } from "@human2ai/ui/yisiui/basic-button";
import { CompositeButton } from "@human2ai/ui/yisiui/composite-button";
import { ConfirmAction } from "@human2ai/ui/yisiui/confirm-action";
import { LoadingState } from "@human2ai/ui/yisiui/loading-state";
import { Input, Popover, Tooltip } from "antd";
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

import {
  changeFrame,
  compositionFrameSizeForRatio,
  createDraft,
  isCompositionFrameRatioSupported,
  setProcessingSemantic,
  validateDraft,
  compositionStates,
  createCompositionState,
  selectCompositionState,
  renameCompositionState,
  reorderCompositionStates,
  deleteCompositionState,
  visibleAreaMetrics,
  type CompositionDraft,
} from "../../../src/domain/composition";
import {
  Human2AiApiError,
  createCompositionSession,
  getSession,
  imageAssetContentUrl,
  readImageFile,
  listCompositionDrafts,
  saveCompositionDraft,
  uploadImageAsset,
  type CompositionDraftVersion,
  type Human2AiSession,
} from "../../lib/human2ai-api";
import type { StyleProcessing } from "../../../src/domain/session";
import { SessionStyleControl } from "../../components/SessionStyleControl";
import { useSessionStyle } from "../../lib/use-session-style";
import { useCompositionSpatialReferences } from "../../components/CompositionSpatialReferences";
import { Human2AiShell } from "../../components/Human2AiShell";
import { buildSessionCliCommand } from "../../lib/session-connection";
import { useCanvasHistory } from "../../lib/use-canvas-history";
import styles from "./page.module.css";

type CanvasViewportActionType = CompositionCanvasViewportAction["type"];

const COMPACT_SIDE_ACTION_PANEL_WIDTH = 180;
const AUTO_SAVE_DELAY_MS = 800;
const DELIVERY_NOTICE_DURATION_MS = 2_000;
const EXTERNAL_DRAFT_REFRESH_MS = 3_000;

type DeliveryNotice = {
  type: "success" | "warning" | "error";
  message: string;
} | null;

interface CompositionSessionSnapshot {
  session: Human2AiSession;
  draftVersion: CompositionDraftVersion | null;
}

async function loadCompositionSession(
  sessionId: string,
): Promise<CompositionSessionSnapshot> {
  const session = await getSession(sessionId);
  if (session.sessionType !== "image-composition") {
    throw new Error("SESSION_TYPE_MISMATCH");
  }
  const draftVersions = await listCompositionDrafts(sessionId);
  return { session, draftVersion: draftVersions.at(-1) ?? null };
}

function frameRatioForDraft(draft: CompositionDraft): AspectRatioValue {
  const divisor = greatestCommonDivisor(draft.frame.width, draft.frame.height);
  return {
    width: draft.frame.width / divisor,
    height: draft.frame.height / divisor,
  };
}

function greatestCommonDivisor(left: number, right: number): number {
  let dividend = Math.abs(left);
  let divisor = Math.abs(right);
  while (divisor !== 0) {
    [dividend, divisor] = [divisor, dividend % divisor];
  }
  return dividend || 1;
}

function formatServiceError(error: unknown, t: TFunction): string {
  if (error instanceof Human2AiApiError) {
    if (error.code === "DRAFT_REVISION_CONFLICT") {
      return t("composition.session.revisionConflict", {
        revision: error.details.actualLatestRevision,
      });
    }
    return t("errors.serviceSync", { message: error.message });
  }
  if (error instanceof Error && error.message === "SESSION_TYPE_MISMATCH") {
    return t("composition.session.typeMismatch");
  }
  return t("errors.serviceSync", {
    message: error instanceof Error ? error.message : String(error),
  });
}

export default function CompositionPage() {
  const { t } = useTranslation();

  return (
    <Suspense
      fallback={(
        <LoadingState
          className={styles.routeLoading}
          label={t("composition.session.loading")}
          rows={10}
        />
      )}
    >
      <CompositionPageContent />
    </Suspense>
  );
}

function CompositionPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedSessionId = searchParams.get("session");
  const { t, i18n } = useTranslation();
  const translatePrompt = useCallback<CompositionPromptTranslator>(
    (key, values) => t(
      promptTranslationKey("composition", key),
      values,
    ),
    [t],
  );
  const [draft, setDraft] = useState(createDraft);
  const [placementTool, setPlacementTool] = useState<CompositionPlacementTool | null>(null);
  const [showPlanning, setShowPlanning] = useState(true);
  const [frameLocked, setFrameLocked] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [canvasZoom, setCanvasZoom] = useState(1);
  const [canvasViewportAction, setCanvasViewportAction] =
    useState<CompositionCanvasViewportAction>({ id: 0, type: "fit-frame" });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedPlanIds, setSelectedPlanIds] = useState<string[]>([]);
  const [planningLocked, setPlanningLocked] = useState(false);
  const planningLabels = t("composition.planning", { returnObjects: true }) as CompositionPlanningLabels;
  const [frameRatio, setFrameRatio] = useState<AspectRatioValue>({ width: 16, height: 9 });
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionTitle, setSessionTitle] = useState<string | null>(null);
  const [sessionMetadata, setSessionMetadata] = useState<Human2AiSession | null>(null);
  const [lastModifiedAt, setLastModifiedAt] = useState<string | null>(null);
  const [latestRevision, setLatestRevision] = useState(0);
  const [styleProcessing, setStyleProcessing] = useState<StyleProcessing>();
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [serviceError, setServiceError] = useState<string | null>(null);
  const [overallNoteOpen, setOverallNoteOpen] = useState(false);
  const [deliveryNotice, setDeliveryNotice] = useState<DeliveryNotice>(null);
  const [copyingPrompt, setCopyingPrompt] = useState(false);
  const [copyingSketch, setCopyingSketch] = useState(false);
  const draftChangeVersionRef = useRef(0);
  const saveContextVersionRef = useRef(0);
  const blockedAutoSaveVersionRef = useRef<number | null>(null);
  const revisionConflictRef = useRef(false);
  const locallyCreatedSessionIdRef = useRef<string | null>(null);
  const sessionCreationRef = useRef<Promise<Human2AiSession> | null>(null);
  const sessionStyle = useSessionStyle(sessionId, ensureCompositionSession, latestRevision);
  const history = useCanvasHistory(draft, ({ draft: restored }) => {
    draftChangeVersionRef.current += 1;
    blockedAutoSaveVersionRef.current = null;
    setDraft(restored);
    setDirty(true);
    setPlacementTool(null);
    setOverallNoteOpen(false);
    setSelectedIds([]);
    setSelectedPlanIds([]);
    setFrameRatio(frameRatioForDraft(restored));
  }, loading || revisionConflictRef.current);
  const spatialReferences = useCompositionSpatialReferences({ draft, sessionId, ensureSession: ensureCompositionSession, updateDraft });
  const editing = !loading;
  const states = compositionStates(draft);
  const activeStateId = draft.activeStateId ?? states[0].id;
  const metrics = visibleAreaMetrics(draft);
  const selectedItemIds = selectedIds.filter((id) => id !== COMPOSITION_FRAME_ID);
  const processingSemanticOptions = [
    {
      value: "scene-composition",
      label: t("composition.mode.scene"),
    },
    {
      value: "editorial-layout",
      label: t("composition.mode.editorial"),
    },
  ];

  useEffect(() => {
    if (!deliveryNotice) return;
    const timer = window.setTimeout(
      () => setDeliveryNotice(null),
      DELIVERY_NOTICE_DURATION_MS,
    );
    return () => window.clearTimeout(timer);
  }, [deliveryNotice]);

  useEffect(() => {
    if (
      requestedSessionId &&
      requestedSessionId === locallyCreatedSessionIdRef.current
    ) {
      locallyCreatedSessionIdRef.current = null;
      return;
    }

    setPlacementTool(null);
    saveContextVersionRef.current += 1;
    draftChangeVersionRef.current = 0;
    revisionConflictRef.current = false;
    blockedAutoSaveVersionRef.current = null;
    setDirty(false);

    if (!requestedSessionId) {
      const empty = createDraft();
      history.reset(empty);
      setDraft(empty);
      setShowPlanning(true);
      setFrameLocked(false);
      setPlanningLocked(false);
      setCanvasZoom(1);
      requestCanvasViewport("fit-frame");
      setSelectedIds([]);
      setSelectedPlanIds([]);
      setFrameRatio({ width: 16, height: 9 });
      setSessionId(null);
      setSessionTitle(null);
      setSessionMetadata(null);
      setLastModifiedAt(null);
      setLatestRevision(0);
      setStyleProcessing(undefined);
      setServiceError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setShowPlanning(true);
    setFrameLocked(false);
    setPlanningLocked(false);
    setCanvasZoom(1);
    setSessionId(null);
    setSessionTitle(null);
    setSessionMetadata(null);
    setLastModifiedAt(null);
    setServiceError(null);
    void loadCompositionSession(requestedSessionId)
      .then((snapshot) => {
        if (cancelled) return;
        const nextDraft = snapshot.draftVersion?.draft ?? createDraft();
        history.reset(nextDraft);
        setDraft(nextDraft);
        setSessionId(snapshot.session.id);
        setSessionTitle(snapshot.session.title);
        setSessionMetadata(snapshot.session);
        setLastModifiedAt(
          snapshot.draftVersion?.createdAt ?? snapshot.session.updatedAt,
        );
        setLatestRevision(snapshot.draftVersion?.revision ?? 0);
        setStyleProcessing(snapshot.draftVersion?.styleProcessing);
        setFrameRatio(frameRatioForDraft(nextDraft));
        const initialSelection = nextDraft.areas[0]?.id ?? nextDraft.focusPoints[0]?.id;
        setSelectedIds(initialSelection ? [initialSelection] : []);
        setSelectedPlanIds([]);
        requestCanvasViewport("fit-frame");
        setDirty(false);
        setServiceError(null);
      })
      .catch((error) => {
        if (!cancelled) setServiceError(formatServiceError(error, t));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [requestedSessionId, t]);

  useEffect(() => {
    const draftChangeVersion = draftChangeVersionRef.current;
    if (
      revisionConflictRef.current ||
      loading ||
      saving ||
      !dirty ||
      blockedAutoSaveVersionRef.current === draftChangeVersion
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
            targetSessionId = await ensureCompositionSession();
            if (saveContextVersion !== saveContextVersionRef.current) return;
          }

          const saved = await saveCompositionDraft(
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
            error instanceof Human2AiApiError &&
            error.code === "DRAFT_REVISION_CONFLICT"
              ? error.details.actualLatestRevision
              : null;
          if (
            typeof actualLatestRevision === "number" &&
            Number.isInteger(actualLatestRevision)
          ) {
            revisionConflictRef.current = true;
            history.reset(history.current());
            setLatestRevision(actualLatestRevision);
          } else {
            blockedAutoSaveVersionRef.current = draftChangeVersionRef.current;
          }
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
        const versions = await listCompositionDrafts(sessionId);
        const latest = versions.at(-1);
        if (!cancelled && observedChangeVersion === draftChangeVersionRef.current && latest && latest.revision > latestRevision) {
          history.reset(latest.draft);
          setDraft(latest.draft);
          setLatestRevision(latest.revision);
          setStyleProcessing(latest.styleProcessing);
          setLastModifiedAt(latest.createdAt);
          setFrameRatio(frameRatioForDraft(latest.draft));
          const initialSelection = latest.draft.areas[0]?.id
            ?? latest.draft.focusPoints[0]?.id;
          setSelectedIds(initialSelection ? [initialSelection] : []);
          setSelectedPlanIds([]);
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

  function armPlacement(tool: CompositionPlacementTool): void {
    setOverallNoteOpen(false);
    setPlacementTool((current) => current === tool ? null : tool);
  }

  async function ensureCompositionSession(): Promise<string> {
    if (sessionId) return sessionId;
    const pending = sessionCreationRef.current ?? createCompositionSession(
      t("composition.session.untitled"),
    );
    sessionCreationRef.current = pending;
    try {
      const session = await pending;
      locallyCreatedSessionIdRef.current = session.id;
      setSessionId(session.id);
      setSessionTitle(session.title);
      setSessionMetadata(session);
      setLastModifiedAt(session.updatedAt);
      router.replace(`/composition?session=${encodeURIComponent(session.id)}`);
      return session.id;
    } finally {
      if (sessionCreationRef.current === pending) sessionCreationRef.current = null;
    }
  }

  async function uploadCanvasImage(file: File): Promise<string> {
    const targetSessionId = await ensureCompositionSession();
    return (await uploadImageAsset(targetSessionId, file)).id;
  }

  function updateDraft(
    action: SetStateAction<CompositionDraft>,
  ): void {
    const nextDraft = validateDraft(typeof action === "function" ? action(history.current()) : action);
    if (!history.record(nextDraft)) return;
    draftChangeVersionRef.current += 1;
    blockedAutoSaveVersionRef.current = null;
    setDraft(nextDraft);
    setFrameRatio(frameRatioForDraft(nextDraft));
    setDirty(true);
  }

  function resetDraft(): void {
    if (planningLocked) return;
    const empty = createDraft();
    history.record(empty);
    setPlacementTool(null);
    draftChangeVersionRef.current += 1;
    blockedAutoSaveVersionRef.current = null;
    setDraft(empty);
    setShowPlanning(true);
    setFrameLocked(false);
    setPlanningLocked(false);
    setCanvasZoom(1);
    requestCanvasViewport("fit-frame");
    setSelectedIds([]);
    setSelectedPlanIds([]);
    setFrameRatio({ width: 16, height: 9 });
    setDirty(true);
    setServiceError(null);
  }

  function selectPlan(ids: string[]): void {
    setSelectedPlanIds(ids);
    setSelectedIds([]);
    setPlacementTool(null);
  }

  function requestCanvasViewport(type: CanvasViewportActionType): void {
    setCanvasViewportAction((current) => ({ id: current.id + 1, type }));
  }

  function changeState(action: (current: CompositionDraft) => CompositionDraft): void {
    updateDraft(action);
    setPlacementTool(null);
    setSelectedIds([]);
    setSelectedPlanIds([]);
    setOverallNoteOpen(false);
    requestCanvasViewport("fit-frame");
  }

  async function copyPrompt(): Promise<void> {
    setCopyingPrompt(true);
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error(t("clipboard.promptUnsupported"));
      }
      const stylePrompt = await sessionStyle.readPromptLine();
      await navigator.clipboard.writeText(buildCompositionPrompt(draft, translatePrompt, stylePrompt));
      setDeliveryNotice({ type: "success", message: t("clipboard.copied") });
    } catch (error) {
      setDeliveryNotice({
        type: "error",
        message: error instanceof Error && error.message === t("clipboard.promptUnsupported")
          ? error.message
          : t("clipboard.promptFailed"),
      });
    } finally {
      setCopyingPrompt(false);
    }
  }

  async function copySketch(): Promise<void> {
    setCopyingSketch(true);
    try {
      const result = await copyCompositionSketchPng(
        draft,
        sessionId ? (assetId) => imageAssetContentUrl(sessionId, assetId) : undefined,
      );
      setDeliveryNotice(
        result === "downloaded"
          ? { type: "warning", message: t("clipboard.previewDownloaded") }
          : { type: "success", message: t("clipboard.copied") },
      );
    } catch {
      setDeliveryNotice({ type: "error", message: t("clipboard.previewFailed") });
    } finally {
      setCopyingSketch(false);
    }
  }

  const overallNoteEditor = (
    <label className={styles.overallNoteEditor}>
      <span>{t("composition.globalNote.title")}</span>
      <Input.TextArea
        name="overallNote"
        autoFocus
        autoSize={{ minRows: 4, maxRows: 8 }}
        value={draft.overallNote}
        placeholder={t("composition.globalNote.placeholder")}
        aria-label={t("composition.globalNote.ariaLabel")}
        disabled={!editing}
        onChange={(event) => updateDraft(
          (current) => ({
            ...current,
            overallNote: event.target.value,
          }),
        )}
      />
    </label>
  );

  const toolButtons = (
    <div
      className={styles.toolGroups}
      role="group"
      aria-label={t("canvas.tools.label")}
      data-composition-tool-groups
    >
      <div className={styles.toolGroup} data-composition-tool-group="focus">
        <CompositeButton
          className={styles.capacityTool}
          icon={<AimOutlined aria-hidden="true" />}
          label={t("composition.toolNames.focus")}
          description={t("composition.elementCapacity.compact", {
            current: draft.focusPoints.length,
            limit: 3,
          })}
          aria-label={t("composition.elementCapacity.ariaLabel", {
            label: t("composition.toolNames.focus"),
            current: draft.focusPoints.length,
            limit: 3,
          })}
          disabled={!editing || draft.focusPoints.length >= 3}
          aria-current={placementTool === "focus" ? true : undefined}
          textColor={placementTool === "focus" ? "color.action.primary" : "color.text.primary"}
          onClick={() => armPlacement("focus")}
        />
      </div>

      <div className={styles.toolGroup} data-composition-tool-group="direction">
        <CompositeButton
          className={styles.capacityTool}
          icon={<LineOutlined rotate={-20} aria-hidden="true" />}
          label={t("composition.flow.label")}
          description={t("composition.elementCapacity.compact", {
            current: draft.directionLine ? 1 : 0,
            limit: 1,
          })}
          aria-label={t("composition.elementCapacity.ariaLabel", {
            label: t("composition.flow.label"),
            current: draft.directionLine ? 1 : 0,
            limit: 1,
          })}
          disabled={!editing || Boolean(draft.directionLine)}
          aria-current={placementTool === "direction" ? true : undefined}
          textColor={placementTool === "direction" ? "color.action.primary" : "color.text.primary"}
          onClick={() => armPlacement("direction")}
        />
      </div>

      <div className={styles.toolGroup} data-composition-tool-group="shapes">
        <CompositeButton
          icon={<span className={`${styles.shapeToolIcon} ${styles.circleToolIcon}`} />}
          label={t("composition.toolNames.circle")}
          disabled={!editing}
          aria-current={placementTool === "circle" ? true : undefined}
          textColor={placementTool === "circle" ? "color.action.primary" : "color.text.primary"}
          onClick={() => armPlacement("circle")}
        />
        <CompositeButton
          icon={<span className={`${styles.shapeToolIcon} ${styles.triangleToolIcon}`} />}
          label={t("composition.toolNames.triangle")}
          disabled={!editing}
          aria-current={placementTool === "triangle" ? true : undefined}
          textColor={placementTool === "triangle" ? "color.action.primary" : "color.text.primary"}
          onClick={() => armPlacement("triangle")}
        />
        <CompositeButton
          icon={(
            <span
              className={`${styles.shapeToolIcon} ${styles.quadrilateralToolIcon}`}
            />
          )}
          label={t("composition.toolNames.quadrilateral")}
          disabled={!editing}
          aria-current={placementTool === "quadrilateral" ? true : undefined}
          textColor={placementTool === "quadrilateral" ? "color.action.primary" : "color.text.primary"}
          onClick={() => armPlacement("quadrilateral")}
        />
        <CompositeButton
          icon={<FontSizeOutlined aria-hidden="true" />}
          label={t("composition.toolNames.textRegion")}
          disabled={!editing}
          aria-current={placementTool === "text" ? true : undefined}
          textColor={placementTool === "text" ? "color.action.primary" : "color.text.primary"}
          onClick={() => armPlacement("text")}
        />
        <CompositeButton
          icon={<PictureOutlined aria-hidden="true" />}
          label={t("canvas.imageNode.label")}
          collapsedLabel={t("canvas.imageNode.add")}
          disabled={!editing}
          aria-current={placementTool === "image" ? true : undefined}
          textColor={placementTool === "image" ? "color.action.primary" : "color.text.primary"}
          onClick={() => armPlacement("image")}
        />
        <CompositeButton icon={<CameraOutlined aria-hidden="true" />} label={t("spatial.reference")} collapsedLabel={t("spatial.addReference")} disabled={!editing} onClick={spatialReferences.openPicker} />
      </div>

      <div className={styles.toolGroup} data-composition-tool-group="overall-note">
        <Popover
          content={overallNoteEditor}
          trigger="click"
          placement="leftTop"
          open={editing && overallNoteOpen}
          onOpenChange={(open) => setOverallNoteOpen(open && editing)}
        >
          <span className={styles.toolAction}>
            <CompositeButton
              icon={<FileTextOutlined aria-hidden="true" />}
              label={t("notes.global.label")}
              disabled={!editing}
            />
          </span>
        </Popover>
      </div>

      <div className={styles.toolGroup} data-composition-tool-group="copy">
        <span className={styles.toolGroupTitle}>{t("clipboard.group")}</span>
        <CompositeButton
          icon={<CopyOutlined aria-hidden="true" />}
          label={t("clipboard.copyPrompt")}
          loading={copyingPrompt}
          disabled={loading}
          onClick={() => void copyPrompt()}
        />
        <CompositeButton
          icon={<PictureOutlined aria-hidden="true" />}
          label={t("clipboard.copyPreview")}
          loading={copyingSketch}
          disabled={loading}
          onClick={() => void copySketch()}
        />
      </div>
    </div>
  );

  return (
    <Human2AiShell
      currentSessionId={requestedSessionId}
      onCurrentSessionRename={setSessionTitle}
      title={sessionTitle ?? t("composition.session.new")}
      rightPanelOpen={rightPanelOpen}
      onRightPanelOpenChange={setRightPanelOpen}
      rightPanel={(
        <div
          className={`${styles.panel} ${loading ? styles.panelIsLoading : ""}`}
          data-canvas-editor
        >
          {loading ? (
            <LoadingState
              className={styles.panelLoading}
              label={t("composition.session.loading")}
              rows={8}
              compact
            />
          ) : rightPanelOpen ? (
            <>
              <SessionDetails
                primaryItem={{
                  label: t("composition.mode.label"),
                  value: (
                    <CompactDropdownSelect
                      className={styles.processingSemanticSelect}
                      value={draft.processingSemantic ?? undefined}
                      options={processingSemanticOptions}
                      aria-label={t("composition.mode.label")}
                      placeholder={t("composition.mode.placeholder")}
                      disabled={!editing}
                      onChange={(value) => {
                        if (
                          value !== "scene-composition"
                          && value !== "editorial-layout"
                        ) return;
                        updateDraft((current) => setProcessingSemantic(current, value));
                      }}
                    />
                  ),
                }}
                createdAt={sessionMetadata?.createdAt ?? null}
                updatedAt={lastModifiedAt}
                nodeCount={
                  draft.areas.length
                  + draft.images.length
                  + draft.focusPoints.length
                  + (draft.directionLine ? 1 : 0)
                }
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
              <SessionStyleControl controller={sessionStyle} category="visual" processing={styleProcessing} disabled={loading || saving} />
              <section>
                <div className={styles.sectionHeading}>
                  <h2>{t("canvas.tools.label")}</h2>
                  <div className={styles.sectionHeadingActions}>
                    <Tooltip title={t("composition.clearCanvas")}>
                      <span>
                        <ConfirmAction
                          type="text"
                          size="small"
                          icon={<DeleteOutlined aria-hidden="true" />}
                          aria-label={t("composition.clearCanvas")}
                          title={t("composition.clearCanvasConfirmTitle")}
                          description={t("composition.clearCanvasConfirmDescription")}
                          confirmLabel={t("composition.clearCanvas")}
                          cancelLabel={t("actions.cancel")}
                          disabled={loading || saving || planningLocked}
                          onConfirm={resetDraft}
                          data-composition-clear-canvas-action
                        >
                          {null}
                        </ConfirmAction>
                      </span>
                    </Tooltip>
                  </div>
                </div>
                {toolButtons}
              </section>
            </>
          ) : null}

          <section>
            <div className={styles.sectionHeading}>
              <h2>{t("composition.frameRatio")}</h2>
              <div className={styles.sectionHeadingActions}>
                <BasicButton
                  mode="icon-only"
                  size="small"
                  icon={frameLocked ? <LockOutlined /> : <UnlockOutlined />}
                  iconLabel={
                    frameLocked
                      ? t("composition.unlockFrame")
                      : t("composition.lockFrame")
                  }
                  title={
                    frameLocked
                      ? t("composition.unlockFrame")
                      : t("composition.lockFrame")
                  }
                  aria-pressed={frameLocked}
                  backgroundColor={frameLocked ? "color.action.primaryActive" : "none"}
                  textColor={frameLocked ? "color.text.onPrimary" : "color.text.secondary"}
                  disabled={!editing}
                  onClick={() => setFrameLocked((locked) => !locked)}
                />
              </div>
            </div>
            <div className={styles.aspectRatioSelector}>
              <AspectRatioSelector
                ratio={frameRatio}
                disabled={!editing || frameLocked}
                onRatioChange={(ratio) => {
                  if (!isCompositionFrameRatioSupported(ratio.width, ratio.height)) return;
                  setFrameRatio(ratio);
                  updateDraft((current) =>
                    changeFrame(
                      current,
                      compositionFrameSizeForRatio(ratio.width, ratio.height),
                    ),
                  );
                }}
                title={t("composition.aspectRatioTitle")}
                widthLabel={t("dimensions.width")}
                heightLabel={t("dimensions.height")}
                aria-label={t("composition.frameRatio")}
              />
            </div>
          </section>

          <CompositionPlanningPanel draft={draft} selectedIds={selectedPlanIds} onSelect={selectPlan}
            showPlanning={showPlanning} onShowPlanningChange={setShowPlanning}
            locked={planningLocked} onLockedChange={(locked) => { setPlanningLocked(locked); setSelectedPlanIds([]); }}
            onDraftChange={updateDraft} labels={planningLabels} deleteLabel={t("actions.delete")} disabled={!editing} />

          <section>
            <h2>{t("composition.areaOverview")}</h2>
            <dl className={styles.metrics}>
              <div>
                <dt>{t("composition.occupied")}</dt>
                <dd>{Math.round(metrics.occupiedArea * 100)}%</dd>
              </div>
              <div>
                <dt>{t("composition.negativeSpace")}</dt>
                <dd>{Math.round(metrics.negativeSpace * 100)}%</dd>
              </div>
              <div>
                <dt>{t("composition.currentSelection")}</dt>
                <dd>{selectedItemIds.join(", ") || t("composition.none")}</dd>
              </div>
            </dl>
          </section>
        </div>
      )}
    >
      <main className={styles.page} data-canvas-editor>
        {deliveryNotice ? (
          <div
            className={`${styles.deliveryNotice} ${
              deliveryNotice.type === "success"
                ? styles.deliveryNoticeSuccess
                : deliveryNotice.type === "warning"
                  ? styles.deliveryNoticeWarning
                  : styles.deliveryNoticeError
            }`}
            role="status"
          >
            {deliveryNotice.message}
          </div>
        ) : null}
        {serviceError ? (
          <p className={styles.serviceError} role="alert">
            {serviceError}
          </p>
        ) : null}

        <div className={styles.workspace}>
          {spatialReferences.picker}
          <section className={styles.stage} aria-label={t("composition.workspace")}>
            <CanvasHistoryControls {...history} labels={{ undo: t("canvasHistory.undo"), redo: t("canvasHistory.redo"), label: t("canvasHistory.label") }} />
            {loading ? (
              <LoadingState
                className={styles.workspaceLoading}
                label={t("composition.session.loading")}
                rows={10}
              />
            ) : (
              <CompositionWorkflowView
              className={styles.workflow}
              interactionResetKey={history.restoreToken}
              draft={draft}
              status="waiting"
              activeView="draft"
              onViewChange={() => undefined}
              stateControls={(
                  <UiSketchStateTabs
                    items={states.map((state) => ({ id: state.id,
                      label: state.name ?? t("uiSketch.states.defaultName", { number: state.number }) }))}
                    value={activeStateId}
                    labels={{
                      switch: t("canvasStates.switch"),
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
                    onChange={(id) => changeState((current) => selectCompositionState(current, id))}
                    onCreate={(sourceId) => {
                      const id = crypto.randomUUID();
                      changeState((current) => createCompositionState(current, sourceId, id));
                    }}
                    onRename={(id, name) => updateDraft((current) => renameCompositionState(current, id, name))}
                    onReorder={(ids) => updateDraft((current) => reorderCompositionStates(current, ids))}
                    onDelete={(id) => changeState((current) => deleteCompositionState(current, id))}
                  />
              )}
              showPlanning={showPlanning}
              selectedPlanIds={selectedPlanIds}
              planningLocked={planningLocked}
              onPlanSelectionChange={selectPlan}
              planningLabels={planningLabels}
              frameLocked={frameLocked}
              canvasZoom={canvasZoom}
              canvasViewportAction={canvasViewportAction}
              onCanvasZoomChange={setCanvasZoom}
              canvasBackgroundPattern="dots"
              showCanvasViewportControls={!loading}
              canvasViewportLabels={{
                zoomOut: t("composition.zoomOut"),
                zoomIn: t("composition.zoomIn"),
                currentZoom: t("composition.canvasZoom"),
                fitAll: t("composition.fitAll"),
                help: t("canvas.viewport.help"),
                interactionHelp: `${t("canvas.viewport.instructions")} ${t("composition.textRegion.cornerHelp")}`,
                sideActions: t("canvas.tools.label"),
                collapseSideActions: t("composition.collapseTools"),
                expandSideActions: t("composition.expandTools"),
              }}
              canvasLayerLabels={{
                  bringToFront: t("canvasLayers.bringToFront"),
                  bringForward: t("canvasLayers.bringForward"),
                  sendBackward: t("canvasLayers.sendBackward"),
                  sendToBack: t("canvasLayers.sendToBack"),
              }}
              directionControlLabels={[
                t("composition.flow.controlPoint", { number: 1 }),
                t("composition.flow.controlPoint", { number: 2 }),
              ]}
              nodeEditorLabels={{
                title: t("canvasNodeEditor.title"),
                note: t("notes.element.label"),
                notePlaceholder: t("notes.element.nodePlaceholder"),
                shotScale: t("composition.depth.label"),
                shotScaleAuto: t("composition.depth.auto"),
                shotScaleForeground: t("composition.depth.foreground"),
                shotScaleMidground: t("composition.depth.midground"),
                shotScaleBackground: t("composition.depth.background"),
                deleteNode: t("actions.deleteNode"),
                confirmDeleteNode: t("confirmations.deleteNode"),
                cancelDelete: t("actions.keep"),
                shapeKind: t("canvasNodeEditor.shapeKind"),
                pointKind: t("canvasNodeEditor.pointKind"),
                lineKind: t("composition.flow.label"),
                textKind: t("composition.toolNames.textRegion"),
                imageKind: t("canvas.imageNode.label"),
                nodeDescription: t("canvas.node.nodeDescription"),
                originUser: t("canvas.node.originUser"),
                originAgent: t("canvas.node.originAgent"),
                originImport: t("canvas.node.originImport"),
              }}
              areaEditorLabels={{
                lightSource: t("composition.lightSource.toggle"),
                displayText: t("textContent.label"),
                cornerLabel: t("composition.textRegion.cornerLabel", { index: "{{index}}" }),
                displayTextPlaceholder: t("textContent.compositionPlaceholder"),
                visualWeight: t("visualWeight.label"),
                weightAuto: t("visualWeight.auto"),
                weightHigh: t("visualWeight.high"),
                weightMedium: t("visualWeight.medium"),
                weightLow: t("visualWeight.low"),
                weightDecorative: t("visualWeight.decorative"),
              }}
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
              resolveImageSource={sessionId
                ? (assetId) => imageAssetContentUrl(sessionId, assetId)
                : undefined}
              renderCameraReference={spatialReferences.renderImageContent}
              onImageUpload={uploadCanvasImage}
              onReadImageFile={readImageFile}
              canvasSideActions={rightPanelOpen ? undefined : toolButtons}
              canvasSideActionPanelWidth={COMPACT_SIDE_ACTION_PANEL_WIDTH}
              canvasSideActionPanelDefaultCollapsed
              selectedIds={selectedIds}
              onDraftChange={updateDraft}
              placementTool={placementTool}
              onPlacementToolChange={setPlacementTool}
              onSelectionChange={(ids) => { setSelectedIds(ids); setSelectedPlanIds([]); }}
              labels={{
                draftView: t("composition.views.draft"),
                refinedView: t("composition.views.refined"),
                referenceView: t("composition.views.reference"),
                viewSwitch: t("composition.views.switch"),
                draftCanvas: t("composition.views.draftCanvas"),
                refinedCanvas: t("composition.views.refinedCanvas"),
                referenceCanvas: t("composition.views.referenceCanvas"),
                agentDecision: t("composition.workflow.agentDecision"),
                appliedMethods: t("composition.workflow.appliedMethods"),
                protectionAudit: t("composition.workflow.protectionAudit"),
                maximumFocusShift: t("composition.workflow.maximumFocusShift"),
                maximumAreaShift: t("composition.workflow.maximumAreaShift"),
                maximumRotationShift: t("composition.workflow.maximumRotationShift"),
                objective: t("composition.refinement.objective"),
                observations: t("composition.refinement.observations"),
                uncertainties: t("composition.refinement.uncertainties"),
                preserve: t("composition.refinement.preserve"),
                tradeoffs: t("composition.refinement.tradeoffs"),
                relations: t("composition.refinement.relations"),
                retained: t("composition.refinement.retained"),
                target: t("composition.refinement.target"),
                before: t("composition.refinement.before"),
                after: t("composition.refinement.after"),
                error: t("composition.refinement.error"),
                unmeasurable: t("composition.refinement.unmeasurable"),
                framePlacement: t("composition.refinement.framePlacement"),
                sizeRatio: t("composition.refinement.sizeRatio"),
                mirrorSymmetry: t("composition.refinement.mirrorSymmetry"),
                focusFlow: t("composition.refinement.focusFlow"),
                focusAnchor: t("composition.refinement.focusAnchor"),
                axisRelation: t("composition.refinement.axisRelation"),
                rotationAlignment: t("composition.refinement.rotationAlignment"),
                blockAlignment: t("composition.refinement.blockAlignment"),
                spacingRhythm: t("composition.refinement.spacingRhythm"),

              }}
              />
            )}
          </section>
        </div>
      </main>
    </Human2AiShell>
  );
}
