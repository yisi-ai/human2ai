import type { CSSProperties } from "react";

import { uiAssetAttributes } from "../vendor/yisiui/runtime/src/assetMarker";

import "./CanvasElements.css";

interface CanvasShapeBaseProps {
  className?: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number | string;
  opacity?: number;
  style?: CSSProperties;
  "aria-label"?: string;
}

export type CanvasShapeProps = CanvasShapeBaseProps &
  (
    | { type: "circle"; size: number; width?: never; height?: never }
    | { type: "circle"; width: number; height: number; size?: never }
    | { type: "triangle" | "rectangle"; width: number; height: number; size?: never }
  );

export function CanvasShape(props: CanvasShapeProps) {
  const {
    type,
    className,
    fill,
    stroke,
    strokeWidth,
    opacity,
    style,
    "aria-label": ariaLabel,
  } = props;
  const classes = ["human2ai-canvas-shape", className].filter(Boolean).join(" ");
  const commonProps = {
    ...uiAssetAttributes({
      namespace: "human2ai",
      id: "canvas-shape",
      name: "CanvasShape",
      category: "module" as const,
      origin: "project" as const,
      status: "candidate" as const,
    }),
    className: classes,
    fill,
    stroke,
    strokeWidth,
    opacity,
    style,
    role: ariaLabel ? "img" : undefined,
    "aria-label": ariaLabel,
    "aria-hidden": ariaLabel ? undefined : true,
    "data-shape-type": type,
  };

  if (type === "circle") {
    return "size" in props && props.size !== undefined ? (
      <circle {...commonProps} cx={0} cy={0} r={props.size / 2} />
    ) : (
      <ellipse {...commonProps} cx={0} cy={0} rx={props.width / 2} ry={props.height / 2} />
    );
  }

  if (type === "rectangle") {
    return (
      <rect
        {...commonProps}
        x={-props.width / 2}
        y={-props.height / 2}
        width={props.width}
        height={props.height}
      />
    );
  }

  const points = [
    `0,${(-2 * props.height) / 3}`,
    `${-props.width / 2},${props.height / 3}`,
    `${props.width / 2},${props.height / 3}`,
  ].join(" ");
  return <polygon {...commonProps} points={points} />;
}
