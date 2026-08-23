import { describe, expect, it } from "vitest";
import {
  addArea,
  addDirectionLine,
  addFocus,
  areaGeometry,
  changeFrame,
  createDraft,
  directionLineGeometry,
  moveItem,
  removeItem,
  resizeArea,
  resizeFreeArea,
  rotateArea,
  rotateDirectionLine,
  setAreaAspect,
  validateDraft,
  visibleAreaMetrics,
  type CompositionDraft,
  type Point,
  type PolygonGeometry,
} from "../../src/domain/composition/index.js";

describe("composition draft v1", () => {
  it("creates a canonical empty draft and rejects invalid frames", () => {
    expect(createDraft()).toEqual({
      version: 1,
      kind: "composition-draft",
      frame: { width: 1200, height: 800 },
      focusPoints: [],
      directionLine: null,
      areas: [],
    });

    expect(() => createDraft({ width: 4096, height: 256 })).toThrow(/aspect ratio/i);
    expect(() => changeFrame(createDraft(), { width: 255, height: 256 })).toThrow(/256 to 4096/i);
  });

  it("keeps commands immutable and limits focus points to three", () => {
    const empty = createDraft();
    let draft = empty;

    for (const point of [
      { x: 0.25, y: 0.25 },
      { x: 0.5, y: 0.5 },
      { x: 0.75, y: 0.75 },
    ]) {
      draft = addFocus(draft, point).draft;
    }

    expect(empty.focusPoints).toEqual([]);
    expect(draft.focusPoints).toHaveLength(3);
    expect(() => addFocus(draft, { x: 0.4, y: 0.4 })).toThrow(/at most 3/i);
  });

  it("supports one movable and rotatable direction line without changing area metrics", () => {
    let draft = addArea(createDraft(), {
      primitive: "quadrilateral",
      aspect: "free",
      area: 0.1,
    }).draft;
    const metricsBefore = visibleAreaMetrics(draft);

    const added = addDirectionLine(draft);
    draft = moveItem(added.draft, added.id, { x: 1.4, y: -0.2 });
    draft = rotateDirectionLine(draft, added.id, 725);

    expect(draft.directionLine).toEqual({
      id: "direction-1",
      x: 1,
      y: 0,
      rotation: 5,
    });
    expect(() => addDirectionLine(draft)).toThrow(/at most one/i);
    expect(visibleAreaMetrics(draft)).toEqual(metricsBefore);

    const geometry = directionLineGeometry(draft.directionLine!, draft.frame);
    expect(distance(geometry.start, geometry.end)).toBeGreaterThan(
      2 * Math.hypot(draft.frame.width, draft.frame.height),
    );
    expect(removeItem(draft, added.id).directionLine).toBeNull();
  });

  it("preserves the exact area of supported primitives", () => {
    let draft = createDraft();
    for (const [primitive, aspect] of [
      ["circle", "square"],
      ["triangle", "square"],
      ["quadrilateral", "square"],
      ["quadrilateral", "free"],
    ] as const) {
      draft = addArea(draft, { primitive, aspect, area: 0.08 }).draft;
    }

    for (const area of draft.areas) {
      const geometry = areaGeometry(area, draft.frame);
      const expectedArea = area.area * draft.frame.width * draft.frame.height;
      const actualArea =
        geometry.type === "circle"
          ? Math.PI * geometry.radius ** 2
          : polygonArea(geometry.points);
      expect(round(actualArea)).toBe(round(expectedArea));
    }

    const triangle = draft.areas.find(({ primitive }) => primitive === "triangle")!;
    const triangleGeometry = expectPolygon(areaGeometry(triangle, draft.frame));
    const triangleSides = triangleGeometry.points.map((point, index) =>
      distance(point, triangleGeometry.points[(index + 1) % triangleGeometry.points.length]),
    );
    expect(triangleSides.every((side) => Math.abs(side - triangleSides[0]) < 1e-6)).toBe(true);
  });

  it("keeps quadrilateral edges perpendicular after rotation", () => {
    const added = addArea(createDraft(), {
      primitive: "quadrilateral",
      aspect: "free",
      area: 0.08,
    });
    const rotated = rotateArea(added.draft, added.id, 33);
    const geometry = expectPolygon(
      areaGeometry(rotated.areas.find(({ id }) => id === added.id)!, rotated.frame),
    );
    const firstEdge = vector(geometry.points[0], geometry.points[1]);
    const secondEdge = vector(geometry.points[1], geometry.points[2]);

    expect(Math.abs(firstEdge.x * secondEdge.x + firstEdge.y * secondEdge.y)).toBeLessThan(1e-6);
  });

  it("allows unbounded positive area resizing and free quadrilateral dimensions", () => {
    let draft = addArea(createDraft(), {
      primitive: "circle",
      aspect: "square",
    }).draft;
    const circleId = draft.areas[0].id;

    draft = resizeArea(draft, circleId, 2.5);
    expect(draft.areas[0].area).toBe(2.5);
    draft = resizeArea(draft, circleId, 0.0001);
    expect(draft.areas[0].area).toBe(0.0001);
    expect(rotateArea(draft, circleId, 123).areas[0].rotation).toBe(0);

    const rectangle = addArea(draft, {
      primitive: "quadrilateral",
      aspect: "free",
    });
    const resized = resizeFreeArea(rectangle.draft, rectangle.id, 4, 3);
    const area = resized.areas.find(({ id }) => id === rectangle.id)!;
    expect({ width: area.width, height: area.height, area: area.area }).toEqual({
      width: 4,
      height: 3,
      area: 12,
    });
  });

  it("keeps at least part of an area visible outside the frame", () => {
    const added = addArea(createDraft(), {
      primitive: "circle",
      aspect: "square",
      area: 0.08,
    });
    const draft = moveItem(added.draft, added.id, { x: -0.4, y: 0.5 });
    const geometry = areaGeometry(draft.areas[0], draft.frame);
    if (geometry.type !== "circle") throw new Error("Expected circle geometry.");

    expect(draft.areas[0].x).toBeLessThan(0);
    expect(geometry.cx - geometry.radius).toBeLessThan(0);
    expect(geometry.cx + geometry.radius).toBeGreaterThan(0);

    const metrics = visibleAreaMetrics(draft);
    expect(metrics.visibleAreaShares[0]).toBeLessThan(metrics.theoreticalArea);
    expect(metrics.clippedArea).toBeGreaterThan(0);
    expect(metrics.occupiedArea).toBeLessThanOrEqual(1);
  });

  it("normalizes legacy drafts while rejecting unknown fields and duplicate IDs", () => {
    const circle = addArea(createDraft(), {
      primitive: "circle",
      aspect: "square",
    });
    const rectangle = addArea(circle.draft, {
      primitive: "quadrilateral",
      aspect: "free",
    });
    const legacy = structuredClone(rectangle.draft) as Omit<CompositionDraft, "directionLine"> & {
      directionLine?: CompositionDraft["directionLine"];
    };
    delete legacy.directionLine;
    legacy.areas[0].rotation = 81;
    legacy.areas[1].aspect = "portrait";
    delete legacy.areas[1].width;
    delete legacy.areas[1].height;

    const normalized = validateDraft(legacy);
    expect(normalized.directionLine).toBeNull();
    expect(normalized.areas[0].rotation).toBe(0);
    expect(normalized.areas[1].aspect).toBe("free");
    expect(normalized.areas[1].width).toBeGreaterThan(0);
    expect(normalized.areas[1].height).toBeGreaterThan(0);

    const unknownField = structuredClone(normalized);
    Object.assign(unknownField.areas[0], { angle: 30 });
    expect(() => validateDraft(unknownField)).toThrow(/angle/);

    const duplicateId = structuredClone(normalized);
    duplicateId.areas[1].id = duplicateId.areas[0].id;
    expect(() => validateDraft(duplicateId)).toThrow(/duplicate/i);
  });

  it("changes frame and area aspect without mutating the input", () => {
    const added = addArea(createDraft(), {
      primitive: "quadrilateral",
      aspect: "square",
      area: 0.1,
    });
    const free = setAreaAspect(added.draft, added.id, "free");
    const resizedFrame = changeFrame(free, { width: 800, height: 1200 });

    expect(added.draft.areas[0].aspect).toBe("square");
    expect(free.areas[0].width).toBeGreaterThan(0);
    expect(resizedFrame.frame).toEqual({ width: 800, height: 1200 });
  });
});

function expectPolygon(geometry: ReturnType<typeof areaGeometry>): PolygonGeometry {
  if (geometry.type !== "polygon") throw new Error("Expected polygon geometry.");
  return geometry;
}

function round(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

function polygonArea(points: Point[]): number {
  return (
    Math.abs(
      points.reduce((sum, point, index) => {
        const next = points[(index + 1) % points.length];
        return sum + point.x * next.y - next.x * point.y;
      }, 0),
    ) / 2
  );
}

function distance(first: Point, second: Point): number {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

function vector(first: Point, second: Point): Point {
  return { x: second.x - first.x, y: second.y - first.y };
}
