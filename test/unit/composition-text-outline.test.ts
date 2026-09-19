import { describe, expect, it } from "vitest";
import {
  COMPOSITION_CANVAS, addArea, addTextRegion, areaGeometry, copyCompositionItems,
  createCompositionState, createDraft, draftFingerprint, moveItem, moveTextRegionCorner,
  pasteCompositionItems, renderCompositionReferenceSvg, resizeArea, resizeFreeArea,
  rotateArea, selectCompositionState, setAreaAspect, validateDraft,
  type CompositionDraft,
} from "../../src/domain/composition/index.ts";

function rectangle() {
  const { draft, id } = addTextRegion(createDraft(), { x: 0.5, y: 0.5 });
  return resizeFreeArea(draft, id, 0.4, 0.3);
}
function points(draft: CompositionDraft) {
  const geometry = areaGeometry(draft.areas[0], COMPOSITION_CANVAS);
  if (geometry.type !== "polygon") throw new Error("Expected a polygon");
  return geometry.points;
}

describe("composition text outlines", () => {
  it("moves one corner and keeps the other three fixed, including rotated nodes", () => {
    for (const rotation of [0, 32]) {
      const original = rotateArea(rectangle(), "area-1", rotation);
      const before = points(original);
      const target = { x: (before[0].x + 60) / 1200, y: (before[0].y + 30) / 800 };
      const edited = moveTextRegionCorner(original, "area-1", 0, target);
      points(edited).forEach((point, index) => {
        expect(point.x).toBeCloseTo(index === 0 ? target.x * 1200 : before[index].x, 8);
        expect(point.y).toBeCloseTo(index === 0 ? target.y * 800 : before[index].y, 8);
      });
      expect(edited.areas[0].corners).toHaveLength(4);
      expect(original.areas[0].corners).toBeUndefined();
      expect(validateDraft(JSON.parse(JSON.stringify(edited)))).toEqual(edited);
    }
  });

  it("rejects crossing, collapsed and non-text outlines", () => {
    const draft = rectangle();
    expect(moveTextRegionCorner(draft, "area-1", 0, { x: 0.8, y: 0.8 })).toEqual(draft);
    expect(moveTextRegionCorner(draft, "area-1", 0, { x: 0.7, y: 0.35 })).toEqual(draft);
    const bad = { ...draft, areas: [{ ...draft.areas[0], corners: [
      { x: 0, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 0 }, { x: 0, y: 1 },
    ] }] };
    expect(() => validateDraft(bad)).toThrow();
    expect(() => validateDraft({ ...draft, areas: [{ ...draft.areas[0], corners: [
      { x: 0.1, y: 0 }, { x: 0.9, y: 0 }, { x: 0.9, y: 1 }, { x: 0.1, y: 1 },
    ] }] })).toThrow();
    const shape = addArea(createDraft(), { primitive: "quadrilateral" }).draft;
    expect(() => validateDraft({ ...shape, areas: [{ ...shape.areas[0], corners: bad.areas[0].corners }] })).toThrow();
  });

  it("allows outward corner movement and expands the bounding box without moving other corners", () => {
    const draft = rotateArea(rectangle(), "area-1", 25);
    const before = points(draft);
    const target = { x: (before[0].x - 60) / 1200, y: (before[0].y - 50) / 800 };
    const edited = moveTextRegionCorner(draft, "area-1", 0, target);
    expect(edited.areas[0].width).toBeGreaterThan(draft.areas[0].width!);
    points(edited).slice(1).forEach((point, index) => {
      expect(point.x).toBeCloseTo(before[index + 1].x, 8);
      expect(point.y).toBeCloseTo(before[index + 1].y, 8);
    });
  });

  it("keeps normalized corners through move, scale, rotation and clipboard paste", () => {
    const edited = moveTextRegionCorner(rectangle(), "area-1", 0, { x: 0.4, y: 0.35 });
    const area = edited.areas[0];
    expect(area.area).toBeCloseTo(0.105);
    const scaled = resizeFreeArea(edited, "area-1", 0.8, 0.6);
    expect(scaled.areas[0].area).toBeCloseTo(area.area * 4);
    const proportional = resizeArea(edited, "area-1", area.area * 4);
    expect(proportional.areas[0].width).toBeCloseTo(0.8);
    const moved = rotateArea(moveItem(scaled, "area-1", { x: -0.2, y: 1.2 }), "area-1", 45);
    expect(moved.areas[0].corners).toEqual(area.corners);
    const pasted = pasteCompositionItems(moved, copyCompositionItems(moved, ["area-1"]), { x: 0.1, y: 0.1 });
    expect(pasted.draft.areas[1].corners).toEqual(area.corners);
    expect(validateDraft(setAreaAspect(edited, "area-1", "square")).areas[0].corners).toBeUndefined();
  });

  it("stores corners per layout and fingerprints shape changes with the same bounds and area", () => {
    const original = createCompositionState(rectangle(), "state-1", "second");
    const edited = validateDraft(moveTextRegionCorner(original, "area-1", 0, { x: 0.4, y: 0.35 }));
    const first = selectCompositionState(edited, "state-1");
    expect(first.areas[0].corners).toBeUndefined();
    expect(selectCompositionState(first, "second").areas[0].corners).toEqual(edited.areas[0].corners);
    const left = moveTextRegionCorner(rectangle(), "area-1", 0, { x: 0.4, y: 0.35 });
    const right = moveTextRegionCorner(rectangle(), "area-1", 1, { x: 0.6, y: 0.35 });
    expect(right.areas[0].area).toBeCloseTo(left.areas[0].area);
    expect(right.areas[0].width).toEqual(left.areas[0].width);
    expect(right.areas[0].height).toEqual(left.areas[0].height);
    expect(draftFingerprint(right)).not.toBe(draftFingerprint(left));
  });

  it("renders the custom silhouette and fitted text marks in the reference image", () => {
    const edited = moveTextRegionCorner(rectangle(), "area-1", 0, { x: 0.4, y: 0.35 });
    const svg = renderCompositionReferenceSvg(edited);
    expect(svg).toContain('data-reference-role="text-outline"');
    expect(svg).toContain('points="480,280 840,280 840,520 360,520"');
    expect(svg).toContain('data-reference-role="typography"');
    expect(svg.match(/<line /g)).toHaveLength(3);
  });
});
