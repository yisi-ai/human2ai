import { uiAssetAttributes } from "../vendor/yisiui/runtime/src/assetMarker";

import "./CanvasElements.css";

export interface CanvasPointProps {
  radius?: number;
  className?: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  "aria-label"?: string;
}

export function CanvasPoint({
  radius = 6,
  className,
  fill,
  stroke,
  strokeWidth,
  opacity,
  "aria-label": ariaLabel,
}: CanvasPointProps) {
  const classes = ["human2ai-canvas-point", className].filter(Boolean).join(" ");
  return (
    <circle
      {...uiAssetAttributes({
        namespace: "human2ai",
        id: "canvas-point",
        name: "CanvasPoint",
        category: "module",
        origin: "project",
        status: "candidate",
      })}
      className={classes}
      cx={0}
      cy={0}
      r={radius}
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      opacity={opacity}
      role={ariaLabel ? "img" : undefined}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
    />
  );
}
