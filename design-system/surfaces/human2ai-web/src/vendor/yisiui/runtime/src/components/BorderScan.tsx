"use client";

import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { useEffect, useRef } from "react";

import "../../styles/tokens.css";
import "../../styles/border-scan.css";

import { tokens } from "../tokens/tokens";
import { uiAssetAttributes } from "../internal/uiAssetAttributes";

export const BORDER_SCAN_DIRECTIONS = ["clockwise", "counterclockwise"] as const;

export type BorderScanDirection = (typeof BORDER_SCAN_DIRECTIONS)[number];

export interface BorderScanProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "children" | "color"> {
  children: ReactNode;
  width: number;
  height: number;
  active?: boolean;
  color?: CSSProperties["color"];
  duration?: number;
  lineWidth?: number;
  lineLength?: number;
  borderRadius?: number;
  direction?: BorderScanDirection;
}

type BorderScanStyle = CSSProperties & {
  "--yisiui-border-scan-color"?: CSSProperties["color"];
  "--yisiui-border-scan-line-width"?: string;
};

const EDGE_INSET = 0.5;
const DEFAULT_LINE_RATIO = 0.09;
const MIN_DEFAULT_LINE_LENGTH = 24;
const MAX_DEFAULT_LINE_LENGTH = 120;
const MAX_PATH_LINE_RATIO = 0.45;
const SAMPLE_SPACING = 1.5;

function numericToken(name: keyof typeof tokens): number {
  return Number.parseFloat(String(tokens[name]));
}

const DEFAULT_LINE_WIDTH = numericToken("component.borderScan.lineWidth");
const DEFAULT_DURATION = numericToken("component.borderScan.duration");
const DEFAULT_BORDER_RADIUS = numericToken("component.card.radius");

function finiteNumber(value: number, name: string, minimum: number, allowMinimum: boolean): number {
  const validBoundary = allowMinimum ? value >= minimum : value > minimum;
  if (!Number.isFinite(value) || !validBoundary) {
    const comparison = allowMinimum ? "greater than or equal to" : "greater than";
    throw new Error(`BorderScan ${name} must be a finite number ${comparison} ${minimum}.`);
  }
  return value;
}

function resolveLineLength(pathLength: number, requestedLength: number | undefined): number {
  const maximumLength = pathLength * MAX_PATH_LINE_RATIO;
  if (requestedLength !== undefined) {
    return Math.min(requestedLength, maximumLength);
  }

  const proportionalLength = pathLength * DEFAULT_LINE_RATIO;
  return Math.min(
    Math.max(proportionalLength, Math.min(MIN_DEFAULT_LINE_LENGTH, maximumLength)),
    Math.min(MAX_DEFAULT_LINE_LENGTH, maximumLength),
  );
}

function buildRoundedRectPath(width: number, height: number, radius: number): string {
  const left = EDGE_INSET;
  const top = EDGE_INSET;
  const right = width - EDGE_INSET;
  const bottom = height - EDGE_INSET;
  const pathRadius = Math.max(
    0,
    Math.min(radius - EDGE_INSET, (right - left) / 2, (bottom - top) / 2),
  );

  if (pathRadius === 0) {
    return `M ${left} ${top} H ${right} V ${bottom} H ${left} V ${top}`;
  }

  return [
    `M ${left + pathRadius} ${top}`,
    `H ${right - pathRadius}`,
    `A ${pathRadius} ${pathRadius} 0 0 1 ${right} ${top + pathRadius}`,
    `V ${bottom - pathRadius}`,
    `A ${pathRadius} ${pathRadius} 0 0 1 ${right - pathRadius} ${bottom}`,
    `H ${left + pathRadius}`,
    `A ${pathRadius} ${pathRadius} 0 0 1 ${left} ${bottom - pathRadius}`,
    `V ${top + pathRadius}`,
    `A ${pathRadius} ${pathRadius} 0 0 1 ${left + pathRadius} ${top}`,
  ].join(" ");
}

function normalizedDistance(distance: number, pathLength: number): number {
  return ((distance % pathLength) + pathLength) % pathLength;
}

function buildVisibleSegment(
  geometryPath: SVGPathElement,
  pathLength: number,
  lineLength: number,
  headDistance: number,
  direction: BorderScanDirection,
): string {
  const directionSign = direction === "clockwise" ? 1 : -1;
  const sampleCount = Math.max(2, Math.ceil(lineLength / SAMPLE_SPACING));
  const segmentStart = headDistance - directionSign * lineLength;
  const points: string[] = [];

  for (let index = 0; index <= sampleCount; index += 1) {
    const distance = segmentStart + directionSign * lineLength * (index / sampleCount);
    const point = geometryPath.getPointAtLength(normalizedDistance(distance, pathLength));
    points.push(`${index === 0 ? "M" : "L"} ${point.x} ${point.y}`);
  }

  return points.join(" ");
}

