import { Tooltip } from "antd";
import { useRef } from "react";
import { createPortal } from "react-dom";
import type {
  KeyboardEvent,
  MouseEvent,
  PointerEvent,
  ReactNode,
  SVGProps,
} from "react";

import { uiAssetAttributes } from "../vendor/yisiui/runtime/src/assetMarker";
import {
  CANVAS_NODE_RESIZE_HANDLES,
  canvasNodeResizeHandleBounds,
  resizeCanvasNodeBounds,
  type CanvasNodeBounds,
  type CanvasNodePoint,
  type CanvasNodeResizeHandle,
} from "./canvasNodeGeometry";

import "./CanvasElements.css";

export type {
  CanvasNodeBounds,
  CanvasNodePoint,
  CanvasNodeResizeHandle,
} from "./canvasNodeGeometry";

export type CanvasNodeResizeMode = "free" | "proportional" | "font-size";

export interface CanvasNodeResizeChange {
  id: string;
  handle: CanvasNodeResizeHandle;
  bounds: CanvasNodeBounds;
  sourceBounds: CanvasNodeBounds;
  sourcePosition: CanvasNodePoint;
  sourceRotation: number;
  scaleX: number;
  scaleY: number;
  fromCenter: boolean;
  proportional: boolean;
}

export interface CanvasNodeRotateChange {
  id: string;
  rotation: number;
  sourceRotation: number;
}

export type CanvasNodeSelectEvent =
  | MouseEvent<SVGGElement>
  | KeyboardEvent<SVGGElement>;

export interface CanvasNodeTooltip {
  annotation?: string;
  displayText?: string;
  note?: string;
  labels: {
    nodeDescription: string;
    displayText: string;
    note: string;
  };
}

export interface CanvasNodeProps
  extends Omit<
    SVGProps<SVGGElement>,
    | "children"
    | "id"
    | "onClick"
    | "onDoubleClick"
    | "onKeyDown"
    | "onSelect"
    | "transform"
  > {
  id: string;
  label: string;
  children: ReactNode;
  x?: number;
  y?: number;
  rotation?: number;
  selected?: boolean;
  controlsHost?: SVGGElement | null;
  locked?: boolean;
  bounds?: CanvasNodeBounds;
  resizeMode?: CanvasNodeResizeMode;
  resizeCenter?: CanvasNodePoint;
  minimumWidth?: number;
  minimumHeight?: number;
  screenScale?: number;
  resizeHitSize?: number;
  resizeHandles?: readonly CanvasNodeResizeHandle[];
  showRotationHandle?: boolean;
  rotationHandleOffset?: number;
  nudgeStep?: number;
  largeNudgeStep?: number;
  tooltip?: CanvasNodeTooltip;
  onSelect?: (id: string, event: CanvasNodeSelectEvent) => void;
  onNudge?: (delta: CanvasNodePoint) => void;
  onResize?: (change: CanvasNodeResizeChange) => void;
  onRotate?: (change: CanvasNodeRotateChange) => void;
  onDoubleClick?: (id: string, event: MouseEvent<SVGGElement>) => void;
  onDelete?: (id: string, event: KeyboardEvent<SVGGElement>) => void;
  onKeyDown?: (event: KeyboardEvent<SVGGElement>) => void;
}

interface ResizeInteraction {
  pointerId: number;
  handle: CanvasNodeResizeHandle;
  sourceBounds: CanvasNodeBounds;
  sourcePosition: CanvasNodePoint;
  sourceRotation: number;
  inverseMatrix: DOMMatrix;
}

interface RotateInteraction {
  pointerId: number;
  sourceRotation: number;
  startAngle: number;
  inverseParentMatrix: DOMMatrix;
}

