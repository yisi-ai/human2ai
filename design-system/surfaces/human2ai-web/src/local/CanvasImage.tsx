import { useId } from "react";
import type { SyntheticEvent } from "react";

import type { Human2AiCanvasImageCrop } from "../../../../../src/domain/canvas-node-metadata";

import { uiAssetAttributes } from "../vendor/yisiui/runtime/src/assetMarker";

import "./CanvasElements.css";

export type CanvasImageFit = "contain" | "cover" | "fill";
export type CanvasImageStatus = "empty" | "ready" | "loading" | "error";

export interface CanvasImageProps {
  src?: string;
  alt: string;
  width: number;
  height: number;
  fit?: CanvasImageFit;
  crop?: Human2AiCanvasImageCrop | null;
  status?: CanvasImageStatus;
  loadingLabel?: string;
  errorLabel?: string;
  emptyLabel?: string;
  opacity?: number;
  className?: string;
  onLoad?: (event: SyntheticEvent<SVGImageElement>) => void;
  onError?: (event: SyntheticEvent<SVGImageElement>) => void;
}

export function CanvasImage({
  src,
  alt,
  width,
  height,
  fit = "contain",
  crop = null,
  status = "ready",
  loadingLabel = "图片加载中",
  errorLabel = "图片加载失败",
  emptyLabel = "图片",
  opacity,
  className,
  onLoad,
  onError,
}: CanvasImageProps) {
  const clipPathId = `human2ai-canvas-image-${useId().replaceAll(":", "")}`;
  const classes = ["human2ai-canvas-image", className].filter(Boolean).join(" ");
  const x = -width / 2;
  const y = -height / 2;
  const preserveAspectRatio = fit === "fill" ? "none" : `xMidYMid ${fit === "cover" ? "slice" : "meet"}`;

  return (
    <g
      {...uiAssetAttributes({
        namespace: "human2ai",
        id: "canvas-image",
        name: "CanvasImage",
        category: "module",
        origin: "project",
        status: "candidate",
      })}
      className={classes}
      data-image-fit={fit}
      data-image-status={status}
      role="img"
      aria-label={alt}
      opacity={opacity}
    >
      <rect
        className="human2ai-canvas-image__boundary"
        x={x}
        y={y}
        width={width}
        height={height}
        aria-hidden="true"
      />
      {status === "ready" && src ? (
        <>
          <defs>
            <clipPath id={clipPathId}>
              <rect x={x} y={y} width={width} height={height} />
            </clipPath>
          </defs>
          <image
            className="human2ai-canvas-image__content"
            href={src}
            x={crop ? x - (crop.x / crop.width) * width : x}
            y={crop ? y - (crop.y / crop.height) * height : y}
            width={crop ? width / crop.width : width}
            height={crop ? height / crop.height : height}
            preserveAspectRatio={crop ? "none" : preserveAspectRatio}
            clipPath={`url(#${clipPathId})`}
            onLoad={onLoad}
            onError={onError}
            aria-hidden="true"
          />
        </>
      ) : (
        <text
          className="human2ai-canvas-image__status"
          x={0}
          y={0}
          textAnchor="middle"
          dominantBaseline="middle"
          aria-hidden="true"
        >
          {status === "loading"
            ? loadingLabel
            : status === "error"
              ? errorLabel
              : emptyLabel}
        </text>
      )}
    </g>
  );
}
