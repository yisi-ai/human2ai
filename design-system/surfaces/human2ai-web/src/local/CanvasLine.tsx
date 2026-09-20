import { useId } from "react";

import { uiAssetAttributes } from "../vendor/yisiui/runtime/src/assetMarker";
import type { InfiniteCanvasBounds, InfiniteCanvasPoint } from "./InfiniteCanvasViewport";

import "./CanvasElements.css";

interface CanvasLineBaseProps {
  className?: string;
  stroke?: string;
  strokeWidth?: number;
  dashArray?: string;
  opacity?: number;
  hitWidth?: number;
  "aria-label"?: string;
}

export type CanvasLineProps = CanvasLineBaseProps &
  (
    | {
        type: "infinite";
        anchor: InfiniteCanvasPoint;
        angle: number;
        bounds: InfiniteCanvasBounds;
        start?: never;
        end?: never;
      }
    | {
        type: "directed";
        start: InfiniteCanvasPoint;
        end: InfiniteCanvasPoint;
        anchor?: never;
        angle?: never;
        bounds?: never;
      }
  );

export function CanvasLine(props: CanvasLineProps) {
  const {
    type,
    className,
    stroke,
    strokeWidth,
    dashArray,
    opacity,
    hitWidth,
    "aria-label": ariaLabel,
  } = props;
  const markerId = `human2ai-canvas-line-arrow-${useId().replaceAll(":", "")}`;
  const classes = ["human2ai-canvas-line", className].filter(Boolean).join(" ");
  const segment = type === "infinite"
    ? infiniteLineSegment(props.anchor, props.angle, props.bounds)
    : { start: props.start, end: props.end };

  return (
    <g
      {...uiAssetAttributes({
        namespace: "human2ai",
        id: "canvas-line",
        name: "CanvasLine",
        category: "module",
        origin: "project",
        status: "candidate",
      })}
      className={classes}
      data-line-type={type}
      role={ariaLabel ? "img" : undefined}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
      opacity={opacity}
    >
      {type === "directed" ? (
        <defs>
          <marker
            id={markerId}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="4"
            markerHeight="4"
            orient="auto-start-reverse"
            markerUnits="strokeWidth"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke" />
          </marker>
        </defs>
      ) : null}
      {segment ? (
        <>
          <line
            className="human2ai-canvas-line__hit"
            x1={segment.start.x}
            y1={segment.start.y}
            x2={segment.end.x}
            y2={segment.end.y}
            strokeWidth={hitWidth}
          />
          <line
            className="human2ai-canvas-line__visible"
            x1={segment.start.x}
            y1={segment.start.y}
            x2={segment.end.x}
            y2={segment.end.y}
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeDasharray={dashArray}
            markerEnd={type === "directed" ? `url(#${markerId})` : undefined}
          />
        </>
      ) : null}
    </g>
  );
}

function infiniteLineSegment(
  anchor: InfiniteCanvasPoint,
  angle: number,
  bounds: InfiniteCanvasBounds,
): { start: InfiniteCanvasPoint; end: InfiniteCanvasPoint } | null {
  const radians = (angle * Math.PI) / 180;
  const direction = { x: Math.cos(radians), y: Math.sin(radians) };
  const minimumX = bounds.x;
  const maximumX = bounds.x + bounds.width;
  const minimumY = bounds.y;
  const maximumY = bounds.y + bounds.height;
  const points: Array<InfiniteCanvasPoint & { distance: number }> = [];
  const epsilon = 0.000001;

  function addPoint(distance: number): void {
    const point = {
      x: anchor.x + direction.x * distance,
      y: anchor.y + direction.y * distance,
      distance,
    };
    if (
      point.x < minimumX - epsilon ||
      point.x > maximumX + epsilon ||
      point.y < minimumY - epsilon ||
      point.y > maximumY + epsilon
    ) {
      return;
    }
    if (points.some((candidate) => Math.hypot(candidate.x - point.x, candidate.y - point.y) < epsilon)) {
      return;
    }
    points.push(point);
  }

  if (Math.abs(direction.x) > epsilon) {
    addPoint((minimumX - anchor.x) / direction.x);
    addPoint((maximumX - anchor.x) / direction.x);
  }
  if (Math.abs(direction.y) > epsilon) {
    addPoint((minimumY - anchor.y) / direction.y);
    addPoint((maximumY - anchor.y) / direction.y);
  }
  if (points.length < 2) return null;
  points.sort((first, second) => first.distance - second.distance);
  return { start: points[0], end: points[points.length - 1] };
}
