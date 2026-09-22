"use client";

import type { CanvasLayerLabels } from "./useCanvasContextMenu";

import { TabSwitch, type TabSwitchItems } from "@human2ai/ui/yisiui/tab-switch";
import { type CSSProperties, type ReactNode } from "react";

import {
  draftFingerprint,
  type RefinementRelationCheck,
  type CompositionDraft,
  type CompositionRefinementResult,
  type CompositionWorkflowStatus,
} from "../../../../../src/domain/composition";
import { uiAssetAttributes } from "../vendor/yisiui/runtime/src/assetMarker";
import {
  CompositionCanvas,
  type CompositionAreaEditorLabels,
  type CompositionPlacementTool,
  type CompositionCanvasViewportAction,
} from "./CompositionCanvas";
import type { CanvasImageEditorLabels } from "./CanvasImageEditorFields";
import type { Human2AiCanvasNodeEditorLabels } from "./Human2AiCanvasNodeEditor";
import type {
  InfiniteCanvasBackgroundPattern,
  InfiniteCanvasSideActionPlacement,
  InfiniteCanvasViewportLabels,
} from "./InfiniteCanvasViewport";

import "./CompositionWorkflowView.css";

export type CompositionWorkflowViewKey = "draft" | "refined" | "reference";

export interface CompositionWorkflowLabels {
  draftView: string;
  refinedView: string;
  referenceView: string;
  viewSwitch: string;
  draftCanvas: string;
  refinedCanvas: string;
  referenceCanvas: string;
  agentDecision: string;
  appliedMethods: string;
  protectionAudit: string;
  maximumFocusShift: string;
  maximumAreaShift: string;
  maximumRotationShift: string;
  objective: string;
  observations: string;
  uncertainties: string;
  preserve: string;
  tradeoffs: string;
  relations: string;
  retained: string;
  target: string;
  before: string;
  after: string;
  error: string;
  unmeasurable: string;
  framePlacement: string;
  sizeRatio: string;
  mirrorSymmetry: string;
  focusFlow: string;
  focusAnchor: string;
  axisRelation: string;
  rotationAlignment: string;
  blockAlignment: string;
  spacingRhythm: string;

}

interface CompositionWorkflowCanvasProps {
  selectedPlanIds?: readonly string[];
  planningLocked?: boolean;
  onPlanSelectionChange?: (ids: string[]) => void;
  planningLabels?: import("./CompositionPlanningPanel").CompositionPlanningLabels;
  stateControls?: ReactNode;
  interactionResetKey?: number;
  draft: CompositionDraft;
  status: CompositionWorkflowStatus;
  refinement?: CompositionRefinementResult | null;
  activeView: CompositionWorkflowViewKey;
  onViewChange: (view: CompositionWorkflowViewKey) => void;
  selectedIds?: readonly string[];
  onDraftChange?: (draft: CompositionDraft) => void;
  placementTool?: CompositionPlacementTool | null;
  onPlacementToolChange?: (tool: CompositionPlacementTool | null) => void;
  onSelectionChange?: (ids: string[]) => void;
  onItemDoubleClick?: (id: string) => void;
  showPlanning?: boolean;
  frameLocked?: boolean;
  canvasZoom?: number;
  canvasViewportAction?: CompositionCanvasViewportAction;
  onCanvasZoomChange?: (zoom: number) => void;
  canvasBackgroundPattern?: InfiniteCanvasBackgroundPattern;
  showCanvasViewportControls?: boolean;
  canvasSideActions?: ReactNode;
  canvasSideActionPlacement?: InfiniteCanvasSideActionPlacement;
  canvasSideActionPanelWidth?: CSSProperties["width"];
  canvasSideActionPanelDefaultCollapsed?: boolean;
  canvasViewportLabels?: Partial<InfiniteCanvasViewportLabels>;
  canvasLayerLabels?: Partial<CanvasLayerLabels>;
  nodeEditorLabels?: Partial<Human2AiCanvasNodeEditorLabels>;
  directionControlLabels?: readonly [string, string];
  areaEditorLabels?: Partial<CompositionAreaEditorLabels>;
  imageEditorLabels?: Partial<CanvasImageEditorLabels>;
  renderCameraReference?: (image: CompositionDraft["images"][number]) => ReactNode;
  resolveImageSource?: (assetId: string) => string | undefined;
  onImageUpload?: (file: File) => Promise<string>;
  onReadImageFile?: (src: string) => Promise<File>;
  labels?: Partial<CompositionWorkflowLabels>;
  className?: string;
  style?: CSSProperties;
}

