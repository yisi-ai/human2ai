export interface CanvasFrameSize { width: number; height: number }
export interface CanvasFrameBounds extends CanvasFrameSize { x: number; y: number }

export const MINIMUM_CANVAS_FRAME_SIZE = 10;
export const DEFAULT_CANVAS_FRAME: Readonly<CanvasFrameBounds> = Object.freeze({ x: 0, y: 0, width: 960, height: 560 });

/** Pointer edits use the UI editor's integer pixel bounds. */
export function canvasFrameAtBounds(bounds: CanvasFrameBounds): CanvasFrameBounds {
  return {
    x: Math.round(bounds.x), y: Math.round(bounds.y),
    width: Math.max(MINIMUM_CANVAS_FRAME_SIZE, Math.round(bounds.width)),
    height: Math.max(MINIMUM_CANVAS_FRAME_SIZE, Math.round(bounds.height)),
  };
}

/** Numeric edits keep the center; incomplete or too-small input is not committed. */
export function resizeCanvasFrame(frame: CanvasFrameBounds, size: CanvasFrameSize): CanvasFrameBounds {
  const width = Math.round(size.width), height = Math.round(size.height);
  if (!Number.isFinite(width) || !Number.isFinite(height)
    || width < MINIMUM_CANVAS_FRAME_SIZE || height < MINIMUM_CANVAS_FRAME_SIZE) return frame;
  if (width === frame.width && height === frame.height) return frame;
  return { x: frame.x + (frame.width - width) / 2, y: frame.y + (frame.height - height) / 2, width, height };
}

export function canvasFrameForRatio(frame: CanvasFrameBounds, ratio: CanvasFrameSize): CanvasFrameBounds {
  return resizeCanvasFrame(frame, { width: frame.width, height: frame.width * ratio.height / ratio.width });
}
