"use client";

import { AimOutlined, ArrowRightOutlined } from "@ant-design/icons";
import {
  CompositionWorkflowView,
  type CompositionWorkflowViewKey,
} from "@human2ai/ui";
import { AspectRatioSelector } from "@human2ai/ui/yisiui/aspect-ratio-selector";
import { BasicButton } from "@human2ai/ui/yisiui/basic-button";
import { CompositeButton } from "@human2ai/ui/yisiui/composite-button";
import { SideActionPanel } from "@human2ai/ui/yisiui/side-action-panel";
import type { TFunction } from "i18next";
import { useRouter } from "next/navigation";
import { useEffect, useState, type SetStateAction } from "react";
import { useTranslation } from "react-i18next";

import {
  addArea,
  addDirectionLine,
  addFocus,
  changeFrame,
  createCompositionWorkflowState,
  createDraft,
  receiveCompositionRefinement,
  removeItem,
  resizeArea,
  rotateArea,
  rotateDirectionLine,
  updateCompositionWorkflowDraft,
  visibleAreaMetrics,
  type CompositionDraft,
  type CompositionFrame,
} from "../../../src/domain/composition";
import {
  Human2AiApiError,
  createCompositionSession,
  getSession,
  listCompositionDrafts,
  listCompositionRefinements,
  saveCompositionDraft,
  type CompositionDraftVersion,
  type CompositionRefinementRun,
  type Human2AiSession,
} from "../../lib/human2ai-api";
import styles from "./page.module.css";

const FRAME_OPTIONS = [
  { key: "3:2", label: "3:2", width: 3, height: 2 },
  { key: "1:1", label: "1:1", width: 1, height: 1 },
  { key: "2:3", label: "2:3", width: 2, height: 3 },
] as const;

const FRAMES: Record<(typeof FRAME_OPTIONS)[number]["key"], CompositionFrame> = {
  "3:2": { width: 1200, height: 800 },
  "1:1": { width: 1024, height: 1024 },
  "2:3": { width: 800, height: 1200 },
};

function createExampleDraft(): CompositionDraft {
  let draft = addFocus(createDraft(), { x: 0.32, y: 0.28 }).draft;
  draft = addArea(draft, {
    primitive: "circle",
    x: 0.28,
    y: 0.38,
    area: 0.1,
  }).draft;
  draft = addArea(draft, {
    primitive: "triangle",
    x: 0.68,
    y: 0.32,
    area: 0.08,
    rotation: 12,
  }).draft;
  draft = addArea(draft, {
    primitive: "quadrilateral",
    aspect: "free",
    x: 0.58,
    y: 0.72,
    area: 0.12,
    rotation: 352,
  }).draft;
  const direction = addDirectionLine(draft);
  return rotateDirectionLine(direction.draft, direction.id, 338);
}

interface CompositionSessionSnapshot {
  session: Human2AiSession;
  draftVersion: CompositionDraftVersion | null;
  refinement: CompositionRefinementRun | null;
}

async function loadCompositionSession(
  sessionId: string,
): Promise<CompositionSessionSnapshot> {
  const session = await getSession(sessionId);
  if (session.sessionType !== "image-composition") {
    throw new Error("SESSION_TYPE_MISMATCH");
  }
  const [draftVersions, refinementRuns] = await Promise.all([
    listCompositionDrafts(sessionId),
    listCompositionRefinements(sessionId),
  ]);
  const draftVersion = draftVersions.at(-1) ?? null;
  const refinement = draftVersion
    ? refinementRuns.find(
        (run) => run.sourceDraftRevision === draftVersion.revision,
      ) ?? null
    : null;
  return { session, draftVersion, refinement };
}

function frameKeyForDraft(draft: CompositionDraft): keyof typeof FRAMES {
  const ratio = draft.frame.width / draft.frame.height;
  return (Object.keys(FRAMES) as Array<keyof typeof FRAMES>).reduce((closest, key) =>
    Math.abs(FRAMES[key].width / FRAMES[key].height - ratio) <
    Math.abs(FRAMES[closest].width / FRAMES[closest].height - ratio)
      ? key
      : closest,
  );
}

function formatServiceError(error: unknown, t: TFunction): string {
  if (error instanceof Human2AiApiError) {
    if (error.code === "DRAFT_REVISION_CONFLICT") {
      return t("composition.session.revisionConflict", {
        revision: error.details.actualLatestRevision,
      });
    }
    return t("composition.session.serviceError", { message: error.message });
  }
  if (error instanceof Error && error.message === "SESSION_TYPE_MISMATCH") {
    return t("composition.session.typeMismatch");
  }
  return t("composition.session.serviceError", {
    message: error instanceof Error ? error.message : String(error),
  });
}