interface CompositionWorkflowLayoutProps {
  stateControls: ReactNode;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  "data-active-stage"?: string;
}

export type CompositionWorkflowViewProps = CompositionWorkflowCanvasProps | CompositionWorkflowLayoutProps;

const DEFAULT_LABELS: CompositionWorkflowLabels = {
  draftView: "构图",
  refinedView: "精修",
  referenceView: "预览",
  viewSwitch: "构图视图",
  draftCanvas: "用户构图草图",
  refinedCanvas: "Agent 精修后的构图",
  referenceCanvas: "用于生图的结构参考",
  agentDecision: "Agent 判断",
  appliedMethods: "执行方法",
  protectionAudit: "变化记录",
  maximumFocusShift: "最大焦点位移",
  maximumAreaShift: "最大形状位移",
  maximumRotationShift: "最大旋转变化",
  objective: "精修目标",
  observations: "判断依据",
  uncertainties: "待确认事项",
  preserve: "保留关系",
  tradeoffs: "取舍",
  relations: "关系验证",
  retained: "保留原构图",
  target: "目标值",
  before: "原图测量",
  after: "精修测量",
  error: "达成偏差",
  unmeasurable: "不适用",
  framePlacement: "分割线定位",
  sizeRatio: "尺寸比例",
  mirrorSymmetry: "轴对称",
  focusFlow: "焦点引导",
  focusAnchor: "焦点定位",
  axisRelation: "轴线关系",
  rotationAlignment: "方向对齐",
  blockAlignment: "区域对齐",
  spacingRhythm: "等距排列",

};

export function CompositionWorkflowView(props: CompositionWorkflowLayoutProps): ReactNode;
export function CompositionWorkflowView(props: CompositionWorkflowCanvasProps): ReactNode;
export function CompositionWorkflowView(props: CompositionWorkflowViewProps) {
  return "children" in props
    ? <CompositionWorkflowLayout {...props} />
    : <CompositionWorkflowCanvasView {...props} />;
}

function CompositionWorkflowLayout({
  stateControls,
  children,
  className,
  style,
  workflowStatus,
  activeView,
  "data-active-stage": activeStage,
}: CompositionWorkflowLayoutProps & {
  workflowStatus?: CompositionWorkflowStatus;
  activeView?: CompositionWorkflowViewKey;
}) {
  return (
    <section
      {...uiAssetAttributes({
        namespace: "human2ai",
        id: "composition-workflow-view",
        name: "CompositionWorkflowView",
        category: "module",
        origin: "project",
        status: "candidate",
      })}
      className={["human2ai-composition-workflow", className].filter(Boolean).join(" ")}
      style={style}
      data-workflow-status={workflowStatus}
      data-active-view={activeView}
      data-active-stage={activeStage}
    >
      <div className="human2ai-composition-workflow__toolbar">{stateControls}</div>
      <div className="human2ai-composition-workflow__stage">{children}</div>
    </section>
  );
}

