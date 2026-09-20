import { describe, expect, it } from "vitest";
import {
  COMPOSITION_CANVAS,
  COMPOSITION_TEXT_REGION_SEMANTIC_TYPE,
  addArea,
  addCompositionImage,
  addDirectionLine,
  addFocus,
  addTextRegion,
  areaGeometry,
  changeFrame,
  compositionDraftWorldBounds,
  compositionDraftWorldSize,
  compositionFrameSizeForRatio,
  compositionWorldBounds,
  compositionWorldSize,
  copyCompositionItems,
  createDraft,
  directionLineGeometry,
  frameBoundsInCanvas,
  isCompositionTextRegion,
  moveFrame,
  moveItem,
  pasteCompositionItems,
  removeItem,
  resizeArea,
  resizeCompositionImage,
  resizeFreeArea,
  resizeFrame,
  resizeFrameToBounds,
  rotateArea,
  rotateCompositionImage,
  rotateDirectionLine,
  renderCompositionSvg,
  setAreaAspect,
  setProcessingSemantic,
  updateAreaMetadata,
  updateCompositionImage,
  updateItemMetadata,
  validateDraft,
  visibleAreaMetrics,
  type CompositionDraft,
  type CompositionFrameCorner,
  type Point,
  type PolygonGeometry,
} from "../../src/domain/composition/index.js";