export default function CompositionPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [workflow, setWorkflow] = useState(() =>
    createCompositionWorkflowState(createExampleDraft()),
  );
  const [activeView, setActiveView] = useState<CompositionWorkflowViewKey>("draft");
  const [selectedId, setSelectedId] = useState<string | null>("area-1");
  const [frameKey, setFrameKey] = useState<keyof typeof FRAMES>("3:2");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionTitle, setSessionTitle] = useState<string | null>(null);
  const [latestRevision, setLatestRevision] = useState(0);
  const [observedRunId, setObservedRunId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [serviceError, setServiceError] = useState<string | null>(null);
  const draft = workflow.draft;
  const editing = activeView === "draft" && !loading && !saving;
  const metrics = visibleAreaMetrics(draft);
  const selectedArea = draft.areas.find((area) => area.id === selectedId);
  const selectedDirection = draft.directionLine?.id === selectedId ? draft.directionLine : null;
  const selectedRotation =
    selectedArea?.primitive !== "circle"
      ? selectedArea?.rotation
      : selectedDirection?.rotation;

  useEffect(() => {
    const requestedSessionId = new URLSearchParams(window.location.search).get(
      "session",
    );
    if (!requestedSessionId) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    void loadCompositionSession(requestedSessionId)
      .then((snapshot) => {
        if (cancelled) return;
        const nextDraft = snapshot.draftVersion?.draft ?? createExampleDraft();
        let nextWorkflow = createCompositionWorkflowState(nextDraft);
        if (snapshot.refinement) {
          nextWorkflow = receiveCompositionRefinement(
            nextWorkflow,
            snapshot.refinement.result,
          );
        }
        setWorkflow(nextWorkflow);
        setSessionId(snapshot.session.id);
        setSessionTitle(snapshot.session.title);
        setLatestRevision(snapshot.draftVersion?.revision ?? 0);
        setObservedRunId(snapshot.refinement?.id ?? null);
        setFrameKey(frameKeyForDraft(nextDraft));
        setSelectedId(nextDraft.areas[0]?.id ?? nextDraft.focusPoints[0]?.id ?? null);
        setDirty(snapshot.draftVersion === null);
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
  }, [t]);

  useEffect(() => {
    if (!sessionId || latestRevision === 0 || observedRunId) return;
    let cancelled = false;

    const refreshRefinement = async () => {
      try {
        const runs = await listCompositionRefinements(sessionId);
        const current = runs.find(
          (run) => run.sourceDraftRevision === latestRevision,
        );
        if (!cancelled && current) {
          setObservedRunId(current.id);
          setWorkflow((state) =>
            receiveCompositionRefinement(state, current.result),
          );
          setServiceError(null);
        }
      } catch (error) {
        if (!cancelled) setServiceError(formatServiceError(error, t));
      }
    };

    void refreshRefinement();
    const timer = window.setInterval(() => void refreshRefinement(), 3_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [latestRevision, observedRunId, sessionId, t]);

  function commit(result: { draft: CompositionDraft; id: string }): void {
    updateDraft(result.draft);
    setSelectedId(result.id);
  }

  function updateDraft(action: SetStateAction<CompositionDraft>): void {
    setWorkflow((current) => {
      const nextDraft = typeof action === "function" ? action(current.draft) : action;
      return updateCompositionWorkflowDraft(current, nextDraft);
    });
    setActiveView("draft");
    setDirty(true);
  }

  function resetDraft(): void {
    setWorkflow(createCompositionWorkflowState(createExampleDraft()));
    setActiveView("draft");
    setSelectedId("area-1");
    setFrameKey("3:2");
    setDirty(true);
    setServiceError(null);
  }

  async function saveForAgent(): Promise<void> {
    setSaving(true);
    setServiceError(null);
    try {
      let targetSessionId = sessionId;
      if (!targetSessionId) {
        const session = await createCompositionSession(
          t("composition.session.untitled"),
        );
        targetSessionId = session.id;
        setSessionId(session.id);
        setSessionTitle(session.title);
        router.replace(`/composition/?session=${encodeURIComponent(session.id)}`);
      }
      const saved = await saveCompositionDraft(
        targetSessionId,
        latestRevision,
        draft,
      );
      setLatestRevision(saved.revision);
      setObservedRunId(null);
      setWorkflow(createCompositionWorkflowState(saved.draft));
      setDirty(false);
    } catch (error) {
      setServiceError(formatServiceError(error, t));
    } finally {
      setSaving(false);
    }
  }

  function resizeSelected(multiplier: number): void {
    if (!selectedArea) return;
    updateDraft((current) => {
      const area = current.areas.find((item) => item.id === selectedArea.id);
      return area ? resizeArea(current, area.id, area.area * multiplier) : current;
    });
  }

  function rotateSelected(delta: number): void {
    if (selectedRotation === undefined || !selectedId) return;
    updateDraft((current) => {
      const area = current.areas.find((item) => item.id === selectedId);
      if (area && area.primitive !== "circle") {
        return rotateArea(current, area.id, (area.rotation ?? 0) + delta);
      }
      return current.directionLine?.id === selectedId
        ? rotateDirectionLine(current, selectedId, current.directionLine.rotation + delta)
        : current;
    });
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <BasicButton
            type="link"
            textColor="color.text.primary"
            onClick={() => router.push("/")}
          >
            ← {t("actions.back")}
          </BasicButton>
          <p className={styles.kicker}>{t("composition.kicker")}</p>
          <h1>{t("composition.title")}</h1>
          <p className={styles.description}>{t("composition.description")}</p>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.sessionState} aria-live="polite">
            <strong>{sessionTitle ?? t("composition.session.new")}</strong>
            <span>
              {latestRevision > 0
                ? t("composition.session.revision", { revision: latestRevision })
                : t("composition.session.notSaved")}
              {dirty ? ` · ${t("composition.session.unsavedChanges")}` : ""}
            </span>
          </div>
          <div className={styles.headerButtons}>
            <BasicButton disabled={loading || saving} onClick={resetDraft}>
              {t("actions.reset")}
            </BasicButton>
            <BasicButton
              type="primary"
              loading={saving}
              disabled={loading || (!dirty && latestRevision > 0)}
              onClick={() => void saveForAgent()}
            >
              {saving ? t("actions.savingForAgent") : t("actions.saveForAgent")}
            </BasicButton>
          </div>
        </div>
      </header>

      {serviceError ? (
        <p className={styles.serviceError} role="alert">
          {serviceError}
        </p>
      ) : null}

      <div className={styles.workspace}>
        <section className={styles.stage} aria-label={t("composition.workspace")}>
          <div className={styles.canvasWorkspace}>
            <SideActionPanel
              className={styles.toolPanel}
              width={144}
              aria-label={t("composition.tools")}
              collapseLabel={t("composition.collapseTools")}
              expandLabel={t("composition.expandTools")}
            >
              <CompositeButton
                icon={<AimOutlined aria-hidden="true" />}
                label={t("composition.toolNames.focus")}
                collapsedLabel={t("composition.addFocus")}
                disabled={!editing || draft.focusPoints.length >= 3}
                onClick={() =>
                  commit(
                    addFocus(draft, {
                      x: 0.22 + draft.focusPoints.length * 0.14,
                      y: 0.2 + draft.focusPoints.length * 0.12,
                    }),
                  )
                }
              />
              <CompositeButton
                icon={<span className={`${styles.shapeToolIcon} ${styles.circleToolIcon}`} />}
                label={t("composition.toolNames.circle")}
                collapsedLabel={t("composition.addCircle")}
                disabled={!editing}
                onClick={() => commit(addArea(draft, { primitive: "circle", area: 0.08 }))}
              />
              <CompositeButton
                icon={<span className={`${styles.shapeToolIcon} ${styles.triangleToolIcon}`} />}
                label={t("composition.toolNames.triangle")}
                collapsedLabel={t("composition.addTriangle")}
                disabled={!editing}
                onClick={() => commit(addArea(draft, { primitive: "triangle", area: 0.08 }))}
              />
              <CompositeButton
                icon={<span className={`${styles.shapeToolIcon} ${styles.quadrilateralToolIcon}`} />}
                label={t("composition.toolNames.quadrilateral")}
                collapsedLabel={t("composition.addQuadrilateral")}
                disabled={!editing}
                onClick={() =>
                  commit(
                    addArea(draft, {
                      primitive: "quadrilateral",
                      aspect: "free",
                      area: 0.08,
                    }),
                  )
                }
              />
              <CompositeButton
                icon={<ArrowRightOutlined aria-hidden="true" />}
                label={t("composition.toolNames.direction")}
                collapsedLabel={t("composition.addDirection")}
                disabled={!editing || Boolean(draft.directionLine)}
                onClick={() => commit(addDirectionLine(draft))}
              />
            </SideActionPanel>

            <CompositionWorkflowView
              draft={draft}
              status={workflow.status}
              refinement={workflow.refinement}
              activeView={activeView}
              onViewChange={setActiveView}
              selectedId={selectedId}
              onDraftChange={updateDraft}
              onSelectionChange={setSelectedId}
              errorMessage={workflow.errorMessage}
              labels={{
                draftView: t("composition.views.draft"),
                refinedView: t("composition.views.refined"),
                referenceView: t("composition.views.reference"),
                viewSwitch: t("composition.views.switch"),
                draftCanvas: t("composition.views.draftCanvas"),
                refinedCanvas: t("composition.views.refinedCanvas"),
                referenceCanvas: t("composition.views.referenceCanvas"),
                waitingStatus: t("composition.workflow.waitingStatus"),
                processingStatus: t("composition.workflow.processingStatus"),
                readyStatus: t("composition.workflow.readyStatus"),
                staleStatus: t("composition.workflow.staleStatus"),
                errorStatus: t("composition.workflow.errorStatus"),
                waitingMessage: t("composition.workflow.waitingMessage"),
                processingMessage: t("composition.workflow.processingMessage"),
                staleMessage: t("composition.workflow.staleMessage"),
                errorMessage: t("composition.workflow.errorMessage"),
                draftReadyMessage: t("composition.workflow.draftReadyMessage"),
                agentDecision: t("composition.workflow.agentDecision"),
                appliedMethods: t("composition.workflow.appliedMethods"),
                protectionAudit: t("composition.workflow.protectionAudit"),
                maximumFocusShift: t("composition.workflow.maximumFocusShift"),
                maximumAreaShift: t("composition.workflow.maximumAreaShift"),
                maximumRotationShift: t("composition.workflow.maximumRotationShift"),
                referenceHint: t("composition.workflow.referenceHint"),
              }}
            />
          </div>
        </section>

        <aside className={styles.panel} aria-label={t("composition.properties")}>
          {selectedId ? (
            <section>
              <h2>{t("composition.editSelected")}</h2>
              <p className={styles.hint}>{t("composition.dragHint")}</p>
              <div className={styles.property}>
                <span>
                  {t("composition.currentSelection")}: <strong>{selectedId}</strong>
                </span>
              </div>
              {selectedArea ? (
                <div className={styles.property}>
                  <span>
                    {t("composition.size")}: <strong>{Math.round(selectedArea.area * 100)}%</strong>
                  </span>
                  <div className={styles.propertyActions}>
                    <BasicButton disabled={!editing} size="small" onClick={() => resizeSelected(0.9)}>
                      {t("composition.smaller")}
                    </BasicButton>
                    <BasicButton disabled={!editing} size="small" onClick={() => resizeSelected(1.1)}>
                      {t("composition.larger")}
                    </BasicButton>
                  </div>
                </div>
              ) : null}
              {selectedRotation !== undefined ? (
                <div className={styles.property}>
                  <span>
                    {t("composition.rotation")}: <strong>{Math.round(selectedRotation)}°</strong>
                  </span>
                  <div className={styles.propertyActions}>
                    <BasicButton disabled={!editing} size="small" onClick={() => rotateSelected(-15)}>
                      {t("composition.rotateLeft")}
                    </BasicButton>
                    <BasicButton disabled={!editing} size="small" onClick={() => rotateSelected(15)}>
                      {t("composition.rotateRight")}
                    </BasicButton>
                  </div>
                </div>
              ) : null}
              <BasicButton
                danger
                backgroundColor="color.status.danger"
                textColor="color.brand.onPrimary"
                disabled={!editing}
                onClick={() => {
                  updateDraft(removeItem(draft, selectedId));
                  setSelectedId(null);
                }}
              >
                {t("composition.deleteSelected")}
              </BasicButton>
            </section>
          ) : null}

          <section>
            <h2>{t("composition.frameRatio")}</h2>
            <AspectRatioSelector
              options={FRAME_OPTIONS}
              value={frameKey}
              disabled={!editing}
              onChange={(key) => {
                const nextKey = key as keyof typeof FRAMES;
                setFrameKey(nextKey);
                updateDraft((current) => changeFrame(current, FRAMES[nextKey]));
              }}
              aria-label={t("composition.frameRatio")}
            />
          </section>

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
                <dd>{selectedId ?? t("composition.none")}</dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>
    </main>
  );
}
