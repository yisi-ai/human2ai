"use client";

import { useRef } from "react";
import type {
  CSSProperties,
  KeyboardEvent,
  MouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from "react";

import {
  areaGeometry,
  directionLineGeometry,
  moveItem,
  resizeArea,
  resizeFreeArea,
  rotateArea,
  rotateDirectionLine,
  type CompositionArea,
  type CompositionDraft,
  type DirectionLine,
  type Point,
} from "../../../../../src/domain/composition";
import { uiAssetAttributes } from "../vendor/yisiui/runtime/src/assetMarker";

import "./CompositionCanvas.css";

export interface CompositionCanvasProps {
  draft: CompositionDraft;
  appearance?: "editor" | "reference";
  selectedId?: string | null;
  onDraftChange?: (draft: CompositionDraft) => void;
  onSelectionChange?: (id: string | null) => void;
  className?: string;
  style?: CSSProperties;
  "aria-label"?: string;
}

interface SelectableItemProps {
  id: string;
  label: string;
  selected: boolean;
  onSelect?: (id: string) => void;
  onNudge?: (id: string, delta: Point) => void;
  className?: string;
  children: ReactNode;
}

interface AreaPointerInteraction {
  pointerId: number;
  id: string;
  sourceDraft: CompositionDraft;
  item: CompositionArea;
  startDistance: number;
  startAngle: number;
}

type PointerInteraction =
  | {
      type: "move";
      pointerId: number;
      id: string;
      sourceDraft: CompositionDraft;
      offset: Point;
    }
  | (AreaPointerInteraction & { type: "scale" })
  | (AreaPointerInteraction & { type: "resize-free" })
  | (AreaPointerInteraction & { type: "rotate" })
  | {
      type: "rotate-direction";
      pointerId: number;
      id: string;
      sourceDraft: CompositionDraft;
      item: DirectionLine;
      startAngle: number;
    };

const AREA_LABELS: Record<CompositionArea["primitive"], string> = {
  circle: "圆形",
  triangle: "三角形",
  quadrilateral: "四边形",
};

export function CompositionCanvas({
  draft,
  appearance = "editor",
  selectedId = null,
  onDraftChange,
  onSelectionChange,
  className,
  style,
  "aria-label": ariaLabel = "构图画布",
}: CompositionCanvasProps) {
  const classes = [
    "human2ai-composition-canvas",
    `human2ai-composition-canvas--${appearance}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");
  const interactionRef = useRef<PointerInteraction | null>(null);
  const suppressClickRef = useRef(false);
  const selectedArea = draft.areas.find((area) => area.id === selectedId);

  function nudgeItem(id: string, delta: Point): void {
    if (!onDraftChange) return;
    const item = findItem(draft, id);
    if (!item) return;
    onDraftChange(moveItem(draft, id, { x: item.x + delta.x, y: item.y + delta.y }));
  }

  function handlePointerDown(event: ReactPointerEvent<SVGSVGElement>): void {
    if (!onDraftChange || !(event.target instanceof Element)) return;
    suppressClickRef.current = false;
    const point = canvasPoint(event, event.currentTarget);
    const handle = event.target.closest<SVGElement>("[data-handle]");

    if (handle) {
      const id = handle.dataset.itemId;
      const type = handle.dataset.handle;
      if (!id || !type) return;
      const area = draft.areas.find((item) => item.id === id);
      const direction = draft.directionLine?.id === id ? draft.directionLine : null;

      if (area && (type === "scale" || type === "resize-free" || type === "rotate")) {
        const center = itemCenter(area, draft);
        interactionRef.current = {
          type,
          pointerId: event.pointerId,
          id,
          sourceDraft: draft,
          item: structuredClone(area),
          startDistance: Math.max(1, distance(point, center)),
          startAngle: Math.atan2(point.y - center.y, point.x - center.x),
        };
      } else if (direction && type === "rotate-direction") {
        const center = itemCenter(direction, draft);
        interactionRef.current = {
          type,
          pointerId: event.pointerId,
          id,
          sourceDraft: draft,
          item: structuredClone(direction),
          startAngle: Math.atan2(point.y - center.y, point.x - center.x),
        };
      } else {
        return;
      }
    } else {
      const itemElement = event.target.closest<SVGGElement>("[data-composition-item]");
      const id = itemElement?.dataset.compositionItem;
      const item = id ? findItem(draft, id) : null;
      if (!id || !item) return;
      interactionRef.current = {
        type: "move",
        pointerId: event.pointerId,
        id,
        sourceDraft: draft,
        offset: {
          x: point.x / draft.frame.width - item.x,
          y: point.y / draft.frame.height - item.y,
        },
      };
    }

    const interaction = interactionRef.current;
    if (!interaction) return;
    suppressClickRef.current = true;
    event.preventDefault();
    onSelectionChange?.(interaction.id);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Synthetic Storybook pointer events may not create a capturable browser pointer.
    }
  }

  function handlePointerMove(event: ReactPointerEvent<SVGSVGElement>): void {
    const interaction = interactionRef.current;
    if (!interaction || interaction.pointerId !== event.pointerId || !onDraftChange) return;
    event.preventDefault();
    suppressClickRef.current = true;
    const point = canvasPoint(event, event.currentTarget);

    if (interaction.type === "move") {
      onDraftChange(
        moveItem(interaction.sourceDraft, interaction.id, {
          x: point.x / interaction.sourceDraft.frame.width - interaction.offset.x,
          y: point.y / interaction.sourceDraft.frame.height - interaction.offset.y,
        }),
      );
      return;
    }

    const center = itemCenter(interaction.item, interaction.sourceDraft);
    if (interaction.type === "scale") {
      const scale = distance(point, center) / interaction.startDistance;
      onDraftChange(
        resizeArea(
          interaction.sourceDraft,
          interaction.id,
          interaction.item.area * scale * scale,
        ),
      );
      return;
    }

    if (interaction.type === "resize-free") {
      const local = rotateVector(
        { x: point.x - center.x, y: point.y - center.y },
        -(interaction.item.rotation ?? 0),
      );
      onDraftChange(
        resizeFreeArea(
          interaction.sourceDraft,
          interaction.id,
          (Math.abs(local.x) * 2) / interaction.sourceDraft.frame.width,
          (Math.abs(local.y) * 2) / interaction.sourceDraft.frame.height,
        ),
      );
      return;
    }

    const angle = Math.atan2(point.y - center.y, point.x - center.x);
    const degrees = ((angle - interaction.startAngle) * 180) / Math.PI;
    if (interaction.type === "rotate") {
      onDraftChange(
        rotateArea(
          interaction.sourceDraft,
          interaction.id,
          (interaction.item.rotation ?? 0) + degrees,
        ),
      );
      return;
    }
    onDraftChange(
      rotateDirectionLine(
        interaction.sourceDraft,
        interaction.id,
        interaction.item.rotation + degrees,
      ),
    );
  }

  function finishPointerInteraction(event: ReactPointerEvent<SVGSVGElement>): void {
    if (interactionRef.current?.pointerId !== event.pointerId) return;
    interactionRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
  }

  return (
    <div
      {...uiAssetAttributes({
        namespace: "human2ai",
        id: "composition-canvas",
        name: "CompositionCanvas",
        category: "module",
        origin: "project",
        status: "candidate",
      })}
      className={classes}
      style={style}
    >
      <svg
        className="human2ai-composition-canvas__svg"
        viewBox={`0 0 ${draft.frame.width} ${draft.frame.height}`}
        role="group"
        aria-label={ariaLabel}
        onClick={
          onSelectionChange
            ? (event) => {
                if (suppressClickRef.current) {
                  suppressClickRef.current = false;
                  return;
                }
                if (
                  event.target instanceof Element &&
                  (event.target.closest("[data-composition-item]") ||
                    event.target.closest("[data-handle]"))
                ) {
                  return;
                }
                onSelectionChange(null);
              }
            : undefined
        }
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishPointerInteraction}
        onPointerCancel={finishPointerInteraction}
        onLostPointerCapture={() => {
          interactionRef.current = null;
        }}
      >
        <rect
          className="human2ai-composition-canvas__frame"
          width={draft.frame.width}
          height={draft.frame.height}
          rx={12}
        />

        {draft.areas.map((area, index) => {
          const geometry = areaGeometry(area, draft.frame);
          return (
            <SelectableItem
              key={area.id}
              id={area.id}
              label={`选择${AREA_LABELS[area.primitive]} ${area.id}`}
              selected={selectedId === area.id}
              onSelect={onSelectionChange}
              onNudge={onDraftChange ? nudgeItem : undefined}
              className={`human2ai-composition-canvas__area human2ai-composition-canvas__area--tone-${index % 6}`}
            >
              {geometry.type === "circle" ? (
                <circle
                  className="human2ai-composition-canvas__shape"
                  cx={geometry.cx}
                  cy={geometry.cy}
                  r={geometry.radius}
                />
              ) : (
                <polygon
                  className="human2ai-composition-canvas__shape"
                  points={geometry.points.map((point) => `${point.x},${point.y}`).join(" ")}
                />
              )}
            </SelectableItem>
          );
        })}

        {draft.directionLine ? (
          <DirectionLineItem
            draft={draft}
            selected={selectedId === draft.directionLine.id}
            onSelect={onSelectionChange}
            onNudge={onDraftChange ? nudgeItem : undefined}
          />
        ) : null}

        {draft.focusPoints.map((focus) => {
          const x = focus.x * draft.frame.width;
          const y = focus.y * draft.frame.height;
          const radius = Math.max(10, Math.min(draft.frame.width, draft.frame.height) * 0.018);
          return (
            <SelectableItem
              key={focus.id}
              id={focus.id}
              label={`选择焦点 ${focus.id}`}
              selected={selectedId === focus.id}
              onSelect={onSelectionChange}
              onNudge={onDraftChange ? nudgeItem : undefined}
              className="human2ai-composition-canvas__focus"
            >
              <circle
                className="human2ai-composition-canvas__focus-ring"
                cx={x}
                cy={y}
                r={radius}
              />
              <line x1={x - radius * 1.5} y1={y} x2={x + radius * 1.5} y2={y} />
              <line x1={x} y1={y - radius * 1.5} x2={x} y2={y + radius * 1.5} />
              <circle className="human2ai-composition-canvas__focus-dot" cx={x} cy={y} r={4} />
            </SelectableItem>
          );
        })}

        {onDraftChange && selectedArea ? (
          <AreaInteractionHandles area={selectedArea} draft={draft} />
        ) : null}

        {onDraftChange && draft.directionLine?.id === selectedId ? (
          <DirectionInteractionHandles directionLine={draft.directionLine} draft={draft} />
        ) : null}
      </svg>
    </div>
  );
}

function DirectionLineItem({
  draft,
  selected,
  onSelect,
  onNudge,
}: {
  draft: CompositionDraft;
  selected: boolean;
  onSelect?: (id: string | null) => void;
  onNudge?: (id: string, delta: Point) => void;
}) {
  const directionLine = draft.directionLine;
  if (!directionLine) return null;
  const geometry = directionLineGeometry(directionLine, draft.frame);
  return (
    <SelectableItem
      id={directionLine.id}
      label={`选择方向线 ${directionLine.id}`}
      selected={selected}
      onSelect={onSelect}
      onNudge={onNudge}
      className="human2ai-composition-canvas__direction"
    >
      <line
        className="human2ai-composition-canvas__direction-hit"
        x1={geometry.start.x}
        y1={geometry.start.y}
        x2={geometry.end.x}
        y2={geometry.end.y}
      />
      <line
        className="human2ai-composition-canvas__direction-line"
        x1={geometry.start.x}
        y1={geometry.start.y}
        x2={geometry.end.x}
        y2={geometry.end.y}
      />
    </SelectableItem>
  );
}

function SelectableItem({
  id,
  label,
  selected,
  onSelect,
  onNudge,
  className,
  children,
}: SelectableItemProps) {
  const interactive = Boolean(onSelect);

  function handleClick(event: MouseEvent<SVGGElement>): void {
    event.stopPropagation();
    onSelect?.(id);
  }

  function handleKeyDown(event: KeyboardEvent<SVGGElement>): void {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect?.(id);
      return;
    }

    const step = event.shiftKey ? 0.05 : 0.01;
    const deltaByKey: Partial<Record<string, Point>> = {
      ArrowLeft: { x: -step, y: 0 },
      ArrowRight: { x: step, y: 0 },
      ArrowUp: { x: 0, y: -step },
      ArrowDown: { x: 0, y: step },
    };
    const delta = deltaByKey[event.key];
    if (!delta || !onNudge) return;
    event.preventDefault();
    onSelect?.(id);
    onNudge(id, delta);
  }

  return (
    <g
      className={["human2ai-composition-canvas__item", className].filter(Boolean).join(" ")}
      data-composition-item={id}
      data-selected={selected}
      role={interactive ? "button" : undefined}
      aria-label={interactive ? label : undefined}
      aria-pressed={interactive ? selected : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={interactive ? handleClick : undefined}
      onKeyDown={interactive ? handleKeyDown : undefined}
    >
      {children}
    </g>
  );
}

function AreaInteractionHandles({
  area,
  draft,
}: {
  area: CompositionArea;
  draft: CompositionDraft;
}) {
  const geometry = areaGeometry(area, draft.frame);
  const center = itemCenter(area, draft);
  const rotation = area.rotation ?? 0;
  const handleRadius = Math.max(9, Math.min(draft.frame.width, draft.frame.height) * 0.012);
  const gap = Math.max(28, Math.min(draft.frame.width, draft.frame.height) * 0.045);
  const scale =
    geometry.type === "circle"
      ? pointAt(center, 45, geometry.radius)
      : geometry.points[2];
  const edgeDistance =
    geometry.type === "circle"
      ? geometry.radius
      : area.primitive === "triangle"
        ? (2 * geometry.height) / 3
        : geometry.height / 2;
  const rotationHandle =
    area.primitive === "circle" ? null : pointAt(center, rotation - 90, edgeDistance + gap);
  const rotationStemStart =
    area.primitive === "circle" ? null : pointAt(center, rotation - 90, edgeDistance);

  return (
    <g className="human2ai-composition-canvas__handles" aria-hidden="true">
      {rotationHandle && rotationStemStart ? (
        <>
          <line
            className="human2ai-composition-canvas__transform-stem"
            x1={rotationStemStart.x}
            y1={rotationStemStart.y}
            x2={rotationHandle.x}
            y2={rotationHandle.y}
          />
          <circle
            className="human2ai-composition-canvas__transform-handle human2ai-composition-canvas__transform-handle--rotate"
            data-item-id={area.id}
            data-handle="rotate"
            cx={rotationHandle.x}
            cy={rotationHandle.y}
            r={handleRadius}
          />
        </>
      ) : null}
      <circle
        className="human2ai-composition-canvas__transform-handle human2ai-composition-canvas__transform-handle--scale"
        data-item-id={area.id}
        data-handle={
          area.primitive === "quadrilateral" && area.aspect === "free" ? "resize-free" : "scale"
        }
        cx={scale.x}
        cy={scale.y}
        r={handleRadius}
      />
    </g>
  );
}

function DirectionInteractionHandles({
  directionLine,
  draft,
}: {
  directionLine: DirectionLine;
  draft: CompositionDraft;
}) {
  const center = itemCenter(directionLine, draft);
  const radius = Math.max(9, Math.min(draft.frame.width, draft.frame.height) * 0.012);
  const rotation = pointAt(
    center,
    directionLine.rotation - 90,
    Math.max(42, Math.min(draft.frame.width, draft.frame.height) * 0.07),
  );
  return (
    <g className="human2ai-composition-canvas__handles" aria-hidden="true">
      <line
        className="human2ai-composition-canvas__transform-stem"
        x1={center.x}
        y1={center.y}
        x2={rotation.x}
        y2={rotation.y}
      />
      <circle
        className="human2ai-composition-canvas__direction-anchor"
        cx={center.x}
        cy={center.y}
        r={radius * 0.7}
      />
      <circle
        className="human2ai-composition-canvas__transform-handle human2ai-composition-canvas__transform-handle--rotate"
        data-item-id={directionLine.id}
        data-handle="rotate-direction"
        cx={rotation.x}
        cy={rotation.y}
        r={radius}
      />
    </g>
  );
}

function findItem(draft: CompositionDraft, id: string): Point | null {
  return (
    draft.areas.find((item) => item.id === id) ??
    draft.focusPoints.find((item) => item.id === id) ??
    (draft.directionLine?.id === id ? draft.directionLine : null)
  );
}

function itemCenter(item: Point, draft: CompositionDraft): Point {
  return { x: item.x * draft.frame.width, y: item.y * draft.frame.height };
}

function canvasPoint(
  event: ReactPointerEvent<SVGSVGElement>,
  svg: SVGSVGElement,
): Point {
  const point = svg.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  const matrix = svg.getScreenCTM();
  if (!matrix) return { x: 0, y: 0 };
  const transformed = point.matrixTransform(matrix.inverse());
  return { x: transformed.x, y: transformed.y };
}

function pointAt(center: Point, degrees: number, distanceFromCenter: number): Point {
  const radians = (degrees * Math.PI) / 180;
  return {
    x: center.x + Math.cos(radians) * distanceFromCenter,
    y: center.y + Math.sin(radians) * distanceFromCenter,
  };
}

function distance(first: Point, second: Point): number {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

function rotateVector(vector: Point, degrees: number): Point {
  const radians = (degrees * Math.PI) / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return {
    x: vector.x * cosine - vector.y * sine,
    y: vector.x * sine + vector.y * cosine,
  };
}