function CompositionWorkflowCanvasView({
  stateControls,
  interactionResetKey,
  selectedPlanIds,
  planningLocked = false,
  onPlanSelectionChange,
  planningLabels,
  draft,
  status,
  refinement = null,
  activeView,
  onViewChange,
  selectedIds = [],
  onDraftChange,
  placementTool,
  onPlacementToolChange,
  onSelectionChange,
  onItemDoubleClick,
  showPlanning = true,
  frameLocked = false,
  canvasZoom,
  canvasViewportAction,
  onCanvasZoomChange,
  canvasBackgroundPattern,
  showCanvasViewportControls,
  canvasSideActions,
  canvasSideActionPlacement,
  canvasSideActionPanelWidth,
  canvasSideActionPanelDefaultCollapsed,
  canvasViewportLabels,
  canvasLayerLabels,
  nodeEditorLabels,
  directionControlLabels,
  areaEditorLabels,
  imageEditorLabels,
  resolveImageSource,
  renderCameraReference,
  onImageUpload,
  onReadImageFile,
  labels: labelOverrides,
  className,
  style,
}: CompositionWorkflowCanvasProps) {
  const labels = { ...DEFAULT_LABELS, ...labelOverrides };
  const resultMatchesDraft =
    refinement?.audit.passed === true &&
    refinement.plan.sourceFingerprint === refinement.sourceFingerprint &&
    refinement.sourceFingerprint === draftFingerprint(draft);
  const effectiveStatus = status === "ready" && !resultMatchesDraft ? "stale" : status;
  const resultAvailable = effectiveStatus === "ready" && resultMatchesDraft;
  const resolvedView = activeView === "refined" && !resultAvailable ? "draft" : activeView;
  const referenceDraft = resultAvailable && refinement ? refinement.refinedDraft : draft;
  const items: TabSwitchItems = [
    { key: "draft", label: labels.draftView, mode: "text-only" },
    {
      key: "refined",
      label: labels.refinedView,
      mode: "text-only",
      disabled: !resultAvailable,
    },
    {
      key: "reference",
      label: labels.referenceView,
      mode: "text-only",
    },
  ];

  return (
    <CompositionWorkflowLayout
      className={className}
      style={style}
      workflowStatus={effectiveStatus}
      activeView={resolvedView}
      stateControls={stateControls ?? <TabSwitch
          items={items}
          value={resolvedView}
          aria-label={labels.viewSwitch}
          onChange={(key) => onViewChange(key as CompositionWorkflowViewKey)}
        />}
    >
        {resolvedView === "draft" ? (
          <CompositionCanvas
            key={draft.activeStateId}
            interactionResetKey={interactionResetKey}
            selectedPlanIds={selectedPlanIds}
            planningLocked={planningLocked}
            onPlanSelectionChange={onPlanSelectionChange}
            planningLabels={planningLabels}
            draft={draft}
            showPlanning={showPlanning}
            frameLocked={frameLocked}
            zoom={canvasZoom}
            viewportAction={canvasViewportAction}
            backgroundPattern={canvasBackgroundPattern}
            showViewportControls={showCanvasViewportControls}
            sideActions={canvasSideActions}
            sideActionPlacement={canvasSideActionPlacement}
            sideActionPanelWidth={canvasSideActionPanelWidth}
            sideActionPanelDefaultCollapsed={canvasSideActionPanelDefaultCollapsed}
            viewportLabels={canvasViewportLabels}
            layerLabels={canvasLayerLabels}
            nodeEditorLabels={nodeEditorLabels}
            directionControlLabels={directionControlLabels}
            areaEditorLabels={areaEditorLabels}
            imageEditorLabels={imageEditorLabels}
            renderCameraReference={renderCameraReference}
            resolveImageSource={resolveImageSource}
            onImageUpload={onImageUpload}
            onReadImageFile={onReadImageFile}
            selectedIds={selectedIds}
            onDraftChange={onDraftChange}
            placementTool={placementTool}
            onPlacementToolChange={onPlacementToolChange}
            onSelectionChange={onSelectionChange}
            onItemDoubleClick={onItemDoubleClick}
            onZoomChange={onCanvasZoomChange}
            aria-label={labels.draftCanvas}
          />
        ) : null}

        {resolvedView === "refined" && refinement ? (
          <>
            <CompositionCanvas
              draft={refinement.refinedDraft}
              showPlanning={showPlanning}
              zoom={canvasZoom}
              viewportAction={canvasViewportAction}
              backgroundPattern={canvasBackgroundPattern}
              showViewportControls={showCanvasViewportControls}
              viewportLabels={canvasViewportLabels}
              layerLabels={canvasLayerLabels}
              nodeEditorLabels={nodeEditorLabels}
              resolveImageSource={resolveImageSource}
              onZoomChange={onCanvasZoomChange}
              aria-label={labels.refinedCanvas}
            />
            <RefinementSummary refinement={refinement} labels={labels} />
          </>
        ) : null}

        {resolvedView === "reference" ? (
          <CompositionCanvas
            draft={referenceDraft}
            appearance="reference"
            layerLabels={canvasLayerLabels}
            nodeEditorLabels={nodeEditorLabels}
            resolveImageSource={resolveImageSource}
            aria-label={labels.referenceCanvas}
          />
        ) : null}
    </CompositionWorkflowLayout>
  );
}

