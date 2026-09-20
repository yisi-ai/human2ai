import { useRef } from "react";
import type { MouseEvent, PointerEvent } from "react";

import { uiAssetAttributes } from "../vendor/yisiui/runtime/src/assetMarker";
import { CANVAS_NODE_RESIZE_HANDLES } from "./canvasNodeGeometry";
import {
  CanvasNode,
  type CanvasNodeBounds,
  type CanvasNodePoint,
  type CanvasNodeProps,
} from "./CanvasNode";
import { CanvasShape } from "./CanvasShape";

import "./CanvasElements.css";

export interface CanvasFrameMoveChange {
  id: string;
  bounds: CanvasNodeBounds;
  sourceBounds: CanvasNodeBounds;
  delta: CanvasNodePoint;
}

interface MoveInteraction {
  pointerId: number;
  sourceBounds: CanvasNodeBounds;
  start: CanvasNodePoint;
  startClient: CanvasNodePoint;
  inverseMatrix: DOMMatrix;
  moved: boolean;
}

export interface CanvasFrameProps
  extends Omit<
    CanvasNodeProps,
    | "bounds"
    | "children"
    | "onDelete"
    | "onDoubleClick"
    | "onRotate"
    | "rotation"
    | "rotationHandleOffset"
    | "resizeHandles"
    | "showRotationHandle"
    | "x"
    | "y"
  > {
  bounds: CanvasNodeBounds;
  onMove?: (change: CanvasFrameMoveChange) => void;
}

export function CanvasFrame({
  id,
  label,
  bounds,
  selected = false,
  locked = false,
  onMove,
  onSelect,
  className,
  ...nodeProps
}: CanvasFrameProps) {
  const moveInteractionRef = useRef<MoveInteraction | null>(null);
  const suppressClickRef = useRef(false);
  const nodeClasses = ["human2ai-canvas-frame__node", className]
    .filter(Boolean)
    .join(" ");
  const nodeBounds = {
    x: -bounds.width / 2,
    y: -bounds.height / 2,
    width: bounds.width,
    height: bounds.height,
  };

  function startMove(event: PointerEvent<SVGRectElement>): void {
    if (selected || locked || !onMove || event.button !== 0) return;
    suppressClickRef.current = false;
    const frame = event.currentTarget.closest<SVGGElement>("[data-canvas-frame]");
    const node = frame?.querySelector<SVGGElement>("[data-canvas-node]");
    const parent = frame?.parentElement as SVGGraphicsElement | SVGSVGElement | null;
    const matrix = parent?.getScreenCTM();
    if (!matrix) return;
    const inverseMatrix = matrix.inverse();
    event.preventDefault();
    event.stopPropagation();
    node?.focus();
    moveInteractionRef.current = {
      pointerId: event.pointerId,
      sourceBounds: { ...bounds },
      start: pointerInCoordinates(event, inverseMatrix),
      startClient: { x: event.clientX, y: event.clientY },
      inverseMatrix,
      moved: false,
    };
    capturePointer(event.currentTarget, event.pointerId);
  }

  function move(event: PointerEvent<SVGRectElement>): void {
    const interaction = moveInteractionRef.current;
    if (!interaction || interaction.pointerId !== event.pointerId || !onMove) return;
    event.preventDefault();
    event.stopPropagation();
    if (
      !interaction.moved
      && Math.hypot(
        event.clientX - interaction.startClient.x,
        event.clientY - interaction.startClient.y,
      ) < 3
    ) {
      return;
    }
    interaction.moved = true;
    const pointer = pointerInCoordinates(event, interaction.inverseMatrix);
    const delta = {
      x: pointer.x - interaction.start.x,
      y: pointer.y - interaction.start.y,
    };
    onMove({
      id,
      sourceBounds: interaction.sourceBounds,
      bounds: {
        ...interaction.sourceBounds,
        x: interaction.sourceBounds.x + delta.x,
        y: interaction.sourceBounds.y + delta.y,
      },
      delta,
    });
  }

  function finishMove(event: PointerEvent<SVGRectElement>): void {
    const interaction = moveInteractionRef.current;
    if (interaction?.pointerId !== event.pointerId) return;
    suppressClickRef.current = interaction.moved;
    moveInteractionRef.current = null;
    releasePointer(event.currentTarget, event.pointerId);
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
  }

  function handleHitClick(event: MouseEvent<SVGRectElement>): void {
    if (!suppressClickRef.current) return;
    suppressClickRef.current = false;
    event.preventDefault();
    event.stopPropagation();
  }

  return (
    <g
      {...uiAssetAttributes({
        namespace: "human2ai",
        id: "canvas-frame",
        name: "CanvasFrame",
        category: "module",
        origin: "project",
        status: "candidate",
      })}
      className="human2ai-canvas-frame"
      data-canvas-frame={id}
    >
      <CanvasNode
        {...nodeProps}
        id={id}
        label={label}
        x={bounds.x + bounds.width / 2}
        y={bounds.y + bounds.height / 2}
        bounds={nodeBounds}
        selected={selected}
        locked={locked}
        onSelect={onSelect}
        resizeHandles={CANVAS_NODE_RESIZE_HANDLES}
        showRotationHandle={false}
        className={nodeClasses}
      >
        <CanvasShape
          type="rectangle"
          width={bounds.width}
          height={bounds.height}
          className="human2ai-canvas-frame__border"
        />
        <rect
          className="human2ai-canvas-frame__hit"
          x={nodeBounds.x}
          y={nodeBounds.y}
          width={nodeBounds.width}
          height={nodeBounds.height}
          data-canvas-frame-hit="true"
          data-frame-edge-mode={selected ? "resize" : "move"}
          data-frame-movable={!selected && !locked && onMove ? "true" : "false"}
          aria-hidden="true"
          onClick={handleHitClick}
          onPointerDown={startMove}
          onPointerMove={move}
          onPointerUp={finishMove}
          onPointerCancel={finishMove}
          onLostPointerCapture={() => {
            const interaction = moveInteractionRef.current;
            if (!interaction) return;
            suppressClickRef.current = interaction.moved;
            moveInteractionRef.current = null;
            window.setTimeout(() => {
              suppressClickRef.current = false;
            }, 0);
          }}
        />
      </CanvasNode>
    </g>
  );
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
