"use client";

import { useLayoutEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";

import { uiAssetAttributes } from "../vendor/yisiui/runtime/src/assetMarker";
import type { InfiniteCanvasBounds, InfiniteCanvasPoint } from "./InfiniteCanvasViewport";

import "./CanvasPlacement.css";

export interface CanvasPlacementTool {
  shape: "rectangle" | "ellipse" | "triangle" | "point" | "line";
  width: number;
  height: number;
  clickOnly?: boolean;
}

export interface CanvasPlacementResult {
  bounds: InfiniteCanvasBounds;
  start: InfiniteCanvasPoint;
  end: InfiniteCanvasPoint;
  dragged: boolean;
}

export interface CanvasPlacementProps {
  tool: CanvasPlacementTool;
  viewportBounds: InfiniteCanvasBounds;
  onPlace: (result: CanvasPlacementResult) => void;
  onCancel: () => void;
}

interface PlacementGesture {
  pointerId: number;
  start: InfiniteCanvasPoint;
  client: InfiniteCanvasPoint;
}

// Mount as the last scene child only while a tool is armed; the viewport's
// capture handlers retain priority for Space/right-button camera panning.
export function CanvasPlacement({ tool, viewportBounds, onPlace, onCancel }: CanvasPlacementProps) {
  const previewRef = useRef<SVGPathElement>(null);
  const lastClientRef = useRef<{ clientX: number; clientY: number } | null>(null);
  const gestureRef = useRef<PlacementGesture | null>(null);
  const frameRef = useRef<number | null>(null);
  const previewResultRef = useRef<CanvasPlacementResult | null>(null);
  const callbacksRef = useRef({ onPlace, onCancel });
  callbacksRef.current = { onPlace, onCancel };

  function clearPreview(): void {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    previewResultRef.current = null;
    previewRef.current?.removeAttribute("d");
  }

  function cancel(): void {
    gestureRef.current = null;
    clearPreview();
    callbacksRef.current.onCancel();
  }

  useLayoutEffect(() => {
    previewRef.current?.ownerSVGElement?.focus({ preventScroll: true });
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      cancel();
    }
    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("blur", cancel);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("blur", cancel);
      gestureRef.current = null;
      clearPreview();
    };
  }, []);

  useLayoutEffect(() => {
    if (lastClientRef.current && previewResultRef.current) preview(resultFor(lastClientRef.current));
  }, [viewportBounds.x, viewportBounds.y, viewportBounds.width, viewportBounds.height]);

  function resultFor(event: Pick<ReactPointerEvent, "clientX" | "clientY">): CanvasPlacementResult {
    lastClientRef.current = { clientX: event.clientX, clientY: event.clientY };
    const scene = previewRef.current!.ownerSVGElement!;
    const client = scene.createSVGPoint();
    client.x = event.clientX;
    client.y = event.clientY;
    const point = client.matrixTransform(scene.getScreenCTM()!.inverse());
    const gesture = gestureRef.current;
    const dragged = Boolean(gesture && Math.hypot(
      event.clientX - gesture.client.x,
      event.clientY - gesture.client.y,
    ) >= 3);
    return canvasPlacementResult(tool, gesture?.start ?? point, point, dragged);
  }

  function preview(result: CanvasPlacementResult): void {
    previewResultRef.current = result;
    if (frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      const current = previewResultRef.current;
      if (current) previewRef.current?.setAttribute("d", previewPath(tool, current));
    });
  }

  return (
    <g
      {...uiAssetAttributes({
        namespace: "human2ai", id: "canvas-placement", name: "CanvasPlacement",
        category: "module", origin: "project", status: "candidate",
      })}
      className="human2ai-canvas-placement"
      data-canvas-placement
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => {
        if (event.button !== 0 || gestureRef.current) return;
        event.preventDefault();
        event.stopPropagation();
        const result = resultFor(event);
        gestureRef.current = {
          pointerId: event.pointerId,
          start: result.start,
          client: { x: event.clientX, y: event.clientY },
        };
        event.currentTarget.setPointerCapture(event.pointerId);
        preview(result);
      }}
      onPointerMove={(event) => {
        event.stopPropagation();
        if (gestureRef.current && gestureRef.current.pointerId !== event.pointerId) return;
        if (event.buttons !== 0 && !gestureRef.current) return;
        preview(resultFor(event));
      }}
      onPointerLeave={() => {
        if (!gestureRef.current) clearPreview();
      }}
      onPointerUp={(event) => {
        if (gestureRef.current?.pointerId !== event.pointerId) return;
        event.preventDefault();
        event.stopPropagation();
        const result = resultFor(event);
        gestureRef.current = null;
        clearPreview();
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
        callbacksRef.current.onPlace(result);
      }}
      onPointerCancel={(event) => {
        event.stopPropagation();
        if (gestureRef.current?.pointerId === event.pointerId) cancel();
      }}
      onLostPointerCapture={(event) => {
        event.stopPropagation();
        if (gestureRef.current?.pointerId === event.pointerId) cancel();
      }}
    >
      <rect {...viewportBounds} fill="transparent" pointerEvents="all" />
      <path ref={previewRef} className="human2ai-canvas-placement__preview" aria-hidden="true" />
    </g>
  );
}

export function canvasPlacementResult(
  tool: CanvasPlacementTool,
  start: InfiniteCanvasPoint,
  end: InfiniteCanvasPoint,
  dragged: boolean,
): CanvasPlacementResult {
  const sized = dragged && !tool.clickOnly && tool.shape !== "point";
  return {
    start: { x: start.x, y: start.y },
    end: sized ? { x: end.x, y: end.y } : { x: start.x + tool.width, y: start.y },
    dragged: sized,
    bounds: {
      x: sized ? Math.min(start.x, end.x) : start.x,
      y: sized ? Math.min(start.y, end.y) : start.y,
      width: sized ? Math.max(8, Math.abs(end.x - start.x)) : tool.width,
      height: sized ? Math.max(8, Math.abs(end.y - start.y)) : tool.height,
    },
  };
}

function previewPath(tool: CanvasPlacementTool, result: CanvasPlacementResult): string {
  const { x, y, width: w, height: h } = result.bounds;
  if (tool.shape === "point") {
    return `M ${x - 8} ${y} H ${x + 8} M ${x} ${y - 8} V ${y + 8}`;
  }
  if (tool.shape === "line") {
    return `M ${result.start.x} ${result.start.y} L ${result.end.x} ${result.end.y}`;
  }
  if (tool.shape === "ellipse") {
    return `M ${x} ${y + h / 2} a ${w / 2} ${h / 2} 0 1 0 ${w} 0 a ${w / 2} ${h / 2} 0 1 0 ${-w} 0`;
  }
  if (tool.shape === "triangle") {
    return `M ${x + w / 2} ${y} L ${x + w} ${y + h} H ${x} Z`;
  }
  return `M ${x} ${y} h ${w} v ${h} h ${-w} Z`;
}