function RefinementSummary({
  refinement,
  labels,
}: {
  refinement: CompositionRefinementResult;
  labels: CompositionWorkflowLabels;
}) {
  const changes = refinement.audit.changes;
  if (refinement.plan.version === 2) {
    const plan = refinement.plan;
    const methods = {
      "focus-anchor": labels.focusAnchor, "axis-relation": labels.axisRelation,
      "rotation-alignment": labels.rotationAlignment, "block-alignment": labels.blockAlignment,
      "spacing-rhythm": labels.spacingRhythm, "frame-placement": labels.framePlacement,
      "size-ratio": labels.sizeRatio, "mirror-symmetry": labels.mirrorSymmetry, "focus-flow": labels.focusFlow,
    };
    const sections = [
      [labels.observations, plan.assessment.observations], [labels.uncertainties, plan.assessment.uncertainties],
      [labels.preserve, plan.preserve], [labels.tradeoffs, plan.tradeoffs],
    ] as const;
    return (
      <div className="human2ai-composition-workflow__summary human2ai-composition-workflow__summary--directed">
        <section>
          <h3>{labels.objective}</h3>
          <p>{plan.objective}</p>
          <p>{plan.assessment.intent}</p>
          <p>{plan.rationale}</p>
          {plan.decision === "retain" ? <strong>{labels.retained}</strong> : null}
          {sections.filter(([, items]) => items.length).map(([heading, items]) => (
            <div className="human2ai-composition-workflow__explanation" key={heading}>
              <h3>{heading}</h3>
              <ul>{items.map((item, index) => <li key={index}>{item}</li>)}</ul>
            </div>
          ))}
        </section>
        {plan.operations.length > 0 ? (
          <section>
            <h3>{labels.relations}</h3>
            <ol className="human2ai-composition-workflow__relations">
              {plan.operations.map((operation, index) => {
                const check = refinement.audit.relations?.find((item) => item.operationIndex === index);
                return (
                  <li key={index} data-relation-passed={check?.passed}>
                    <strong>{methods[operation.method]}</strong>
                    <p>{operation.reason}</p>
                    <p>{operation.expectedEffect}</p>
                    {check ? (
                      <dl>
                        {[[labels.target, check.target], [labels.before, check.before],
                          [labels.after, check.after], [labels.error, check.error]].map(([label, value]) => (
                          <div key={String(label)}><dt>{label}</dt>
                            <dd>{formatRelationValue(value as number | null, check.unit, labels.unmeasurable)}</dd></div>
                        ))}
                      </dl>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          </section>
        ) : null}
      </div>
    );
  }
  return (
    <div className="human2ai-composition-workflow__summary">
      <section>
        <h3>{labels.agentDecision}</h3>
        <p>{refinement.plan.rationale}</p>
      </section>
      <section>
        <h3>{labels.appliedMethods}</h3>
        <ul>
          {refinement.appliedOperations.map((operation, index) => (
            <li key={`${operation.method}-${index}`}>
              <code>{`${operation.method}@${operation.methodVersion}`}</code>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h3>{labels.protectionAudit}</h3>
        <dl>
          <div>
            <dt>{labels.maximumFocusShift}</dt>
            <dd>{formatPercent(changes.maximumFocusShift)}</dd>
          </div>
          <div>
            <dt>{labels.maximumAreaShift}</dt>
            <dd>{formatPercent(changes.maximumAreaShift)}</dd>
          </div>
          <div>
            <dt>{labels.maximumRotationShift}</dt>
            <dd>{changes.maximumRotationShift.toFixed(1)}°</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatRelationValue(value: number | null, unit: RefinementRelationCheck["unit"], unavailable: string) {
  if (value === null) return unavailable;
  if (unit === "frame-fraction") return `${Number((value * 100).toFixed(3))}%`;
  const formatted = Number(value.toFixed(4)).toString();
  return unit === "degrees" ? `${formatted}°` : unit === "pixels" ? `${formatted} px` : formatted;
}
