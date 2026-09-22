"use client";

import { DeleteOutlined, EyeInvisibleOutlined, EyeOutlined, LockOutlined, PlusOutlined, QuestionCircleOutlined, UnlockOutlined } from "@ant-design/icons";
import { Dropdown, InputNumber, Select, Switch, Tooltip } from "antd";
import { BasicButton } from "@human2ai/ui/yisiui/basic-button";
import type zh from "../../../../../locales/zh-CN/common.json";
import {
  COMPOSITION_PLAN_TYPES, addCompositionPlan, removeCompositionPlan, replaceCompositionPlan,
  setCompositionRadialMode, setCompositionRadialRayCount,
  type CompositionDraft, type CompositionPlan,
} from "../../../../../src/domain/composition";
import { uiAssetAttributes } from "../vendor/yisiui/runtime/src/assetMarker";
import "./CompositionPlanning.css";

export type CompositionPlanningLabels = typeof zh.composition.planning;

export interface CompositionPlanningPanelProps {
  draft: CompositionDraft;
  selectedIds: readonly string[];
  onSelect: (ids: string[]) => void;
  locked?: boolean;
  onLockedChange?: (locked: boolean) => void;
  showPlanning?: boolean;
  onShowPlanningChange?: (visible: boolean) => void;
  onDraftChange: (draft: CompositionDraft) => void;
  labels: CompositionPlanningLabels;
  deleteLabel: string;
  disabled?: boolean;
}

