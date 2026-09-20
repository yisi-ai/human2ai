import type { ReactNode, SVGProps } from "react";

import { uiAssetAttributes } from "../vendor/yisiui/runtime/src/assetMarker";
import type { InfiniteCanvasBounds } from "./InfiniteCanvasViewport";

import "./CanvasElements.css";

export interface CanvasSceneProps
  extends Omit<SVGProps<SVGSVGElement>, "children" | "viewBox"> {
  bounds: InfiniteCanvasBounds;
  children: ReactNode;
}

export function CanvasScene({
  bounds,
  children,
  className,
  role = "group",
  ...svgProps
}: CanvasSceneProps) {
  const classes = ["human2ai-canvas-scene", className].filter(Boolean).join(" ");

  return (
    <svg
      {...svgProps}
      {...uiAssetAttributes({
        namespace: "human2ai",
        id: "canvas-scene",
        name: "CanvasScene",
        category: "module",
        origin: "project",
        status: "candidate",
      })}
      className={classes}
      viewBox={`${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`}
      role={role}
    >
      {children}
    </svg>
  );
}