describe("composition draft v1", () => {
  it("creates a canonical empty draft and rejects invalid frames", () => {
    expect(createDraft()).toEqual({
      version: 1,
      kind: "composition-draft",
      processingSemantic: null,
      frame: {
        width: 1600,
        height: 900,
        bounds: { x: 0.08, y: 0.145625, width: 0.84, height: 0.70875 },
      },
      overallNote: "",
      focusPoints: [],
      directionLine: null,
      areas: [],
      images: [],
    });

    expect(() => createDraft({ width: 4096, height: 256 })).toThrow(/aspect ratio/i);
    expect(() => changeFrame(createDraft(), { width: 255, height: 256 })).toThrow(/256 to 4096/i);
  });

  it("stores an optional overall note and normalizes legacy drafts", () => {
    const draft = { ...createDraft(), overallNote: "突出左侧主体，右侧保留留白" };
    expect(validateDraft(draft).overallNote).toBe("突出左侧主体，右侧保留留白");

    const legacy = structuredClone(draft) as Partial<CompositionDraft>;
    delete legacy.overallNote;
    delete legacy.processingSemantic;
    expect(validateDraft(legacy)).toMatchObject({
      overallNote: "",
      processingSemantic: null,
    });
    expect(setProcessingSemantic(draft, "editorial-layout").processingSemantic).toBe(
      "editorial-layout",
    );
  });

  it("creates and edits a non-destructive image node", () => {
    const added = addCompositionImage(createDraft());
    expect(added.id).toBe("image-1");
    expect(added.draft.images[0]).toMatchObject({
      width: 320 / 1200,
      height: 180 / 800,
      rotation: 0,
      assetId: null,
      crop: null,
    });
    let draft = resizeCompositionImage(added.draft, added.id, 0.4, 0.3);
    draft = rotateCompositionImage(draft, added.id, 25);
    draft = updateCompositionImage(draft, added.id, {
      assetId: "asset-1",
      crop: { x: 0.1, y: 0.2, width: 0.7, height: 0.6 },
      visualWeight: "high",
    });
    expect(validateDraft(draft).images[0]).toMatchObject({
      width: 0.4,
      height: 0.3,
      rotation: 25,
      assetId: "asset-1",
      crop: { x: 0.1, y: 0.2, width: 0.7, height: 0.6 },
      visualWeight: "high",
    });
    expect(() => updateCompositionImage(draft, added.id, {
      crop: { x: 0.6, y: 0, width: 0.5, height: 1 },
    })).toThrow(/crop/i);
  });

  it("normalizes decimal custom frame ratios to valid integer output dimensions", () => {
    const size = compositionFrameSizeForRatio(1.85, 1);

    expect(Number.isInteger(size.width)).toBe(true);
    expect(Number.isInteger(size.height)).toBe(true);
    expect(size.width / size.height).toBeCloseTo(1.85, 2);
    expect(changeFrame(createDraft(), size).frame).toMatchObject(size);
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

  it("copies multiple composition items as snapshots and pastes preserved properties", () => {
    let draft = addFocus(createDraft(), { x: 0.2, y: 0.3 }).draft;
    draft = addArea(draft, {
      primitive: "triangle",
      aspect: "free",
      x: 0.4,
      y: 0.5,
      area: 0.08,
      rotation: 27,
    }).draft;
    draft = addCompositionImage(draft, {
      x: 0.6,
      y: 0.7,
      width: 0.24,
      height: 0.18,
      rotation: 16,
    }).draft;
    draft = updateItemMetadata(draft, "focus-1", {
      note: "复制时的焦点",
      shotScale: "foreground",
    });
    draft = updateAreaMetadata(
      updateItemMetadata(draft, "area-1", { note: "复制时的三角形" }),
      "area-1",
      { visualWeight: "high" },
    );
    draft = updateCompositionImage(
      updateItemMetadata(draft, "image-1", { annotation: "复制时的图片" }),
      "image-1",
      {
        assetId: "asset-1",
        crop: { x: 0.1, y: 0.2, width: 0.7, height: 0.6 },
        visualWeight: "medium",
      },
    );
    const clipboard = copyCompositionItems(draft, ["focus-1", "area-1", "image-1"]);
    draft = updateItemMetadata(draft, "focus-1", { note: "复制后被修改" });

    const pasted = pasteCompositionItems(draft, clipboard, { x: 0.02, y: 0.03 });

    expect(pasted.ids).toEqual(["focus-2", "area-2", "image-2"]);
    expect(pasted.draft.focusPoints[1]).toEqual({
      ...clipboard[0]!.item,
      id: "focus-2",
      x: 0.22,
      y: 0.32999999999999996,
    });
    expect(pasted.draft.areas[1]).toEqual({
      ...clipboard[1]!.item,
      id: "area-2",
      x: 0.42000000000000004,
      y: 0.53,
    });
    expect(pasted.draft.images[1]).toEqual({
      ...clipboard[2]!.item,
      id: "image-2",
      x: 0.62,
      y: 0.73,
    });
    expect(draft.focusPoints).toHaveLength(1);
  });

  it("skips only pasted focus points and direction lines that exceed their limits", () => {
    let draft = createDraft();
    for (const point of [
      { x: 0.2, y: 0.2 },
      { x: 0.4, y: 0.4 },
    ]) {
      draft = addFocus(draft, point).draft;
    }
    draft = addArea(draft, { primitive: "circle", x: 0.5, y: 0.5 }).draft;
    draft = addDirectionLine(draft).draft;
    const clipboard = copyCompositionItems(
      draft,
      ["focus-1", "focus-2", "area-1", "direction-1"],
    );

    const pasted = pasteCompositionItems(draft, clipboard, { x: 0.02, y: 0.03 });

    expect(pasted.ids).toEqual(["focus-3", "area-2"]);
    expect(pasted.draft.focusPoints).toHaveLength(3);
    expect(pasted.draft.focusPoints[2]).toMatchObject({ x: 0.22, y: 0.23 });
    expect(pasted.draft.directionLine).toEqual(draft.directionLine);
    expect(pasted.draft.areas).toHaveLength(2);
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
      origin: "user",
      x: 1.4,
      y: -0.2,
      rotation: 5,
      note: "",
      annotation: "",
      semanticType: "",
      shotScale: "auto",
    });
    expect(() => addDirectionLine(draft)).toThrow(/at most one/i);
    expect(visibleAreaMetrics(draft)).toEqual(metricsBefore);

    const geometry = directionLineGeometry(draft.directionLine!, COMPOSITION_CANVAS);
    expect(distance(geometry.start, geometry.end)).toBeGreaterThan(
      2 * Math.hypot(COMPOSITION_CANVAS.width, COMPOSITION_CANVAS.height),
    );
    expect(removeItem(draft, added.id).directionLine).toBeNull();
  });

  it("normalizes and updates Human2AI metadata for every composition node kind", () => {
    let draft = addFocus(createDraft(), { x: 0.3, y: 0.3 }).draft;
    draft = addArea(draft, { primitive: "triangle", area: 0.08 }).draft;
    draft = addDirectionLine(draft).draft;

    for (const id of ["focus-1", "area-1", "direction-1"]) {
      draft = updateItemMetadata(draft, id, {
        note: `${id} 备注`,
        annotation: `${id} 批注`,
        semanticType: `${id} 类型`,
        shotScale: "foreground",
      });
    }

    expect(draft.focusPoints[0]).toMatchObject({
      note: "focus-1 备注",
      annotation: "focus-1 批注",
      semanticType: "focus-1 类型",
      shotScale: "foreground",
    });
    expect(draft.areas[0]).toMatchObject({
      note: "area-1 备注",
      annotation: "area-1 批注",
      semanticType: "area-1 类型",
      shotScale: "foreground",
      visualWeight: "auto",
    });
    expect(draft.directionLine).toMatchObject({
      note: "direction-1 备注",
      annotation: "direction-1 批注",
      semanticType: "direction-1 类型",
      shotScale: "foreground",
    });

    const legacy = structuredClone(draft) as unknown as {
      focusPoints: Array<Record<string, unknown>>;
      directionLine: Record<string, unknown>;
      areas: Array<Record<string, unknown>>;
    };
    for (const item of [legacy.focusPoints[0], legacy.directionLine, legacy.areas[0]]) {
      delete item.note;
      delete item.annotation;
      delete item.semanticType;
      delete item.shotScale;
      delete item.visualWeight;
    }
    expect(validateDraft(legacy).focusPoints[0]).toMatchObject({
      note: "",
      annotation: "",
      semanticType: "",
      shotScale: "auto",
    });
    expect(validateDraft(legacy).areas[0]).toMatchObject({ visualWeight: "auto" });
  });

  it("creates text regions as free quadrilateral areas with a stable semantic marker", () => {
    const shape = addArea(createDraft(), { primitive: "circle", area: 0.04 });
    const textRegion = addTextRegion(shape.draft, {
      x: 0.7,
      y: 0.3,
      area: 0.12,
      rotation: 8,
    });
    const area = textRegion.draft.areas.find(({ id }) => id === textRegion.id)!;

    expect(textRegion.id).toBe("area-2");
    expect(area).toMatchObject({
      primitive: "quadrilateral",
      aspect: "free",
      semanticType: COMPOSITION_TEXT_REGION_SEMANTIC_TYPE,
      x: 0.7,
      y: 0.3,
      area: 0.12,
      rotation: 8,
      note: "",
      shotScale: "auto",
      visualWeight: "auto",
      displayText: "",
    });
    expect(area.width).toBeGreaterThan(0);
    expect(area.height).toBeGreaterThan(0);
    expect(isCompositionTextRegion(area)).toBe(true);
    expect(isCompositionTextRegion(shape.draft.areas[0])).toBe(false);
    expect(textRegion.draft.processingSemantic).toBeNull();

    const described = updateAreaMetadata(textRegion.draft, textRegion.id, {
      displayText: "静观自得",
      visualWeight: "high",
    });
    expect(described.areas.find(({ id }) => id === textRegion.id)).toMatchObject({
      displayText: "静观自得",
      visualWeight: "high",
    });
    expect(() => updateAreaMetadata(shape.draft, shape.id, { displayText: "无效" })).toThrow(
      /only supported by text regions/i,
    );

    const moved = moveItem(textRegion.draft, textRegion.id, { x: 0.4, y: 0.6 });
    const resized = resizeFreeArea(moved, textRegion.id, 0.3, 0.2);
    expect(resized.areas.find(({ id }) => id === textRegion.id)).toMatchObject({
      x: 0.4,
      y: 0.6,
      width: 0.3,
      height: 0.2,
    });
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
      const geometry = areaGeometry(area, COMPOSITION_CANVAS);
      const expectedArea = area.area * COMPOSITION_CANVAS.width * COMPOSITION_CANVAS.height;
      const actualArea =
        geometry.type === "circle"
          ? Math.PI * geometry.radius ** 2
          : geometry.type === "ellipse"
            ? Math.PI * geometry.radiusX * geometry.radiusY
            : polygonArea(geometry.points);
      expect(round(actualArea)).toBe(round(expectedArea));
    }

    const triangle = draft.areas.find(({ primitive }) => primitive === "triangle")!;
    const triangleGeometry = expectPolygon(areaGeometry(triangle, COMPOSITION_CANVAS));
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
      areaGeometry(rotated.areas.find(({ id }) => id === added.id)!, COMPOSITION_CANVAS),
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

  it("supports free circle and triangle dimensions", () => {
    const circle = addArea(createDraft(), {
      primitive: "circle",
      aspect: "square",
    });
    const resizedCircle = resizeFreeArea(circle.draft, circle.id, 0.2, 0.1);
    const circleArea = resizedCircle.areas[0];
    const circleGeometry = areaGeometry(circleArea, COMPOSITION_CANVAS);

    expect(circleArea.aspect).toBe("free");
    expect(circleArea.area).toBeCloseTo(0.2 * 0.1 * Math.PI / 4);
    expect(circleGeometry.type).toBe("ellipse");

    const triangle = addArea(resizedCircle, {
      primitive: "triangle",
      aspect: "square",
    });
    const resizedTriangle = resizeFreeArea(triangle.draft, triangle.id, 0.3, 0.2);
    const triangleArea = resizedTriangle.areas.find(({ id }) => id === triangle.id)!;
    const triangleGeometry = expectPolygon(areaGeometry(triangleArea, COMPOSITION_CANVAS));

    expect(triangleArea.aspect).toBe("free");
    expect(triangleArea.area).toBeCloseTo(0.3 * 0.2 * 0.5);
    expect(triangleGeometry.side).toBeCloseTo(0.3 * COMPOSITION_CANVAS.width);
    expect(triangleGeometry.height).toBeCloseTo(0.2 * COMPOSITION_CANVAS.height);
  });

  it("allows areas to move completely into negative world coordinates", () => {
    const added = addArea(createDraft(), {
      primitive: "circle",
      aspect: "square",
      area: 0.08,
    });
    const draft = moveItem(added.draft, added.id, { x: -0.4, y: 0.5 });
    const geometry = areaGeometry(draft.areas[0], COMPOSITION_CANVAS);
    if (geometry.type !== "circle") throw new Error("Expected circle geometry.");

    expect(draft.areas[0].x).toBeLessThan(0);
    expect(geometry.cx - geometry.radius).toBeLessThan(0);
    expect(geometry.cx + geometry.radius).toBeLessThan(0);

    const metrics = visibleAreaMetrics(draft);
    expect(metrics.visibleAreaShares[0]).toBe(0);
    expect(metrics.clippedArea).toBeGreaterThan(0);
    expect(metrics.occupiedArea).toBe(0);
  });

  it("normalizes legacy drafts while rejecting unknown fields and duplicate IDs", () => {
    const circle = addArea(createDraft(), {
      primitive: "circle",
      aspect: "square",
      x: 0.25,
      y: 0.3,
    });
    const rectangle = addArea(circle.draft, {
      primitive: "quadrilateral",
      aspect: "free",
    });
    const legacy = structuredClone(rectangle.draft) as Omit<CompositionDraft, "directionLine"> & {
      directionLine?: CompositionDraft["directionLine"];
    };
    delete legacy.directionLine;
    const legacyArea = legacy.areas[0].area;
    delete (legacy.frame as Partial<CompositionDraft["frame"]>).bounds;
    legacy.areas[0].rotation = 81;
    legacy.areas[1].aspect = "portrait";
    delete legacy.areas[1].width;
    delete legacy.areas[1].height;

    const normalized = validateDraft(legacy);
    expect(normalized.directionLine).toBeNull();
    expect(normalized.frame.bounds).toEqual(createDraft().frame.bounds);
    expect(normalized.areas[0].x).toBeCloseTo(0.08 + 0.25 * 0.84);
    expect(normalized.areas[0].y).toBeCloseTo(0.145625 + 0.3 * 0.70875);
    expect(normalized.areas[0].area).toBeCloseTo(legacyArea * 0.84 * 0.70875);
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
    expect(resizedFrame.frame).toMatchObject({ width: 800, height: 1200 });
    const bounds = frameBoundsInCanvas(resizedFrame.frame);
    expect(bounds.width / bounds.height).toBeCloseTo(2 / 3);
  });

  it("keeps one movable, proportionally resizable frame with four fixed opposite corners", () => {
    const added = addArea(createDraft(), {
      primitive: "circle",
      x: 0.4,
      y: 0.45,
      area: 0.08,
    });
    const sourceItem = structuredClone(added.draft.areas[0]);
    const moved = moveFrame(added.draft, { x: 0.12, y: 0.05 });
    const source = frameBoundsInCanvas(moved.frame);
    const corners: readonly CompositionFrameCorner[] = [
      "top-left",
      "top-right",
      "bottom-left",
      "bottom-right",
    ];

    expect(moved.frame.bounds.x).toBe(0.12);
    expect(moved.frame.bounds.y).toBe(0.05);
    for (const corner of corners) {
      const resized = resizeFrame(moved, 0.8, corner);
      const geometry = frameBoundsInCanvas(resized.frame);

      expect(resized.areas[0]).toEqual(sourceItem);
      expect(geometry.width / geometry.height).toBeCloseTo(16 / 9);
      expect(geometry.x).toBeGreaterThanOrEqual(0);
      expect(geometry.y).toBeGreaterThanOrEqual(0);
      expect(geometry.x + geometry.width).toBeLessThanOrEqual(COMPOSITION_CANVAS.width);
      expect(geometry.y + geometry.height).toBeLessThanOrEqual(COMPOSITION_CANVAS.height);

      if (corner.endsWith("left")) {
        expect(geometry.x + geometry.width).toBeCloseTo(source.x + source.width);
      } else {
        expect(geometry.x).toBeCloseTo(source.x);
      }
      if (corner.startsWith("top")) {
        expect(geometry.y + geometry.height).toBeCloseTo(source.y + source.height);
      } else {
        expect(geometry.y).toBeCloseTo(source.y);
      }
    }
  });

  it("accepts a freely resized frame and updates its output ratio", () => {
    const draft = createDraft();
    const resized = resizeFrameToBounds(draft, {
      x: 120,
      y: 100,
      width: 640,
      height: 480,
    });
    const bounds = frameBoundsInCanvas(resized.frame);

    expect(bounds).toEqual({ x: 120, y: 100, width: 640, height: 480 });
    expect(resized.frame.width / resized.frame.height).toBeCloseTo(4 / 3, 2);
    expect(validateDraft(resized)).toEqual(resized);
  });

  it("supports signed world coordinates instead of a fixed canvas boundary", () => {
    const focus = addFocus(createDraft(), { x: 1.5, y: 1.25 }).draft;
    const area = addArea(focus, { primitive: "circle", x: 1.6, y: 1.4 }).draft;
    const moved = moveFrame(area, { x: 1.2, y: 1.1 });
    const resized = resizeFrame(moved, 1.5, "bottom-right");
    const frame = frameBoundsInCanvas(resized.frame);
    const world = compositionWorldSize(resized.frame);
    const contentWorld = compositionDraftWorldSize(resized);

    expect(validateDraft(resized)).toEqual(resized);
    expect(resized.frame.bounds.x).toBe(1.2);
    expect(resized.frame.bounds.y).toBe(1.1);
    expect(frame.x + frame.width).toBeGreaterThan(COMPOSITION_CANVAS.width);
    expect(frame.y + frame.height).toBeGreaterThan(COMPOSITION_CANVAS.height);
    expect(world.width).toBe(frame.x + frame.width);
    expect(world.height).toBe(frame.y + frame.height);
    expect(resized.focusPoints[0]).toMatchObject({ x: 1.5, y: 1.25 });
    expect(resized.areas[0]).toMatchObject({ x: 1.6, y: 1.4 });
    expect(contentWorld.width).toBeGreaterThanOrEqual(world.width);
    expect(contentWorld.height).toBeGreaterThanOrEqual(world.height);

    const signed = moveFrame(resized, { x: -1, y: -1 });
    const signedBounds = compositionWorldBounds(signed.frame);
    expect(signed.frame.bounds.x).toBe(-1);
    expect(signed.frame.bounds.y).toBe(-1);
    expect(signedBounds.x).toBe(-COMPOSITION_CANVAS.width);
    expect(signedBounds.y).toBe(-COMPOSITION_CANVAS.height);
  });

  it("calculates occupied area and negative space from only the frame contents", () => {
    const added = addArea(createDraft(), {
      primitive: "circle",
      x: 0.8,
      y: 0.7,
      area: 0.02,
    });
    const fullFrameMetrics = visibleAreaMetrics(added.draft);
    const croppedFrame = moveFrame(resizeFrame(added.draft, 0.25), { x: 0, y: 0 });
    const croppedMetrics = visibleAreaMetrics(croppedFrame);

    expect(fullFrameMetrics.occupiedArea).toBeGreaterThan(0);
    expect(croppedMetrics.occupiedArea).toBe(0);
    expect(croppedMetrics.negativeSpace).toBe(1);
    expect(croppedMetrics.clippedArea).toBeGreaterThan(0);
  });

  it("renders the CLI preview across negative and positive world coordinates", () => {
    const draft = moveFrame(
      addFocus(createDraft(), { x: -1.4, y: -0.8 }).draft,
      { x: -1.1, y: -0.4 },
    );
    const frame = frameBoundsInCanvas(draft.frame);
    const world = compositionDraftWorldBounds(draft);
    const svg = renderCompositionSvg(draft);

    expect(world.x).toBeLessThan(0);
    expect(world.y).toBeLessThan(0);
    expect(svg).toContain(`viewBox="${world.x} ${world.y} ${world.width} ${world.height}"`);
    expect(svg).toContain(
      `x="${frame.x}" y="${frame.y}" width="${frame.width}" height="${frame.height}" fill="none"`,
    );
    expect(svg).not.toContain("guide-grid");
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
