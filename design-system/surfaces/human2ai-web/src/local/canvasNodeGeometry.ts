export interface CanvasNodePoint {
  x: number;
  y: number;
}

export interface CanvasNodeBounds extends CanvasNodePoint {
  width: number;
  height: number;
}

export const CANVAS_NODE_RESIZE_HANDLES = [
  "top-left",
  "top",
  "top-right",
  "right",
  "bottom-right",
  "bottom",
  "bottom-left",
  "left",
] as const;

export type CanvasNodeResizeHandle = (typeof CANVAS_NODE_RESIZE_HANDLES)[number];

export interface ResizeCanvasNodeBoundsOptions {
  bounds: CanvasNodeBounds;
  handle: CanvasNodeResizeHandle;
  pointer: CanvasNodePoint;
  center?: CanvasNodePoint;
  fromCenter?: boolean;
  proportional?: boolean;
  minimumWidth?: number;
  minimumHeight?: number;
}

export interface ResizeCanvasNodeBoundsResult {
  bounds: CanvasNodeBounds;
  scaleX: number;
  scaleY: number;
}

export interface CanvasNodeResizeHandleBoundsOptions {
  bounds: CanvasNodeBounds;
  handle: CanvasNodeResizeHandle;
  hitSize: number;
  screenScale?: number;
}

export function canvasNodeResizeHandleBounds({
  bounds,
  handle,
  hitSize,
  screenScale = 1,
}: CanvasNodeResizeHandleBoundsOptions): CanvasNodeBounds {
  const scale = screenScale > 0 && Number.isFinite(screenScale) ? screenScale : 1;
  const outerInset = Math.max(0, hitSize) / scale / 2;
  const innerInsetX = Math.min(outerInset, bounds.width / 3);
  const innerInsetY = Math.min(outerInset, bounds.height / 3);
  const leftOuter = bounds.x - outerInset;
  const leftInner = bounds.x + innerInsetX;
  const rightInner = bounds.x + bounds.width - innerInsetX;
  const rightOuter = bounds.x + bounds.width + outerInset;
  const topOuter = bounds.y - outerInset;
  const topInner = bounds.y + innerInsetY;
  const bottomInner = bounds.y + bounds.height - innerInsetY;
  const bottomOuter = bounds.y + bounds.height + outerInset;

  if (handle === "top") {
    return rectBetween(leftInner, topOuter, rightInner, topInner);
  }
  if (handle === "right") {
    return rectBetween(rightInner, topInner, rightOuter, bottomInner);
  }
  if (handle === "bottom") {
    return rectBetween(leftInner, bottomInner, rightInner, bottomOuter);
  }
  if (handle === "left") {
    return rectBetween(leftOuter, topInner, leftInner, bottomInner);
  }
  if (handle === "top-left") {
    return rectBetween(leftOuter, topOuter, leftInner, topInner);
  }
  if (handle === "top-right") {
    return rectBetween(rightInner, topOuter, rightOuter, topInner);
  }
  if (handle === "bottom-right") {
    return rectBetween(rightInner, bottomInner, rightOuter, bottomOuter);
  }
  return rectBetween(leftOuter, bottomInner, leftInner, bottomOuter);
}

export function resizeCanvasNodeBounds({
  bounds,
  handle,
  pointer,
  center = {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  },
  fromCenter = false,
  proportional = false,
  minimumWidth = 1,
  minimumHeight = 1,
}: ResizeCanvasNodeBoundsOptions): ResizeCanvasNodeBoundsResult {
  const movesLeft = handle.endsWith("left");
  const movesRight = handle.endsWith("right");
  const movesTop = handle.startsWith("top");
  const movesBottom = handle.startsWith("bottom");
  const movesHorizontally = movesLeft || movesRight;
  const movesVertically = movesTop || movesBottom;
  const right = bounds.x + bounds.width;
  const bottom = bounds.y + bounds.height;
  const minimumScaleX = minimumWidth / bounds.width;
  const minimumScaleY = minimumHeight / bounds.height;

  let scaleX = 1;
  let scaleY = 1;

  if (movesHorizontally) {
    if (fromCenter) {
      const sourceEdge = movesLeft ? bounds.x : right;
      scaleX = positiveScale(
        (pointer.x - center.x) / (sourceEdge - center.x),
        minimumScaleX,
      );
    } else {
      const requestedWidth = movesLeft ? right - pointer.x : pointer.x - bounds.x;
      scaleX = positiveScale(requestedWidth / bounds.width, minimumScaleX);
    }
  }

  if (movesVertically) {
    if (fromCenter) {
      const sourceEdge = movesTop ? bounds.y : bottom;
      scaleY = positiveScale(
        (pointer.y - center.y) / (sourceEdge - center.y),
        minimumScaleY,
      );
    } else {
      const requestedHeight = movesTop ? bottom - pointer.y : pointer.y - bounds.y;
      scaleY = positiveScale(requestedHeight / bounds.height, minimumScaleY);
    }
  }

  if (proportional) {
    const scale = proportionalScale({
      scaleX,
      scaleY,
      movesHorizontally,
      movesVertically,
      minimumScale: Math.max(minimumScaleX, minimumScaleY),
    });
    scaleX = scale;
    scaleY = scale;
  }

  const width = bounds.width * scaleX;
  const height = bounds.height * scaleY;
  const x = fromCenter
    ? center.x + (bounds.x - center.x) * scaleX
    : movesLeft
      ? right - width
      : movesRight
        ? bounds.x
        : bounds.x + (bounds.width - width) / 2;
  const y = fromCenter
    ? center.y + (bounds.y - center.y) * scaleY
    : movesTop
      ? bottom - height
      : movesBottom
        ? bounds.y
        : bounds.y + (bounds.height - height) / 2;

  return { bounds: { x, y, width, height }, scaleX, scaleY };
}

function positiveScale(value: number, minimum: number): number {
  return Number.isFinite(value) ? Math.max(value, minimum) : 1;
}

function rectBetween(
  left: number,
  top: number,
  right: number,
  bottom: number,
): CanvasNodeBounds {
  return {
    x: left,
    y: top,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
}

function proportionalScale({
  scaleX,
  scaleY,
  movesHorizontally,
  movesVertically,
  minimumScale,
}: {
  scaleX: number;
  scaleY: number;
  movesHorizontally: boolean;
  movesVertically: boolean;
  minimumScale: number;
}): number {
  if (!movesHorizontally) return Math.max(scaleY, minimumScale);
  if (!movesVertically) return Math.max(scaleX, minimumScale);
  const dominant = Math.abs(scaleX - 1) >= Math.abs(scaleY - 1) ? scaleX : scaleY;
  return Math.max(dominant, minimumScale);
}
