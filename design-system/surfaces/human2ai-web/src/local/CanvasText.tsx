import { useLayoutEffect, useRef } from "react";
import type { CSSProperties } from "react";

import { uiAssetAttributes } from "../vendor/yisiui/runtime/src/assetMarker";

import "./CanvasElements.css";

export interface CanvasTextBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CanvasTextProps {
  text: string;
  fontSize: number;
  lineHeight?: number;
  fontFamily?: string;
  fontWeight?: number | string;
  fill?: string;
  opacity?: number;
  textAnchor?: "start" | "middle" | "end";
  className?: string;
  style?: CSSProperties;
  onBoundsChange?: (bounds: CanvasTextBounds) => void;
  "aria-label"?: string;
}

export function CanvasText({
  text,
  fontSize,
  lineHeight = 1.4,
  fontFamily,
  fontWeight,
  fill,
  opacity,
  textAnchor = "start",
  className,
  style,
  onBoundsChange,
  "aria-label": ariaLabel = text,
}: CanvasTextProps) {
  const textRef = useRef<SVGTextElement | null>(null);
  const onBoundsChangeRef = useRef(onBoundsChange);
  const lastBoundsRef = useRef<CanvasTextBounds | null>(null);
  onBoundsChangeRef.current = onBoundsChange;
  const classes = ["human2ai-canvas-text", className].filter(Boolean).join(" ");
  const lines = text.split("\n");
  const reportsBounds = Boolean(onBoundsChange);

  useLayoutEffect(() => {
    if (!reportsBounds) return;
    const element = textRef.current;
    if (!element) return;
    const textElement: SVGTextElement = element;
    let active = true;

    function measure(): void {
      if (!active) return;
      const measured = textElement.getBBox();
      const bounds = {
        x: measured.x,
        y: measured.y,
        width: measured.width,
        height: measured.height,
      };
      if (sameBounds(lastBoundsRef.current, bounds)) return;
      lastBoundsRef.current = bounds;
      onBoundsChangeRef.current?.(bounds);
    }

    measure();
    const observer = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(measure);
    observer?.observe(textElement);
    void document.fonts?.ready.then(measure);
    return () => {
      active = false;
      observer?.disconnect();
    };
  }, [
    className,
    fontFamily,
    fontSize,
    fontWeight,
    lineHeight,
    reportsBounds,
    style,
    text,
    textAnchor,
  ]);

  return (
    <text
      ref={textRef}
      {...uiAssetAttributes({
        namespace: "human2ai",
        id: "canvas-text",
        name: "CanvasText",
        category: "module",
        origin: "project",
        status: "candidate",
      })}
      className={classes}
      data-line-count={lines.length}
      x={0}
      y={0}
      fontSize={fontSize}
      fontFamily={fontFamily}
      fontWeight={fontWeight}
      fill={fill}
      opacity={opacity}
      textAnchor={textAnchor}
      dominantBaseline="text-before-edge"
      xmlSpace="preserve"
      style={style}
      role="img"
      aria-label={ariaLabel}
    >
      {lines.map((line, index) => (
        <tspan key={index} x={0} dy={index === 0 ? 0 : `${lineHeight}em`}>
          {line || "\u00a0"}
        </tspan>
      ))}
    </text>
  );
}

function sameBounds(
  current: CanvasTextBounds | null,
  next: CanvasTextBounds,
): boolean {
  return Boolean(
    current
    && Math.abs(current.x - next.x) < 0.01
    && Math.abs(current.y - next.y) < 0.01
    && Math.abs(current.width - next.width) < 0.01
    && Math.abs(current.height - next.height) < 0.01,
  );
}
