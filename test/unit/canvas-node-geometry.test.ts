import { describe, expect, it } from "vitest";

import {
  CANVAS_NODE_RESIZE_HANDLES,
  canvasNodeResizeHandleBounds,
  resizeCanvasNodeBounds,
} from "../../design-system/surfaces/human2ai-web/src/local/canvasNodeGeometry.ts";

const sourceBounds = { x: -50, y: -25, width: 100, height: 50 };

describe("canvas node resize geometry", () => {
  it("provides four corner and four edge handles", () => {
    expect(CANVAS_NODE_RESIZE_HANDLES).toHaveLength(8);
    expect(CANVAS_NODE_RESIZE_HANDLES).toEqual([
      "top-left",
      "top",
      "top-right",
      "right",
      "bottom-right",
      "bottom",
      "bottom-left",
      "left",
    ]);
  });

  it("keeps resize hit targets stable in screen pixels", () => {
    const normalCorner = canvasNodeResizeHandleBounds({
      bounds: sourceBounds,
      handle: "top-left",
      hitSize: 24,
      screenScale: 1,
    });
    const zoomedCorner = canvasNodeResizeHandleBounds({
      bounds: sourceBounds,
      handle: "top-left",
      hitSize: 24,
      screenScale: 4,
    });

    expect(normalCorner.width).toBe(24);
    expect(normalCorner.height).toBe(24);
    expect(zoomedCorner.width * 4).toBe(24);
    expect(zoomedCorner.height * 4).toBe(24);
  });

  it("reserves non-overlapping edge targets on a small zoomed node", () => {
    const bounds = { x: -4, y: -4, width: 8, height: 8 };
    const hitBounds = Object.fromEntries(
      CANVAS_NODE_RESIZE_HANDLES.map((handle) => [
        handle,
        canvasNodeResizeHandleBounds({
          bounds,
          handle,
          hitSize: 24,
          screenScale: 4,
        }),
      ]),
    ) as Record<(typeof CANVAS_NODE_RESIZE_HANDLES)[number], typeof bounds>;

    expect(hitBounds.top.width).toBeGreaterThan(0);
    expect(hitBounds.right.height).toBeGreaterThan(0);
    expect(hitBounds.bottom.width).toBeGreaterThan(0);
    expect(hitBounds.left.height).toBeGreaterThan(0);
    expect(hitBounds["top-left"].x + hitBounds["top-left"].width)
      .toBeCloseTo(hitBounds.top.x);
    expect(hitBounds.top.x + hitBounds.top.width)
      .toBeCloseTo(hitBounds["top-right"].x);
    expect(hitBounds["top-left"].y + hitBounds["top-left"].height)
      .toBeCloseTo(hitBounds.left.y);
    expect(hitBounds.left.y + hitBounds.left.height)
      .toBeCloseTo(hitBounds["bottom-left"].y);
  });

  it("resizes freely while keeping the opposite corner fixed", () => {
    const result = resizeCanvasNodeBounds({
      bounds: sourceBounds,
      handle: "top-left",
      pointer: { x: -80, y: -40 },
    });

    expect(result.bounds).toEqual({ x: -80, y: -40, width: 130, height: 65 });
    expect(result.bounds.x + result.bounds.width).toBe(50);
    expect(result.bounds.y + result.bounds.height).toBe(25);
  });

  it("resizes one axis from an edge and fixes the opposite edge", () => {
    const result = resizeCanvasNodeBounds({
      bounds: sourceBounds,
      handle: "right",
      pointer: { x: 100, y: 200 },
    });

    expect(result.bounds).toEqual({ x: -50, y: -25, width: 150, height: 50 });
  });

  it("uses the dominant drag axis for proportional Shift resizing", () => {
    const result = resizeCanvasNodeBounds({
      bounds: sourceBounds,
      handle: "bottom-right",
      pointer: { x: 100, y: 80 },
      proportional: true,
    });

    expect(result.scaleX).toBe(result.scaleY);
    expect(result.bounds.width / result.bounds.height).toBe(2);
    expect(result.bounds.x).toBe(-50);
    expect(result.bounds.y).toBe(-25);
  });

  it("uses the node center for Alt resizing", () => {
    const result = resizeCanvasNodeBounds({
      bounds: sourceBounds,
      handle: "right",
      pointer: { x: 80, y: 0 },
      center: { x: 0, y: 0 },
      fromCenter: true,
    });

    expect(result.bounds).toEqual({ x: -80, y: -25, width: 160, height: 50 });
  });

  it("combines Alt center anchoring with Shift proportional resizing", () => {
    const result = resizeCanvasNodeBounds({
      bounds: sourceBounds,
      handle: "bottom",
      pointer: { x: 0, y: 50 },
      center: { x: 0, y: 0 },
      fromCenter: true,
      proportional: true,
    });

    expect(result.bounds).toEqual({ x: -100, y: -50, width: 200, height: 100 });
  });
});
