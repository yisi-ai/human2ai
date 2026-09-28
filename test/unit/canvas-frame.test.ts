import { describe, expect, it } from "vitest";
import { DEFAULT_CANVAS_FRAME, canvasFrameAtBounds, canvasFrameForRatio, resizeCanvasFrame } from "../../src/domain/canvas-frame.ts";
import { createDraft, frameBoundsInCanvas, resizeFrameToBounds, validateDraft } from "../../src/domain/composition/index.ts";
import { createUiSketchDraft } from "../../src/domain/ui-sketch/index.ts";

describe("shared output frames", () => {
  it("uses the UI default in both domains", () => {
    expect(frameBoundsInCanvas(createDraft().frame)).toEqual(DEFAULT_CANVAS_FRAME);
    expect(createUiSketchDraft().frame).toEqual(DEFAULT_CANVAS_FRAME);
  });
  it("keeps the center for numeric pixel sizes without an aspect or maximum restriction", () => {
    const frame = resizeCanvasFrame(DEFAULT_CANVAS_FRAME, { width: 9000, height: 11 });
    expect(frame).toEqual({ x: -4020, y: 274.5, width: 9000, height: 11 });
    const composition = validateDraft(resizeFrameToBounds(createDraft(), frame));
    const bounds = frameBoundsInCanvas(composition.frame);
    for (const key of ["x", "y", "width", "height"] as const) expect(bounds[key]).toBeCloseTo(frame[key]);
    expect(composition.frame).toMatchObject({ width: 9000, height: 11 });
  });
  it("retains width for presets and applies the same integer minimum to pointer edits", () => {
    expect(canvasFrameForRatio(DEFAULT_CANVAS_FRAME, { width: 1, height: 3 })).toEqual({ x: 0, y: -1160, width: 960, height: 2880 });
    expect(canvasFrameAtBounds({ x: 1.6, y: -2.6, width: 5, height: 20.7 })).toEqual({ x: 2, y: -3, width: 10, height: 21 });
    expect(resizeCanvasFrame(DEFAULT_CANVAS_FRAME, { width: 9, height: 560 })).toBe(DEFAULT_CANVAS_FRAME);
  });
  it("does not rewrite the geometry or dimensions of an existing saved frame on read", () => {
    const draft = createDraft();
    draft.frame = { width: 1600, height: 900, bounds: { x: 0.08, y: 0.145625, width: 0.84, height: 0.70875 } };
    expect(validateDraft(draft).frame).toEqual(draft.frame);
  });
});
