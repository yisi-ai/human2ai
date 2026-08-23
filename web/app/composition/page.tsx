"use client";

import {
  CompositionWorkflowView,
  type CompositionWorkflowViewKey,
} from "@human2ai/ui";
import { AspectRatioSelector } from "@human2ai/ui/yisiui/aspect-ratio-selector";
import { BasicButton } from "@human2ai/ui/yisiui/basic-button";
import { useRouter } from "next/navigation";
import { useState, type SetStateAction } from "react";
import { useTranslation } from "react-i18next";

import {
  addArea,
  addDirectionLine,
  addFocus,
  changeFrame,
  createCompositionWorkflowState,
  createDraft,
  removeItem,
  resizeArea,
  rotateArea,
  rotateDirectionLine,
  updateCompositionWorkflowDraft,
  visibleAreaMetrics,
  type CompositionDraft,
  type CompositionFrame,
} from "../../../src/domain/composition";
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

export default function CompositionPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [workflow, setWorkflow] = useState(() =>
    createCompositionWorkflowState(createExampleDraft()),
  );
  const [activeView, setActiveView] = useState<CompositionWorkflowViewKey>("draft");
  const [selectedId, setSelectedId] = useState<string | null>("area-1");
  const [frameKey, setFrameKey] = useState<keyof typeof FRAMES>("3:2");
  const draft = workflow.draft;
  const editing = activeView === "draft";
  const metrics = visibleAreaMetrics(draft);
  const selectedArea = draft.areas.find((area) => area.id === selectedId);
  const selectedDirection = draft.directionLine?.id === selectedId ? draft.directionLine : null;
  const selectedRotation =
    selectedArea?.primitive !== "circle"
      ? selectedArea?.rotation
      : selectedDirection?.rotation;

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
  }

  function resetDraft(): void {
    setWorkflow(createCompositionWorkflowState(createExampleDraft()));
    setActiveView("draft");
    setSelectedId("area-1");
    setFrameKey("3:2");
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
        <BasicButton onClick={resetDraft}>{t("actions.reset")}</BasicButton>
      </header>

      <div className={styles.workspace}>
        <section className={styles.stage} aria-label={t("composition.workspace")}>
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
        </section>

        <aside className={styles.panel} aria-label={t("composition.tools")}>
          <section>
            <h2>{t("composition.addElements")}</h2>
            <div className={styles.actions}>
              <BasicButton
                disabled={!editing || draft.focusPoints.length >= 3}
                onClick={() =>
                  commit(
                    addFocus(draft, {
                      x: 0.22 + draft.focusPoints.length * 0.14,
                      y: 0.2 + draft.focusPoints.length * 0.12,
                    }),
                  )
                }
              >
                {t("composition.addFocus")}
              </BasicButton>
              <BasicButton
                disabled={!editing}
                onClick={() => commit(addArea(draft, { primitive: "circle", area: 0.08 }))}
              >
                {t("composition.addCircle")}
              </BasicButton>
              <BasicButton
                disabled={!editing}
                onClick={() => commit(addArea(draft, { primitive: "triangle", area: 0.08 }))}
              >
                {t("composition.addTriangle")}
              </BasicButton>
              <BasicButton
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
              >
                {t("composition.addQuadrilateral")}
              </BasicButton>
              <BasicButton
                disabled={!editing || Boolean(draft.directionLine)}
                onClick={() => commit(addDirectionLine(draft))}
              >
                {t("composition.addDirection")}
              </BasicButton>
              <BasicButton
                danger
                backgroundColor="color.status.danger"
                textColor="color.brand.onPrimary"
                disabled={!editing || !selectedId}
                onClick={() => {
                  if (!selectedId) return;
                  updateDraft(removeItem(draft, selectedId));
                  setSelectedId(null);
                }}
              >
                {t("composition.deleteSelected")}
              </BasicButton>
            </div>
          </section>

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
