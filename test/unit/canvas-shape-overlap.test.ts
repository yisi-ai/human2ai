import { describe, expect, it, vi } from "vitest";
import { createCanvasShapeOverlap, rectangleOutline } from "../../design-system/surfaces/human2ai-web/src/local/canvasShapeOverlap.ts";
import { compositionOverlapShape } from "../../design-system/surfaces/human2ai-web/src/local/compositionShapeOverlap.ts";
import { addArea, createDraft } from "../../src/domain/composition/index.ts";
import { createCanvasShapeOverlap as domainOverlap, rectangleOutline as domainRectangle } from "../../src/domain/canvas-shape-overlap.ts";

function box(id: string, x: number, y: number, width = 100, height = 100, tone = 0) {
  return { id, tone, geometry: [x, y, width, height], outline: vi.fn(() => rectangleOutline(x, y, width, height)) };
}

describe("same-color inner borders", () => {
  it("uses the same geometry implementation in the editor and exports", () => {
    expect(createCanvasShapeOverlap).toBe(domainOverlap);
    expect(rectangleOutline).toBe(domainRectangle);
  });
  it("marks both partially intersecting shapes, but not touching or different colors", () => {
    const update = createCanvasShapeOverlap();
    expect([...update([box("a", 0, 0), box("b", 50, 50)])]).toEqual(["a", "b"]);
    expect([...update([box("a", 0, 0), box("b", 100, 0)])]).toEqual([]);
    expect([...update([box("a", 0, 0), box("b", 50, 50, 100, 100, 1)])]).toEqual([]);
  });

  it("marks only enclosed shapes, regardless of order, including nested containment", () => {
    const shapes = [box("outer", 0, 0, 200, 200), box("middle", 25, 25), box("inner", 50, 50, 25, 25)];
    for (const ordered of [shapes, [...shapes].reverse()]) {
      expect(createCanvasShapeOverlap()(ordered)).toEqual(new Set(["middle", "inner"]));
    }
  });

  it("treats coincident shapes equally instead of selecting an arbitrary outer one", () => {
    expect(createCanvasShapeOverlap()([box("a", 0, 0), box("b", 0, 0)])).toEqual(new Set(["a", "b"]));
  });

  it("removes only incident relations on deletion without reconstructing surviving outlines", () => {
    const update = createCanvasShapeOverlap();
    const a = box("a", 0, 0), b = box("b", 50, 50), c = box("c", 500, 500);
    update([a, b, c]);
    a.outline.mockClear(); b.outline.mockClear(); c.outline.mockClear();
    expect(update([b, c])).toEqual(new Set());
    expect(b.outline).not.toHaveBeenCalled();
    expect(c.outline).not.toHaveBeenCalled();
    expect(update([a, b, c])).toEqual(new Set(["a", "b"]));
    expect(a.outline).toHaveBeenCalledTimes(1);
  });

  it("updates changed geometry and preserves independent overlap relations", () => {
    const update = createCanvasShapeOverlap();
    const c = box("c", 500, 500), d = box("d", 550, 550);
    update([box("a", 0, 0), box("b", 50, 50), c, d]);
    c.outline.mockClear(); d.outline.mockClear();
    expect(update([box("a", 0, 0), box("b", 200, 200), c, d])).toEqual(new Set(["c", "d"]));
    expect(c.outline).not.toHaveBeenCalled(); expect(d.outline).not.toHaveBeenCalled();
  });

  it("uses actual rotated silhouettes rather than intersecting bounding boxes", () => {
    const a = { id: "a", tone: 0, geometry: [], outline: () => [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 100 }] };
    const b = box("b", 80, 80, 10, 10);
    expect(createCanvasShapeOverlap()([a, b])).toEqual(new Set());
  });

  it("adapts rotated ellipses and circles with the same containment rules", () => {
    const outer = addArea(createDraft(), { primitive: "circle", x: 0.5, y: 0.5, area: 0.3 }).draft.areas[0];
    const inner = { ...outer, id: "area-7", area: 0.01, aspect: "free" as const, width: 0.1, height: 0.03, rotation: 45 };
    expect(createCanvasShapeOverlap()([compositionOverlapShape(outer), compositionOverlapShape(inner)])).toEqual(new Set([inner.id]));
  });
});