export function CanvasNode({
  id,
  label,
  children,
  x = 0,
  y = 0,
  rotation = 0,
  selected = false,
  controlsHost,
  locked = false,
  bounds,
  resizeMode = "free",
  resizeCenter,
  minimumWidth = 8,
  minimumHeight = 8,
  screenScale = 1,
  resizeHitSize = 24,
  resizeHandles = CANVAS_NODE_RESIZE_HANDLES,
  showRotationHandle = true,
  rotationHandleOffset = 32,
  nudgeStep = 1,
  largeNudgeStep = 10,
  tooltip,
  onSelect,
  onNudge,
  onResize,
  onRotate,
  onDoubleClick,
  onDelete,
  onKeyDown,
  className,
  ...groupProps
}: CanvasNodeProps) {
  const resizeInteractionRef = useRef<ResizeInteraction | null>(null);
  const rotateInteractionRef = useRef<RotateInteraction | null>(null);
  const interactive =
    !locked &&
    Boolean(onSelect || onNudge || onResize || onRotate || onDoubleClick || onDelete || onKeyDown);
  const classes = ["human2ai-canvas-node", className].filter(Boolean).join(" ");
  const resizeControlsVisible = selected && !locked && Boolean(bounds && onResize);
  const rotationControlVisible =
    selected && !locked && showRotationHandle && Boolean(bounds && onRotate);
  const resolvedScreenScale =
    screenScale > 0 && Number.isFinite(screenScale) ? screenScale : 1;
  const rotationOffset = rotationHandleOffset / resolvedScreenScale;
  const rotationHandleRadius = 7 / resolvedScreenScale;
  const rotationHitRadius = 12 / resolvedScreenScale;

  function handleClick(event: MouseEvent<SVGGElement>): void {
    event.stopPropagation();
    focusCanvasNode(event.currentTarget);
    onSelect?.(id, event);
  }

  function handlePointerDown(event: PointerEvent<SVGGElement>): void {
    focusCanvasNode(event.currentTarget);
    groupProps.onPointerDown?.(event);
  }

  function handleDoubleClick(event: MouseEvent<SVGGElement>): void {
    event.stopPropagation();
    onDoubleClick?.(id, event);
  }

  function handleKeyDown(event: KeyboardEvent<SVGGElement>): void {
    if ((event.key === "Delete" || event.key === "Backspace") && selected && onDelete) {
      event.preventDefault();
      event.stopPropagation();
      onDelete(id, event);
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      if (!onSelect) return;
      event.preventDefault();
      onSelect(id, event);
      return;
    }

    const step = event.shiftKey ? largeNudgeStep : nudgeStep;
    const deltaByKey: Partial<Record<string, CanvasNodePoint>> = {
      ArrowLeft: { x: -step, y: 0 },
      ArrowRight: { x: step, y: 0 },
      ArrowUp: { x: 0, y: -step },
      ArrowDown: { x: 0, y: step },
    };
    const delta = deltaByKey[event.key];
    if (!delta || !onNudge) {
      onKeyDown?.(event);
      return;
    }
    event.preventDefault();
    onSelect?.(id, event);
    onNudge(delta);
  }

  function startResize(
    event: PointerEvent<SVGRectElement>,
    handle: CanvasNodeResizeHandle,
  ): void {
    if (!bounds || !onResize) return;
    const node = event.currentTarget.closest<SVGGElement>("[data-canvas-node]")
      ?? event.currentTarget.ownerSVGElement?.querySelector<SVGGElement>(`[data-canvas-node="${CSS.escape(id)}"]`);
    const matrix = node?.getScreenCTM();
    if (!matrix) return;
    event.preventDefault();
    event.stopPropagation();
    node?.focus();
    resizeInteractionRef.current = {
      pointerId: event.pointerId,
      handle,
      sourceBounds: { ...bounds },
      sourcePosition: { x, y },
      sourceRotation: rotation,
      inverseMatrix: matrix.inverse(),
    };
    capturePointer(event.currentTarget, event.pointerId);
  }

  function resize(event: PointerEvent<SVGRectElement>): void {
    const interaction = resizeInteractionRef.current;
    if (!interaction || interaction.pointerId !== event.pointerId || !onResize) return;
    event.preventDefault();
    event.stopPropagation();
    const pointer = pointerInCoordinates(event, interaction.inverseMatrix);
    const proportional = resizeMode !== "free" || event.shiftKey;
    const result = resizeCanvasNodeBounds({
      bounds: interaction.sourceBounds,
      handle: interaction.handle,
      pointer,
      center: resizeCenter,
      fromCenter: event.altKey,
      proportional,
      minimumWidth,
      minimumHeight,
    });
    onResize({
      id,
      handle: interaction.handle,
      bounds: result.bounds,
      sourceBounds: interaction.sourceBounds,
      sourcePosition: interaction.sourcePosition,
      sourceRotation: interaction.sourceRotation,
      scaleX: result.scaleX,
      scaleY: result.scaleY,
      fromCenter: event.altKey,
      proportional,
    });
  }

  function finishResize(event: PointerEvent<SVGRectElement>): void {
    if (resizeInteractionRef.current?.pointerId !== event.pointerId) return;
    resizeInteractionRef.current = null;
    releasePointer(event.currentTarget, event.pointerId);
  }

  function startRotate(event: PointerEvent<SVGCircleElement>): void {
    if (!onRotate) return;
    const node = event.currentTarget.closest<SVGGElement>("[data-canvas-node]")
      ?? event.currentTarget.ownerSVGElement?.querySelector<SVGGElement>(`[data-canvas-node="${CSS.escape(id)}"]`);
    const parent = node?.parentElement as SVGGraphicsElement | SVGSVGElement | null;
    const matrix = parent?.getScreenCTM();
    if (!matrix) return;
    const inverseParentMatrix = matrix.inverse();
    const pointer = pointerInCoordinates(event, inverseParentMatrix);
    event.preventDefault();
    event.stopPropagation();
    node?.focus();
    rotateInteractionRef.current = {
      pointerId: event.pointerId,
      sourceRotation: rotation,
      startAngle: Math.atan2(pointer.y - y, pointer.x - x),
      inverseParentMatrix,
    };
    capturePointer(event.currentTarget, event.pointerId);
  }

  function rotate(event: PointerEvent<SVGCircleElement>): void {
    const interaction = rotateInteractionRef.current;
    if (!interaction || interaction.pointerId !== event.pointerId || !onRotate) return;
    event.preventDefault();
    event.stopPropagation();
    const pointer = pointerInCoordinates(event, interaction.inverseParentMatrix);
    const angle = Math.atan2(pointer.y - y, pointer.x - x);
    const degrees = ((angle - interaction.startAngle) * 180) / Math.PI;
    onRotate({
      id,
      rotation: interaction.sourceRotation + degrees,
      sourceRotation: interaction.sourceRotation,
    });
  }

  function finishRotate(event: PointerEvent<SVGCircleElement>): void {
    if (rotateInteractionRef.current?.pointerId !== event.pointerId) return;
    rotateInteractionRef.current = null;
    releasePointer(event.currentTarget, event.pointerId);
  }

  const controls = (
    <>
      {bounds ? (
        <rect
          className="human2ai-canvas-node__outline"
          x={bounds.x}
          y={bounds.y}
          width={bounds.width}
          height={bounds.height}
          aria-hidden="true"
        />
      ) : null}
      {resizeControlsVisible && bounds ? (
        <g className="human2ai-canvas-node__resize-controls" aria-hidden="true">
          {orderedResizeHandles(resizeHandles).map((handle) => {
            const hitBounds = canvasNodeResizeHandleBounds({
              bounds,
              handle,
              hitSize: resizeHitSize,
              screenScale: resolvedScreenScale,
            });
            return (
              <rect
                key={handle}
                className="human2ai-canvas-node__resize-hit"
                data-node-id={id}
                data-resize-handle={handle}
                x={hitBounds.x}
                y={hitBounds.y}
                width={hitBounds.width}
                height={hitBounds.height}
                onPointerDown={(event) => startResize(event, handle)}
                onPointerMove={resize}
                onPointerUp={finishResize}
                onPointerCancel={finishResize}
                onLostPointerCapture={() => {
                  resizeInteractionRef.current = null;
                }}
              />
            );
          })}
        </g>
      ) : null}
      {rotationControlVisible && bounds ? (
        <g className="human2ai-canvas-node__rotation-control" aria-hidden="true">
          <line
            className="human2ai-canvas-node__rotation-stem"
            x1={bounds.x + bounds.width / 2}
            y1={bounds.y}
            x2={bounds.x + bounds.width / 2}
            y2={bounds.y - rotationOffset}
          />
          <circle
            className="human2ai-canvas-node__rotation-handle"
            cx={bounds.x + bounds.width / 2}
            cy={bounds.y - rotationOffset}
            r={rotationHandleRadius}
          />
          <circle
            className="human2ai-canvas-node__rotation-hit"
            data-node-id={id}
            data-rotation-handle="true"
            cx={bounds.x + bounds.width / 2}
            cy={bounds.y - rotationOffset}
            r={rotationHitRadius}
            onPointerDown={startRotate}
            onPointerMove={rotate}
            onPointerUp={finishRotate}
            onPointerCancel={finishRotate}
            onLostPointerCapture={() => {
              rotateInteractionRef.current = null;
            }}
          />
        </g>
      ) : null}
    </>
  );

  const node = (
    <g
      {...groupProps}
      {...uiAssetAttributes({
        namespace: "human2ai",
        id: "canvas-node",
        name: "CanvasNode",
        category: "module",
        origin: "project",
        status: "candidate",
      })}
      className={classes}
      data-canvas-node={id}
      data-node-x={x}
      data-node-y={y}
      data-node-rotation={rotation}
      data-selected={selected ? "true" : "false"}
      data-locked={locked ? "true" : "false"}
      data-resize-mode={onResize ? resizeMode : undefined}
      data-resizable={onResize ? "true" : "false"}
      data-rotatable={onRotate && showRotationHandle ? "true" : "false"}
      data-deletable={!locked && onDelete ? "true" : "false"}
      data-has-operation-outline={bounds ? "true" : "false"}
      transform={`translate(${x} ${y}) rotate(${rotation})`}
      role={interactive ? "button" : groupProps.role}
      aria-label={interactive ? label : groupProps["aria-label"]}
      aria-pressed={interactive ? selected : undefined}
      aria-disabled={locked || undefined}
      aria-keyshortcuts={
        !locked && onDelete ? "Delete Backspace" : groupProps["aria-keyshortcuts"]
      }
      tabIndex={interactive ? (groupProps.tabIndex ?? 0) : groupProps.tabIndex}
      onClick={interactive ? handleClick : undefined}
      onDoubleClick={interactive && onDoubleClick ? handleDoubleClick : undefined}
      onKeyDown={interactive ? handleKeyDown : undefined}
      onPointerDown={interactive ? handlePointerDown : groupProps.onPointerDown}
    >
      {children}
      {controlsHost && selected ? createPortal(
        <g className={classes} data-selected="true" data-canvas-controls={id}
          transform={`translate(${x} ${y}) rotate(${rotation})`}>
          {controls}
        </g>, controlsHost,
      ) : controls}
    </g>
  );

  const tooltipFields = tooltip ? [
    [tooltip.labels.nodeDescription, tooltip.annotation],
    [tooltip.labels.displayText, tooltip.displayText],
    [tooltip.labels.note, tooltip.note],
  ].filter(([, value]) => value?.trim()) : [];

  return tooltipFields.length > 0 ? (
    <Tooltip
      title={(
        <dl className="human2ai-canvas-node__tooltip">
          {tooltipFields.map(([fieldLabel, value]) => (
            <div key={fieldLabel}>
              <dt>{fieldLabel}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      )}
      mouseEnterDelay={0}
      mouseLeaveDelay={0}
      trigger={["hover", "focus"]}
    >
      {node}
    </Tooltip>
  ) : node;
}

const EDGE_HANDLES: readonly CanvasNodeResizeHandle[] = ["top", "right", "bottom", "left"];

function orderedResizeHandles(
  handles: readonly CanvasNodeResizeHandle[],
): readonly CanvasNodeResizeHandle[] {
  const ordered = [
    ...EDGE_HANDLES,
    ...CANVAS_NODE_RESIZE_HANDLES.filter((handle) => !EDGE_HANDLES.includes(handle)),
  ];
  return ordered.filter((handle) => handles.includes(handle));
}

function pointerInCoordinates(
  event: Pick<PointerEvent<SVGElement>, "clientX" | "clientY">,
  inverseMatrix: DOMMatrix,
): CanvasNodePoint {
  const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(inverseMatrix);
  return { x: point.x, y: point.y };
}

function capturePointer(element: SVGElement, pointerId: number): void {
  try {
    element.setPointerCapture(pointerId);
  } catch {
    // Synthetic Storybook pointer events may not create a capturable browser pointer.
  }
}

function releasePointer(element: SVGElement, pointerId: number): void {
  if (element.hasPointerCapture(pointerId)) element.releasePointerCapture(pointerId);
}

function focusCanvasNode(node: SVGGElement): void {
  node.focus();
  requestAnimationFrame(() => {
    if (node.isConnected) node.focus();
  });
}
