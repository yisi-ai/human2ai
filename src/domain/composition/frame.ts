import { DEFAULT_CANVAS_FRAME, MINIMUM_CANVAS_FRAME_SIZE, canvasFrameAtBounds, canvasFrameForRatio, resizeCanvasFrame } from "../canvas-frame.ts";
import type {
  CompositionFrame,
  CompositionFrameBounds,
  CompositionFrameCorner,
  CompositionFrameSize,
  Point,
} from "./types.ts";

export const COMPOSITION_CANVAS = Object.freeze({ width: 1200, height: 800 });
export const DEFAULT_COMPOSITION_FRAME = DEFAULT_CANVAS_FRAME;

const DEFAULT_FRAME_INSET = 0.08;

export function createCompositionFrame(
  size: CompositionFrameSize = DEFAULT_COMPOSITION_FRAME,
): CompositionFrame {
  return frameFromBounds({ ...DEFAULT_CANVAS_FRAME, ...size });
}

/** Only old drafts without explicit bounds use the former fitted coordinate system. */
export function legacyCompositionFrame(size: CompositionFrameSize): CompositionFrame {
  return { ...size, bounds: fitFrameBounds(size, DEFAULT_FRAME_INSET) };
}

export function compositionFrameSizeForRatio(width: number, height: number): CompositionFrameSize {
  const frame = canvasFrameForRatio(DEFAULT_CANVAS_FRAME, { width, height });
  return { width: frame.width, height: frame.height };
}

function frameFromBounds(bounds: CompositionFrameBounds): CompositionFrame {
  return {
    width: bounds.width, height: bounds.height,
    bounds: { x: bounds.x / COMPOSITION_CANVAS.width, y: bounds.y / COMPOSITION_CANVAS.height,
      width: bounds.width / COMPOSITION_CANVAS.width, height: bounds.height / COMPOSITION_CANVAS.height },
  };
}

export function frameBoundsInCanvas(frame: CompositionFrame): CompositionFrameBounds {
  return {
    x: frame.bounds.x * COMPOSITION_CANVAS.width,
    y: frame.bounds.y * COMPOSITION_CANVAS.height,
    width: frame.bounds.width * COMPOSITION_CANVAS.width,
    height: frame.bounds.height * COMPOSITION_CANVAS.height,
  };
}

export function compositionSymmetryRotations(frame: CompositionFrameSize): number[] {
  const corner = Math.atan2(frame.height, frame.width) * 180 / Math.PI;
  return [...Array.from({ length: 8 }, (_, index) => index * 45), corner, 180 - corner, 180 + corner, 360 - corner]
    .sort((a, b) => a - b)
    .filter((angle, index, angles) => index === 0 || Math.abs(angle - angles[index - 1]) > 1e-8);
}

export function compositionWorldSize(
  frame: CompositionFrame,
  minimumSize: CompositionFrameSize = COMPOSITION_CANVAS,
): CompositionFrameSize {
  const bounds = compositionWorldBounds(frame, minimumSize);
  return {
    width: bounds.width,
    height: bounds.height,
  };
}

export function compositionWorldBounds(
  frame: CompositionFrame,
  minimumSize: CompositionFrameSize = COMPOSITION_CANVAS,
): CompositionFrameBounds {
  const bounds = frameBoundsInCanvas(frame);
  const minimumX = Math.min(0, bounds.x);
  const minimumY = Math.min(0, bounds.y);
  const maximumX = Math.max(minimumSize.width, bounds.x + bounds.width);
  const maximumY = Math.max(minimumSize.height, bounds.y + bounds.height);
  return {
    x: minimumX,
    y: minimumY,
    width: maximumX - minimumX,
    height: maximumY - minimumY,
  };
}

export function framePointToCanvas(point: Point, frame: CompositionFrame): Point {
  return {
    x: frame.bounds.x + point.x * frame.bounds.width,
    y: frame.bounds.y + point.y * frame.bounds.height,
  };
}

export function canvasPointToFrame(point: Point, frame: CompositionFrame): Point {
  return {
    x: (point.x - frame.bounds.x) / frame.bounds.width,
    y: (point.y - frame.bounds.y) / frame.bounds.height,
  };
}

export function moveCompositionFrame(
  frame: CompositionFrame,
  point: Point,
): CompositionFrame {
  return {
    ...frame,
    bounds: {
      ...frame.bounds,
      x: point.x,
      y: point.y,
    },
  };
}

export function resizeCompositionFrame(
  frame: CompositionFrame,
  requestedScale: number,
  corner: CompositionFrameCorner = "bottom-right",
): CompositionFrame {
  const geometry = frameBoundsInCanvas(frame);
  const right = geometry.x + geometry.width;
  const bottom = geometry.y + geometry.height;
  const minimumScale = Math.max(
    MINIMUM_CANVAS_FRAME_SIZE / geometry.width,
    MINIMUM_CANVAS_FRAME_SIZE / geometry.height,
  );
  const scale = Math.max(requestedScale, minimumScale);
  const width = geometry.width * scale;
  const height = geometry.height * scale;
  const x = corner.endsWith("left") ? right - width : geometry.x;
  const y = corner.startsWith("top") ? bottom - height : geometry.y;
  return frameFromBounds(canvasFrameAtBounds({ x, y, width, height }));
}

/** The shared frame UI supplies pixel bounds; this adapter only converts storage coordinates. */
export function resizeCompositionFrameToBounds(
  _frame: CompositionFrame,
  bounds: CompositionFrameBounds,
): CompositionFrame {
  return frameFromBounds(bounds);
}

export function changeCompositionFrameSize(
  frame: CompositionFrame,
  size: CompositionFrameSize,
): CompositionFrame {
  const bounds = frameBoundsInCanvas(frame);
  const next = resizeCanvasFrame(bounds, size);
  return next === bounds ? frame : frameFromBounds(next);
}

function fitFrameBounds(
  size: CompositionFrameSize,
  inset: number,
): CompositionFrameBounds {
  const availableWidth = COMPOSITION_CANVAS.width * (1 - inset * 2);
  const availableHeight = COMPOSITION_CANVAS.height * (1 - inset * 2);
  const scale = Math.min(availableWidth / size.width, availableHeight / size.height);
  const width = size.width * scale;
  const height = size.height * scale;
  return {
    x: (COMPOSITION_CANVAS.width - width) / 2 / COMPOSITION_CANVAS.width,
    y: (COMPOSITION_CANVAS.height - height) / 2 / COMPOSITION_CANVAS.height,
    width: width / COMPOSITION_CANVAS.width,
    height: height / COMPOSITION_CANVAS.height,
  };
}