export function CompositionPlanningPanel({ draft, selectedIds, onSelect, locked = false, onLockedChange, showPlanning = true, onShowPlanningChange, onDraftChange, labels, deleteLabel, disabled: externallyDisabled = false }: CompositionPlanningPanelProps) {
  const plans = draft.plans ?? [];
  const disabled = externallyDisabled || locked;
  const selected = selectedIds.length === 1 ? plans.find((plan) => plan.id === selectedIds[0]) : undefined;
  const help = selected?.type === "symmetry" ? labels.symmetryHelp : selected?.type === "golden-spiral" ? labels.spiralHelp : selected?.type === "radial" ? labels.radialHelp : labels.help;
  const update = (plan: CompositionPlan) => { if (!disabled) onDraftChange(replaceCompositionPlan(draft, plan)); };
  const number = (label: string, value: number, change: (value: number) => void, min?: number, max?: number, precision?: number) => (
    <label className="human2ai-composition-planning__field">
      <span>{label}</span>
      <InputNumber aria-label={label} value={Math.round(value * 100) / 100} min={min} max={max} precision={precision} step={1} controls={false}
        disabled={disabled} onChange={(value) => {
          if (value !== null && Number.isFinite(value) && (min === undefined || value >= min)
            && (max === undefined || value <= max) && (precision !== 0 || Number.isInteger(value))) change(value);
        }} />
    </label>
  );
  return (
    <section {...uiAssetAttributes({ namespace: "human2ai", id: "composition-planning-panel", name: "CompositionPlanningPanel", category: "module", origin: "project", status: "candidate" })} className="human2ai-composition-planning" aria-label={labels.title}>
      <div className="human2ai-composition-planning__heading">
        <h2>{labels.title}</h2>
        <Tooltip title={help}><BasicButton mode="icon-only" size="small" icon={<QuestionCircleOutlined />} iconLabel={help} /></Tooltip>
        <Dropdown trigger={["click"]} disabled={disabled} menu={{
          items: COMPOSITION_PLAN_TYPES.map((type) => ({ key: type, label: labels.types[type] })),
          onClick: ({ key }) => {
            if (disabled) return;
            const added = addCompositionPlan(draft, key as CompositionPlan["type"]);
            onDraftChange(added.draft);
            onSelect([added.id]);
          },
        }}>
          <BasicButton mode="icon-only" size="small" icon={<PlusOutlined />} iconLabel={labels.add} disabled={disabled} />
        </Dropdown>
        <Tooltip title={showPlanning ? labels.hideAll : labels.showAll}>
          <BasicButton mode="icon-only" size="small" icon={showPlanning ? <EyeOutlined /> : <EyeInvisibleOutlined />}
            iconLabel={showPlanning ? labels.hideAll : labels.showAll} aria-pressed={showPlanning}
            disabled={externallyDisabled || !onShowPlanningChange} onClick={() => onShowPlanningChange?.(!showPlanning)} />
        </Tooltip>
        <Tooltip title={locked ? labels.unlock : labels.lock}>
          <BasicButton mode="icon-only" size="small" icon={locked ? <LockOutlined /> : <UnlockOutlined />}
            iconLabel={locked ? labels.unlock : labels.lock} aria-pressed={locked}
            disabled={externallyDisabled || !onLockedChange} onClick={() => onLockedChange?.(!locked)} />
        </Tooltip>
      </div>
      {plans.length === 0 ? <p className="human2ai-composition-planning__empty">{labels.empty}</p> : (
        <div className="human2ai-composition-planning__list">
          {plans.map((plan, index) => (
            <div className="human2ai-composition-planning__row" key={plan.id} data-plan-row={plan.id}>
              <BasicButton type="text" size="small" aria-pressed={selectedIds.includes(plan.id)} disabled={disabled}
                className="human2ai-composition-planning__select" onClick={(event) => onSelect(event.shiftKey || event.ctrlKey || event.metaKey
                  ? selectedIds.includes(plan.id) ? selectedIds.filter((id) => id !== plan.id) : [...selectedIds, plan.id]
                  : [plan.id])}>
                {labels.types[plan.type]} {index + 1}
              </BasicButton>
              <Tooltip title={labels.visible}><Switch size="small" checked={plan.visible} aria-label={labels.visible} disabled={disabled}
                onChange={(visible) => update({ ...plan, visible })} /></Tooltip>
              <BasicButton mode="icon-only" size="small" type="text" icon={<DeleteOutlined />} iconLabel={deleteLabel} disabled={disabled}
                onClick={() => { if (disabled) return; onDraftChange(removeCompositionPlan(draft, plan.id)); onSelect(selectedIds.filter((id) => id !== plan.id)); }} />
            </div>
          ))}
        </div>
      )}
      {selected ? (
        <div className="human2ai-composition-planning__properties" data-plan-properties={selected.id}>
          {selected.type === "thirds" || selected.type === "golden-section" ? (
            <label className="human2ai-composition-planning__field"><span>{labels.axes}</span>
              <Select aria-label={labels.axes} value={selected.axes} disabled={disabled}
                options={(["both", "horizontal", "vertical"] as const).map((value) => ({ value, label: labels[value] }))}
                onChange={(axes) => update({ ...selected, axes })} />
            </label>
          ) : null}
          {selected.type === "radial" ? (
            <label className="human2ai-composition-planning__field"><span>{labels.radialMode}</span>
              <Select aria-label={labels.radialMode} value={selected.mode} disabled={disabled}
                options={[{ value: "uniform", label: labels.radialUniform }, { value: "free", label: labels.radialFree }]}
                onChange={(mode) => update(setCompositionRadialMode(selected, mode))} />
            </label>
          ) : null}
          {selected.type === "golden-spiral" || selected.type === "triangle" || selected.type === "radial" ? (
            <div className="human2ai-composition-planning__coordinates">
              {number(labels.x, selected.x * 100, (x) => update({ ...selected, x: x / 100 }))}
              {number(labels.y, selected.y * 100, (y) => update({ ...selected, y: y / 100 }))}
              {selected.type !== "radial" || selected.mode === "uniform"
                ? number(labels.rotation, selected.rotation, (rotation) => update({ ...selected, rotation })) : null}
              {selected.type === "golden-spiral" ? number(labels.scale, selected.scale * 100, (scale) => update({ ...selected, scale: scale / 100 }), 1) : null}
              {selected.type === "triangle" ? <>
                {number(labels.width, selected.width * 100, (width) => update({ ...selected, width: width / 100 }), 1)}
                {number(labels.height, selected.height * 100, (height) => update({ ...selected, height: height / 100 }), 1)}
              </> : null}
              {selected.type === "radial" ? <>
                {number(labels.rayCount, selected.mode === "free" ? selected.angles.length : selected.rayCount,
                  (rayCount) => update(setCompositionRadialRayCount(selected, rayCount)), 2, 36, 0)}
                {selected.mode === "uniform" ? number(labels.spread, selected.spread, (spread) => update({ ...selected, spread }), 1, 360) : null}
              </> : null}
            </div>
          ) : null}
          {selected.type === "golden-spiral" ? (
            <label className="human2ai-composition-planning__toggle"><span>{labels.mirrored}</span>
              <Switch size="small" aria-label={labels.mirrored} checked={selected.mirrored} disabled={disabled}
                onChange={(mirrored) => update({ ...selected, mirrored })} />
            </label>
          ) : null}
          {selected.type === "triangle" ? <p className="human2ai-composition-planning__help">{labels.triangleHelp}</p> : null}
        </div>
      ) : null}
    </section>
  );
}