export function BorderScan({
  children,
  width,
  height,
  active = true,
  color,
  duration = DEFAULT_DURATION,
  lineWidth = DEFAULT_LINE_WIDTH,
  lineLength,
  borderRadius = DEFAULT_BORDER_RADIUS,
  direction = "clockwise",
  className,
  style,
  ...divProps
}: BorderScanProps) {
  const geometryRef = useRef<SVGPathElement>(null);
  const visibleLineRef = useRef<SVGPathElement>(null);

  const resolvedWidth = finiteNumber(width, "width", 0, false);
  const resolvedHeight = finiteNumber(height, "height", 0, false);
  const resolvedDuration = finiteNumber(duration, "duration", 0, false);
  const resolvedLineWidth = finiteNumber(lineWidth, "lineWidth", 0, false);
  const resolvedBorderRadius = finiteNumber(borderRadius, "borderRadius", 0, true);
  const resolvedLineLength = lineLength === undefined
    ? undefined
    : finiteNumber(lineLength, "lineLength", 0, false);

  if (!BORDER_SCAN_DIRECTIONS.includes(direction)) {
    throw new Error(`BorderScan direction must be one of: ${BORDER_SCAN_DIRECTIONS.join(", ")}.`);
  }

  const geometryPathData = buildRoundedRectPath(
    resolvedWidth,
    resolvedHeight,
    resolvedBorderRadius,
  );

  useEffect(() => {
    const geometryPath = geometryRef.current;
    const visibleLine = visibleLineRef.current;
    if (!active || !geometryPath || !visibleLine) {
      return;
    }

    const pathLength = geometryPath.getTotalLength();
    const visibleLength = resolveLineLength(pathLength, resolvedLineLength);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let animationFrame = 0;
    let startedAt: number | null = null;

    const drawFrame = (timestamp: number) => {
      if (startedAt === null) {
        startedAt = timestamp;
      }
      const progress = ((timestamp - startedAt) % resolvedDuration) / resolvedDuration;
      const headDistance = (direction === "clockwise" ? progress : -progress) * pathLength;
      visibleLine.setAttribute(
        "d",
        buildVisibleSegment(
          geometryPath,
          pathLength,
          visibleLength,
          headDistance,
          direction,
        ),
      );
      animationFrame = window.requestAnimationFrame(drawFrame);
    };

    const syncMotionPreference = () => {
      if (animationFrame !== 0) {
        window.cancelAnimationFrame(animationFrame);
        animationFrame = 0;
      }
      startedAt = null;
      if (reducedMotion.matches) {
        visibleLine.setAttribute("d", "");
      } else {
        animationFrame = window.requestAnimationFrame(drawFrame);
      }
    };

    syncMotionPreference();
    reducedMotion.addEventListener("change", syncMotionPreference);
    return () => {
      reducedMotion.removeEventListener("change", syncMotionPreference);
      if (animationFrame !== 0) {
        window.cancelAnimationFrame(animationFrame);
      }
    };
  }, [
    active,
    direction,
    geometryPathData,
    resolvedDuration,
    resolvedLineLength,
  ]);

  const rootStyle: BorderScanStyle = {
    ...style,
    width: resolvedWidth,
    height: resolvedHeight,
    ...(color === undefined ? {} : { "--yisiui-border-scan-color": color }),
    "--yisiui-border-scan-line-width": `${resolvedLineWidth}px`,
  };

  return (
    <div
      {...divProps}
      {...uiAssetAttributes("border-scan", "BorderScan", "motion")}
      className={[
        "yisi-border-scan",
        `yisi-border-scan-direction-${direction}`,
        active ? "yisi-border-scan-active" : "yisi-border-scan-inactive",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={rootStyle}
    >
      {children}
      {active ? (
        <svg
          className="yisi-border-scan-overlay"
          viewBox={`0 0 ${resolvedWidth} ${resolvedHeight}`}
          width={resolvedWidth}
          height={resolvedHeight}
          preserveAspectRatio="none"
          aria-hidden="true"
          focusable="false"
        >
          <path
            ref={geometryRef}
            className="yisi-border-scan-geometry"
            d={geometryPathData}
          />
          <path
            ref={visibleLineRef}
            className="yisi-border-scan-line"
            d=""
          />
        </svg>
      ) : null}
    </div>
  );
}
