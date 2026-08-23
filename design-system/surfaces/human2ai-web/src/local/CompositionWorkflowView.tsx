"use client";

import { StatusBadge, type StatusTone } from "@human2ai/ui/yisiui/status-badge";
import { TabSwitch, type TabSwitchItems } from "@human2ai/ui/yisiui/tab-switch";
import type { CSSProperties } from "react";

import {
  draftFingerprint,
  type CompositionDraft,
  type CompositionRefinementResult,
  type CompositionWorkflowStatus,
} from "../../../../../src/domain/composition";
import { uiAssetAttributes } from "../vendor/yisiui/runtime/src/assetMarker";
import { CompositionCanvas } from "./CompositionCanvas";

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
  waitingStatus: string;
  processingStatus: string;
  readyStatus: string;
  staleStatus: string;
  errorStatus: string;
  waitingMessage: string;
  processingMessage: string;
  staleMessage: string;
  errorMessage: string;
  draftReadyMessage: string;
  agentDecision: string;
  appliedMethods: string;
  protectionAudit: string;
  maximumFocusShift: string;
  maximumAreaShift: string;
  maximumRotationShift: string;
  referenceHint: string;
}

export interface CompositionWorkflowViewProps {
  draft: CompositionDraft;
  status: CompositionWorkflowStatus;
  refinement?: CompositionRefinementResult | null;
  activeView: CompositionWorkflowViewKey;
  onViewChange: (view: CompositionWorkflowViewKey) => void;
  selectedId?: string | null;
  onDraftChange?: (draft: CompositionDraft) => void;
  onSelectionChange?: (id: string | null) => void;
  errorMessage?: string | null;
  labels?: Partial<CompositionWorkflowLabels>;
  className?: string;
  style?: CSSProperties;
}

const DEFAULT_LABELS: CompositionWorkflowLabels = {
  draftView: "用户草图",
  refinedView: "Agent 加工图",
  referenceView: "生图参考",
  viewSwitch: "构图视图",
  draftCanvas: "用户构图草图",
  refinedCanvas: "Agent 加工后的构图",
  referenceCanvas: "用于生图的结构参考",
  waitingStatus: "等待 Agent",
  processingStatus: "Agent 加工中",
  readyStatus: "加工已通过",
  staleStatus: "加工已过期",
  errorStatus: "加工失败",
  waitingMessage: "草图已就绪，等待 Agent 查看草图并提交美学加工方案。",
  processingMessage: "Agent 正在判断适用的构图美学；页面不会自行选择加工方法。",
  staleMessage: "草图已修改，旧加工结果不再适用于当前草图，请让 Agent 重新判断。",
  errorMessage: "加工结果不可用，请检查 Agent 输出和防偏移审计。",
  draftReadyMessage: "Agent 加工已经通过防偏移审计，可切换查看结果与生图参考。",
  agentDecision: "Agent 判断",
  appliedMethods: "执行方法",
  protectionAudit: "防偏移审计",
  maximumFocusShift: "最大焦点位移",
  maximumAreaShift: "最大形状位移",
  maximumRotationShift: "最大旋转变化",
  referenceHint: "该视图弱化样式信息，仅保留画框、形状、焦点与方向关系，供生图阶段参考。",
};

const STATUS_TONES: Record<CompositionWorkflowStatus, StatusTone> = {
  waiting: "default",
  processing: "processing",
  ready: "success",
  stale: "warning",
  error: "danger",
};

export function CompositionWorkflowView({
  draft,
  status,
  refinement = null,
  activeView,
  onViewChange,
  selectedId = null,
  onDraftChange,
  onSelectionChange,
  errorMessage,
  labels: labelOverrides,
  className,
  style,
}: CompositionWorkflowViewProps) {
  const labels = { ...DEFAULT_LABELS, ...labelOverrides };
  const resultMatchesDraft =
    refinement?.audit.passed === true &&
    refinement.plan.sourceFingerprint === refinement.sourceFingerprint &&
    refinement.sourceFingerprint === draftFingerprint(draft);
  const effectiveStatus = status === "ready" && !resultMatchesDraft ? "stale" : status;
  const resultAvailable = effectiveStatus === "ready" && resultMatchesDraft;
  const resolvedView = resultAvailable ? activeView : "draft";
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
      disabled: !resultAvailable,
    },
  ];

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
      data-workflow-status={effectiveStatus}
      data-active-view={resolvedView}
    >
      <div className="human2ai-composition-workflow__toolbar">
        <TabSwitch
          items={items}
          value={resolvedView}
          aria-label={labels.viewSwitch}
          onChange={(key) => onViewChange(key as CompositionWorkflowViewKey)}
        />
        <div aria-live="polite">
          <StatusBadge
            label={statusLabel(effectiveStatus, labels)}
            tone={STATUS_TONES[effectiveStatus]}
          />
        </div>
      </div>

      <WorkflowNotice
        status={effectiveStatus}
        errorMessage={errorMessage}
        labels={labels}
      />

      {resolvedView === "draft" ? (
        <CompositionCanvas
          draft={draft}
          selectedId={selectedId}
          onDraftChange={onDraftChange}
          onSelectionChange={onSelectionChange}
          aria-label={labels.draftCanvas}
        />
      ) : null}

      {resolvedView === "refined" && refinement ? (
        <>
          <CompositionCanvas draft={refinement.refinedDraft} aria-label={labels.refinedCanvas} />
          <RefinementSummary refinement={refinement} labels={labels} />
        </>
      ) : null}

      {resolvedView === "reference" && refinement ? (
        <>
          <CompositionCanvas
            draft={refinement.refinedDraft}
            appearance="reference"
            aria-label={labels.referenceCanvas}
          />
          <p className="human2ai-composition-workflow__reference-hint">
            {labels.referenceHint}
          </p>
        </>
      ) : null}
    </section>
  );
}

function WorkflowNotice({
  status,
  errorMessage,
  labels,
}: {
  status: CompositionWorkflowStatus;
  errorMessage?: string | null;
  labels: CompositionWorkflowLabels;
}) {
  const message =
    status === "waiting"
      ? labels.waitingMessage
      : status === "processing"
        ? labels.processingMessage
        : status === "stale"
          ? labels.staleMessage
          : status === "error"
            ? errorMessage || labels.errorMessage
            : labels.draftReadyMessage;

  return (
    <p
      className={`human2ai-composition-workflow__notice human2ai-composition-workflow__notice--${status}`}
      role={status === "error" ? "alert" : "status"}
    >
      {message}
    </p>
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

function statusLabel(
  status: CompositionWorkflowStatus,
  labels: CompositionWorkflowLabels,
): string {
  return labels[`${status}Status`];
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}
