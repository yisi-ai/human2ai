import type {
  CompositionFrame,
  CompositionFrameBounds,
  CompositionFrameCorner,
  CompositionFrameSize,
  Point,
} from "./types.ts";

export const COMPOSITION_CANVAS = Object.freeze({ width: 1200, height: 800 });
export const DEFAULT_COMPOSITION_FRAME = Object.freeze({ width: 1600, height: 900 });

const DEFAULT_FRAME_INSET = 0.08;
const MINIMUM_FRAME_EDGE = 96;
const TARGET_FRAME_LONG_EDGE = 1600;
export const MINIMUM_COMPOSITION_FRAME_RATIO = 0.5;
export const MAXIMUM_COMPOSITION_FRAME_RATIO = 2;

export function createCompositionFrame(
  size: CompositionFrameSize = DEFAULT_COMPOSITION_FRAME,
): CompositionFrame {
  return { ...size, bounds: fitFrameBounds(size, DEFAULT_FRAME_INSET) };
}

export function compositionFrameSizeForRatio(
  width: number,
  height: number,
): CompositionFrameSize {
  const multiplier = Math.max(1, Math.floor(TARGET_FRAME_LONG_EDGE / Math.max(width, height)));
  return {
    width: Math.round(width * multiplier),
    height: Math.round(height * multiplier),
  };
}

export function isCompositionFrameRatioSupported(width: number, height: number): boolean {
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
    return false;
  }
  const ratio = width / height;
  return ratio >= MINIMUM_COMPOSITION_FRAME_RATIO
    && ratio <= MAXIMUM_COMPOSITION_FRAME_RATIO;
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
    MINIMUM_FRAME_EDGE / geometry.width,
    MINIMUM_FRAME_EDGE / geometry.height,
  );
  const scale = Math.max(requestedScale, minimumScale);
  const width = geometry.width * scale;
  const height = geometry.height * scale;
  const x = corner.endsWith("left") ? right - width : geometry.x;
  const y = corner.startsWith("top") ? bottom - height : geometry.y;
  return {
    ...frame,
    bounds: {
      x: x / COMPOSITION_CANVAS.width,
      y: y / COMPOSITION_CANVAS.height,
      width: width / COMPOSITION_CANVAS.width,
      height: height / COMPOSITION_CANVAS.height,
    },
  };
}

export function resizeCompositionFrameToBounds(
  frame: CompositionFrame,
  bounds: CompositionFrameBounds,
): CompositionFrame {
  const pixelWidth = bounds.width;
  const pixelHeight = bounds.height;
  if (pixelWidth < MINIMUM_FRAME_EDGE || pixelHeight < MINIMUM_FRAME_EDGE) return frame;
  const ratio = pixelWidth / pixelHeight;
  if (!isCompositionFrameRatioSupported(pixelWidth, pixelHeight)) return frame;

  const minimumLongEdge = ratio >= 1 ? 256 * ratio : 256 / ratio;
  const longEdge = Math.min(4096, Math.max(frame.width, frame.height, minimumLongEdge));
  const size = ratio >= 1
    ? { width: Math.round(longEdge), height: Math.round(longEdge / ratio) }
    : { width: Math.round(longEdge * ratio), height: Math.round(longEdge) };

  return {
    ...size,
    bounds: {
      x: bounds.x / COMPOSITION_CANVAS.width,
      y: bounds.y / COMPOSITION_CANVAS.height,
      width: bounds.width / COMPOSITION_CANVAS.width,
      height: bounds.height / COMPOSITION_CANVAS.height,
    },
  };
}

export function changeCompositionFrameSize(
  frame: CompositionFrame,
  size: CompositionFrameSize,
): CompositionFrame {
  const source = frameBoundsInCanvas(frame);
  const ratio = size.width / size.height;
  const center = {
    x: source.x + source.width / 2,
    y: source.y + source.height / 2,
  };
  const area = source.width * source.height;
  const width = Math.sqrt(area * ratio);
  const height = width / ratio;
  const x = center.x - width / 2;
  const y = center.y - height / 2;
  return {
    ...size,
    bounds: {
      x: x / COMPOSITION_CANVAS.width,
      y: y / COMPOSITION_CANVAS.height,
      width: width / COMPOSITION_CANVAS.width,
      height: height / COMPOSITION_CANVAS.height,
    },
  };
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
