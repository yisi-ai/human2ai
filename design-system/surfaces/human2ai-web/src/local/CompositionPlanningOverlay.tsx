"use client";

import { useId, useRef, type PointerEvent } from "react";
import {
  compositionPlanGeometry, compositionSymmetryRotations, frameBoundsInCanvas, replaceCompositionPlan, removeCompositionPlan, moveCompositionPlans, transformCompositionPlan,
  type CompositionDraft, type CompositionPlan, type Point,
} from "../../../../../src/domain/composition";
import { CanvasNode, type CanvasNodeSelectEvent } from "./CanvasNode";
import type { CompositionPlanningLabels } from "./CompositionPlanningPanel";
import "./CompositionPlanning.css";

interface Props {
  draft: CompositionDraft;
  selectedIds?: readonly string[];
  onSelect?: (ids: string[]) => void;
  locked?: boolean;
  onDraftChange?: (draft: CompositionDraft) => void;
  screenScale: number;
  labels: CompositionPlanningLabels;
}

export function CompositionPlanningOverlay({ draft, selectedIds = [], onSelect, locked = false, onDraftChange, screenScale, labels }: Props) {
  const clipId = useId();
  const frame = frameBoundsInCanvas(draft.frame);
  const interaction = useRef<{ pointerId: number; plan: CompositionPlan; draft: CompositionDraft; ids: string[]; start: Point; handle?: number; moved: boolean } | null>(null);
  const selectionClick = useRef<string | null>(null);
  const editable = Boolean(onSelect && onDraftChange && !locked);
  const position = (event: PointerEvent<SVGGElement>): Point => {
    const matrix = event.currentTarget.ownerSVGElement!.getScreenCTM()!;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    return { x: point.x, y: point.y };
  };
  function changed(plan: CompositionPlan, delta: Point, handle?: number): CompositionPlan {
    return transformCompositionPlan(plan, draft.frame, delta, handle);
  }
  function select(id: string, additive: boolean): string[] {
    const ids = additive ? selectedIds.includes(id) ? selectedIds.filter((selected) => selected !== id) : [...selectedIds, id]
      : selectedIds.includes(id) ? [...selectedIds] : [id];
    onSelect?.(ids);
    return ids;
  }
  function selectFromEvent(id: string, event: CanvasNodeSelectEvent) {
    if (event.type === "click" && selectionClick.current === id) { selectionClick.current = null; return; }
    if ("key" in event && event.key !== "Enter" && event.key !== " ") return;
    select(id, event.shiftKey || event.ctrlKey || event.metaKey);
  }
  function remove(id: string) {
    onDraftChange?.(removeCompositionPlan(draft, id));
    onSelect?.(selectedIds.filter((selected) => selected !== id));
  }
  function start(event: PointerEvent<SVGGElement>, plan: CompositionPlan, handle?: number) {
    if (!editable || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.focus();
    selectionClick.current = plan.id;
    const ids = handle === undefined ? select(plan.id, event.shiftKey || event.ctrlKey || event.metaKey) : [plan.id];
    if (!ids.includes(plan.id)) return;
    if (ids.length === 1 && plan.type === "symmetry" && handle !== 1) return;
    interaction.current = { pointerId: event.pointerId, plan, draft, ids, start: position(event), handle, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function move(event: PointerEvent<SVGGElement>) {
    const source = interaction.current;
    if (!editable || !source || source.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    const point = position(event);
    const delta = { x: point.x - source.start.x, y: point.y - source.start.y };
    if (!source.moved && source.plan.type === "golden-spiral" && source.handle === 0 && Math.hypot(delta.x, delta.y) * screenScale < 4) return;
    source.moved = true;
    onDraftChange?.(source.handle === undefined ? moveCompositionPlans(source.draft, source.ids, delta)
      : replaceCompositionPlan(source.draft, changed(source.plan, delta, source.handle)));
  }
  function finish(event: PointerEvent<SVGGElement>) {
    const source = interaction.current;
    if (!editable || !source || source.pointerId !== event.pointerId) return;
    interaction.current = null;
    event.stopPropagation();
    if (event.type === "pointerup" && !source.moved && source.handle === 0 && source.plan.type === "golden-spiral") {
      onDraftChange?.(replaceCompositionPlan(source.draft, { ...source.plan, mirrored: !source.plan.mirrored }));
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }
  const pointerEvents = { onPointerMove: move, onPointerUp: finish, onPointerCancel: finish,
    onLostPointerCapture: () => { interaction.current = null; } };
  return (
    <g className="human2ai-composition-plans">
      <defs><clipPath id={clipId}><rect x={frame.x} y={frame.y} width={frame.width} height={frame.height} /></clipPath></defs>
      {(draft.plans ?? []).filter((plan) => plan.visible).map((plan) => {
        const { paths, handles, snapPoints } = compositionPlanGeometry(plan, draft.frame);
        const selected = !locked && selectedIds.includes(plan.id);
        const interactive = editable && plan.type !== "thirds" && plan.type !== "golden-section";
        return (
          <g key={plan.id}>
          <CanvasNode id={plan.id} label={labels.types[plan.type]} selected={selected} locked={!interactive}
            className="human2ai-composition-plan" data-composition-plan={plan.id} data-plan-type={plan.type}
            onSelect={interactive ? selectFromEvent : undefined}
            onNudge={interactive ? (delta) => onDraftChange?.(moveCompositionPlans(draft, selected ? selectedIds : [plan.id], delta)) : undefined}
            onDelete={interactive ? () => remove(plan.id) : undefined}
            onPointerDown={interactive ? (event) => start(event, plan) : undefined} {...pointerEvents}>
            <g clipPath={`url(#${clipId})`}>
              {paths.map((points, index) => <g key={index}>
                <polyline className="human2ai-composition-plan__line" points={points.map((p) => `${p.x},${p.y}`).join(" ")} />
                {interactive ? <polyline className="human2ai-composition-plan__hit" points={points.map((p) => `${p.x},${p.y}`).join(" ")} /> : null}
              </g>)}
            </g>
          </CanvasNode>
            {selected && selectedIds.length === 1 && interactive && snapPoints ? <g aria-hidden="true" pointerEvents="none">
              {snapPoints.map((point, index) => <circle key={index} className="human2ai-composition-plan__snap"
                cx={point.x} cy={point.y} r={3 / screenScale} />)}
            </g> : null}
            {selected && selectedIds.length === 1 && interactive ? handles.map((point, index) => plan.type === "symmetry" && index === 0 ? (
              <circle key={index} className="human2ai-composition-plan__fixed" cx={point.x} cy={point.y}
                r={5 / screenScale} aria-hidden="true" pointerEvents="none" />
            ) : (
              <g key={index} data-plan-handle={index} transform={`translate(${point.x} ${point.y})`} tabIndex={0} role="button"
                data-plan-action={plan.type === "golden-spiral" && index === 0 ? "toggle-winding" : undefined}
                aria-label={plan.type === "golden-spiral" && index === 0 ? labels.spiralDirection
                  : plan.type === "radial" && plan.mode === "free" && index > 0 ? labels.rayHandle.replace("{{index}}", String(index))
                  : labels.handle.replace("{{index}}", String(index + 1))}
                aria-pressed={plan.type === "golden-spiral" && index === 0 ? plan.mirrored : undefined}
                onPointerDown={(event) => start(event, plan, index)} {...pointerEvents}
                onClick={(event) => { event.stopPropagation(); event.currentTarget.focus(); }}
                onKeyDown={(event) => {
                  if (plan.type === "golden-spiral" && index === 0 && (event.key === "Enter" || event.key === " ")) {
                    event.preventDefault(); event.stopPropagation();
                    if (!event.repeat) onDraftChange?.(replaceCompositionPlan(draft, { ...plan, mirrored: !plan.mirrored }));
                    return;
                  }
                  if (event.key === "Delete" || event.key === "Backspace") {
                    event.preventDefault(); event.stopPropagation();
                    remove(plan.id);
                    return;
                  }
                  const step = event.shiftKey ? 10 : 1;
                  const deltas: Record<string, Point> = { ArrowLeft: { x: -step, y: 0 }, ArrowRight: { x: step, y: 0 }, ArrowUp: { x: 0, y: -step }, ArrowDown: { x: 0, y: step } };
                  if (!deltas[event.key]) return;
                  event.preventDefault(); event.stopPropagation();
                  let next = changed(plan, deltas[event.key], index);
                  if (plan.type === "symmetry") {
                    const rotations = compositionSymmetryRotations(draft.frame);
                    const current = rotations.findIndex((rotation) => Math.abs(rotation - plan.rotation) < 1e-8);
                    const direction = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1;
                    next = { ...plan, rotation: rotations[(current + direction + rotations.length) % rotations.length] };
                  }
                  onDraftChange?.(replaceCompositionPlan(draft, next));
                }}>
                {plan.type === "golden-spiral" && index === 0 ? <title>{labels.spiralDirection}</title> : null}
                <circle className="human2ai-composition-plan__handle" r={5 / screenScale} />
                <circle className="human2ai-composition-plan__handle-hit" r={12 / screenScale} />
              </g>
            )) : null}
          </g>
        );
      })}
    </g>
  );
}
