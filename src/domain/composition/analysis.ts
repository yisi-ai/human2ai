import { validateDraft, visibleAreaMetrics } from "./draft.ts";
import {
  COMPOSITION_CANVAS,
  canvasPointToFrame,
  frameBoundsInCanvas,
} from "./frame.ts";
import { areaGeometry, compositionImageBounds, geometryBounds } from "./geometry.ts";
import type {
  CompositionArea,
  CompositionDraft,
  CompositionFrame,
  CompositionVisualWeight,
  Point,
} from "./types.ts";
import { fingerprintText } from "../fingerprint.ts";

export type ClippedSide = "top" | "right" | "bottom" | "left";

export interface CompositionAxisFact {
  ids: [string, string];
  angle: number;
  distance: number;
}

export type CompositionLayoutAlignment =
  | "left"
  | "center-x"
  | "right"
  | "top"
  | "center-y"
  | "bottom";

export interface CompositionLayoutFacts {
  alignmentTolerance: number;
  textRegionIds: string[];
  weightGroups: Record<CompositionVisualWeight, string[]>;
  areas: Array<{
    id: string;
    widthShare: number;
    heightShare: number;
    margins: { top: number; right: number; bottom: number; left: number };
  }>;
  pairs: Array<{
    ids: [string, string];
    widthRatio: number;
    heightRatio: number;
    areaRatio: number;
    horizontalGap: number;
    verticalGap: number;
    centerDistance: number;
    alignments: CompositionLayoutAlignment[];
  }>;
  focusRelations: Array<{
    focusId: string;
    containingAreaIds: string[];
    nearestAreaId: string | null;
    distance: number | null;
  }>;
}

export interface CompositionInspection {
  version: 1;
  kind: "composition-inspection";
  sourceFingerprint: string;
  processingSemantic: CompositionDraft["processingSemantic"];
  frame: CompositionDraft["frame"];
  overallNote: string;
  focusPoints: CompositionDraft["focusPoints"];
  directionLine: CompositionDraft["directionLine"];
  areas: Array<{
    id: string;
    primitive: CompositionArea["primitive"];
    note: string;
    annotation: string;
    semanticType: string;
    shotScale: CompositionArea["shotScale"];
    visualWeight: CompositionArea["visualWeight"];
    displayText?: string;
    isLightSource: boolean;
    center: Point;
    areaShare: number;
    visibleAreaShare: number;
    rotation: number;
    clippedSides: ClippedSide[];
    bounds: {
      minimumX: number;
      maximumX: number;
      minimumY: number;
      maximumY: number;
    };
  }>;
  images: Array<{
    id: string;
    note: string;
    annotation: string;
    semanticType: string;
    shotScale: CompositionArea["shotScale"];
    visualWeight: CompositionArea["visualWeight"];
    center: Point;
    widthShare: number;
    heightShare: number;
    areaShare: number;
    rotation: number;
    clippedSides: ClippedSide[];
  }>;
  axes: {
    focus: CompositionAxisFact[];
    area: CompositionAxisFact[];
  };
  metrics: ReturnType<typeof visibleAreaMetrics>;
  layout: CompositionLayoutFacts | null;
  guidance: Array<{
    sourceId: string;
    focusId: string;
    localAxis: "x" | "y";
    angleError: number | null;
    perpendicularDistance: number;
    forwardDistance: number;
  }>;
}

export function draftFingerprint(input: CompositionDraft): string {
  const draft = validateDraft(input);
  return fingerprintText(canonicalDraftJson(draft));
}

export function inspectComposition(input: CompositionDraft): CompositionInspection {
  const draft = validateDraft(input);
  const metrics = visibleAreaMetrics(draft);
  const inspectedAreas = draft.areas.map((area, index) => {
    const bounds = geometryBounds(areaGeometry(area, COMPOSITION_CANVAS));
    const frameBounds = frameBoundsInCanvas(draft.frame);
    const center = canvasPointToFrame(area, draft.frame);
    const frameArea = frameBounds.width * frameBounds.height;
    return {
      id: area.id,
      primitive: area.primitive,
      note: area.note,
      annotation: area.annotation,
      semanticType: area.semanticType,
      shotScale: area.shotScale,
      visualWeight: area.visualWeight,
      isLightSource: area.isLightSource ?? false,
      ...(area.displayText === undefined ? {} : { displayText: area.displayText }),
      center: { x: round(center.x), y: round(center.y) },
      areaShare: round(
        (area.area * COMPOSITION_CANVAS.width * COMPOSITION_CANVAS.height) / frameArea,
      ),
      visibleAreaShare: round(metrics.visibleAreaShares[index]),
      rotation: round(area.rotation ?? 0),
      clippedSides: clippedSides(bounds, draft.frame),
      bounds: {
        minimumX: round((bounds.minimumX - frameBounds.x) / frameBounds.width),
        maximumX: round((bounds.maximumX - frameBounds.x) / frameBounds.width),
        minimumY: round((bounds.minimumY - frameBounds.y) / frameBounds.height),
        maximumY: round((bounds.maximumY - frameBounds.y) / frameBounds.height),
      },
    };
  });
  const inspectedImages = draft.images.map((image) => {
    const bounds = compositionImageBounds(image);
    const frameBounds = frameBoundsInCanvas(draft.frame);
    const center = canvasPointToFrame(image, draft.frame);
    return {
      id: image.id,
      note: image.note,
      annotation: image.annotation,
      semanticType: image.semanticType,
      shotScale: image.shotScale,
      visualWeight: image.visualWeight,
      center: { x: round(center.x), y: round(center.y) },
      widthShare: round(bounds.width / frameBounds.width),
      heightShare: round(bounds.height / frameBounds.height),
      areaShare: round((bounds.width * bounds.height) / (frameBounds.width * frameBounds.height)),
      rotation: round(image.rotation),
      clippedSides: clippedSides({
        minimumX: bounds.x,
        maximumX: bounds.x + bounds.width,
        minimumY: bounds.y,
        maximumY: bounds.y + bounds.height,
      }, draft.frame),
    };
  });
  return {
    version: 1,
    kind: "composition-inspection",
    sourceFingerprint: draftFingerprint(draft),
    processingSemantic: draft.processingSemantic,
    frame: structuredClone(draft.frame),
    overallNote: draft.overallNote,
    focusPoints: draft.focusPoints.map((focus) => ({
      ...focus,
      ...inspectedPoint(focus, draft.frame),
    })),
    directionLine: draft.directionLine
      ? {
          ...draft.directionLine,
          ...inspectedPoint(draft.directionLine, draft.frame),
        }
      : null,
    areas: inspectedAreas,
    images: inspectedImages,
    axes: {
      focus: pairAxes(draft.focusPoints, draft),
      area: pairAxes(draft.areas, draft),
    },
    metrics,
    guidance: guidanceFacts(draft),
    layout: draft.processingSemantic === "editorial-layout"
      ? layoutFacts(draft, inspectedAreas)
      : null,
  };
}

function guidanceFacts(draft: CompositionDraft): CompositionInspection["guidance"] {
  const sources = [
    ...(draft.directionLine ? [{ ...draft.directionLine, localAxis: "x" as const }] : []),
    ...draft.areas.filter((area) => area.primitive !== "circle" || area.aspect === "free" &&
      Math.abs(area.width! * COMPOSITION_CANVAS.width - area.height! * COMPOSITION_CANVAS.height) > 1e-9)
      .flatMap((area) => (["x", "y"] as const).map((localAxis) => ({ ...area, localAxis }))),
  ];
  const outputScale = draft.frame.width / (draft.frame.bounds.width * COMPOSITION_CANVAS.width);
  return sources.flatMap((source) => draft.focusPoints.map((focus) => {
    const rotation = (source.rotation ?? 0) + (source.localAxis === "y" ? 90 : 0);
    const angle = rotation * Math.PI / 180;
    const dx = (focus.x - source.x) * COMPOSITION_CANVAS.width;
    const dy = (focus.y - source.y) * COMPOSITION_CANVAS.height;
    const delta = Math.atan2(dy, dx) * 180 / Math.PI - rotation;
    return { sourceId: source.id, focusId: focus.id, localAxis: source.localAxis,
      angleError: Math.hypot(dx, dy) < 1e-9 ? null : round(Math.abs(((delta % 360) + 540) % 360 - 180)),
      perpendicularDistance: round(Math.abs(dx * Math.sin(angle) - dy * Math.cos(angle)) * outputScale),
      forwardDistance: round((dx * Math.cos(angle) + dy * Math.sin(angle)) * outputScale),
    };
  }));
}

function layoutFacts(
  draft: CompositionDraft,
  areas: CompositionInspection["areas"],
): CompositionLayoutFacts {
  const alignmentTolerance = 0.02;
  const weightGroups: Record<CompositionVisualWeight, string[]> = {
    auto: [],
    high: [],
    medium: [],
    low: [],
    decorative: [],
  };
  areas.forEach((area) => weightGroups[area.visualWeight].push(area.id));

  return {
    alignmentTolerance,
    textRegionIds: areas
      .filter(({ semanticType }) => semanticType === "text-region")
      .map(({ id }) => id),
    weightGroups,
    areas: areas.map((area) => ({
      id: area.id,
      widthShare: round(area.bounds.maximumX - area.bounds.minimumX),
      heightShare: round(area.bounds.maximumY - area.bounds.minimumY),
      margins: {
        top: area.bounds.minimumY,
        right: round(1 - area.bounds.maximumX),
        bottom: round(1 - area.bounds.maximumY),
        left: area.bounds.minimumX,
      },
    })),
    pairs: pairLayoutFacts(areas, alignmentTolerance),
    focusRelations: draft.focusPoints.map((focus) => {
      const point = inspectedPoint(focus, draft.frame);
      const distances = areas.map((area) => ({
        id: area.id,
        distance: pointToBoundsDistance(point, area.bounds),
      }));
      const containingAreaIds = distances
        .filter(({ distance }) => distance <= 1e-9)
        .map(({ id }) => id);
      const nearest = distances.sort((first, second) => first.distance - second.distance)[0];
      return {
        focusId: focus.id,
        containingAreaIds,
        nearestAreaId: nearest?.id ?? null,
        distance: nearest ? round(nearest.distance) : null,
      };
    }),
  };
}

function pairLayoutFacts(
  areas: CompositionInspection["areas"],
  alignmentTolerance: number,
): CompositionLayoutFacts["pairs"] {
  const pairs: CompositionLayoutFacts["pairs"] = [];
  for (let firstIndex = 0; firstIndex < areas.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < areas.length; secondIndex += 1) {
      const first = areas[firstIndex];
      const second = areas[secondIndex];
      const firstWidth = first.bounds.maximumX - first.bounds.minimumX;
      const secondWidth = second.bounds.maximumX - second.bounds.minimumX;
      const firstHeight = first.bounds.maximumY - first.bounds.minimumY;
      const secondHeight = second.bounds.maximumY - second.bounds.minimumY;
      const alignments: CompositionLayoutAlignment[] = [];
      for (const [alignment, firstValue, secondValue] of [
        ["left", first.bounds.minimumX, second.bounds.minimumX],
        ["center-x", first.center.x, second.center.x],
        ["right", first.bounds.maximumX, second.bounds.maximumX],
        ["top", first.bounds.minimumY, second.bounds.minimumY],
        ["center-y", first.center.y, second.center.y],
        ["bottom", first.bounds.maximumY, second.bounds.maximumY],
      ] as const) {
        if (Math.abs(firstValue - secondValue) <= alignmentTolerance) {
          alignments.push(alignment);
        }
      }
      pairs.push({
        ids: [first.id, second.id],
        widthRatio: round(largerRatio(firstWidth, secondWidth)),
        heightRatio: round(largerRatio(firstHeight, secondHeight)),
        areaRatio: round(largerRatio(first.areaShare, second.areaShare)),
        horizontalGap: round(axisGap(
          first.bounds.minimumX,
          first.bounds.maximumX,
          second.bounds.minimumX,
          second.bounds.maximumX,
        )),
        verticalGap: round(axisGap(
          first.bounds.minimumY,
          first.bounds.maximumY,
          second.bounds.minimumY,
          second.bounds.maximumY,
        )),
        centerDistance: round(Math.hypot(
          first.center.x - second.center.x,
          first.center.y - second.center.y,
        )),
        alignments,
      });
    }
  }
  return pairs;
}

function largerRatio(first: number, second: number): number {
  return Math.max(first, second) / Math.min(first, second);
}

function axisGap(
  firstMinimum: number,
  firstMaximum: number,
  secondMinimum: number,
  secondMaximum: number,
): number {
  if (firstMaximum < secondMinimum) return secondMinimum - firstMaximum;
  if (secondMaximum < firstMinimum) return firstMinimum - secondMaximum;
  return 0;
}

function pointToBoundsDistance(
  point: Point,
  bounds: CompositionInspection["areas"][number]["bounds"],
): number {
  const x = Math.max(bounds.minimumX - point.x, 0, point.x - bounds.maximumX);
  const y = Math.max(bounds.minimumY - point.y, 0, point.y - bounds.maximumY);
  return Math.hypot(x, y);
}

export function areaClippedSides(
  area: CompositionArea,
  draft: Pick<CompositionDraft, "frame">,
): ClippedSide[] {
  return clippedSides(geometryBounds(areaGeometry(area, COMPOSITION_CANVAS)), draft.frame);
}

function pairAxes(
  items: Array<{ id: string; x: number; y: number }>,
  draft: CompositionDraft,
) {
  const axes: CompositionAxisFact[] = [];
  const frame = frameBoundsInCanvas(draft.frame);
  const diagonal = Math.hypot(frame.width, frame.height);
  for (let first = 0; first < items.length; first += 1) {
    for (let second = first + 1; second < items.length; second += 1) {
      const start = toPixels(items[first]);
      const end = toPixels(items[second]);
      axes.push({
        ids: [items[first].id, items[second].id],
        angle: round((Math.atan2(end.y - start.y, end.x - start.x) * 180) / Math.PI),
        distance: round(Math.hypot(end.x - start.x, end.y - start.y) / diagonal),
      });
    }
  }
  return axes;
}

function clippedSides(
  bounds: ReturnType<typeof geometryBounds>,
  compositionFrame: CompositionFrame,
): ClippedSide[] {
  const sides: ClippedSide[] = [];
  const frame = frameBoundsInCanvas(compositionFrame);
  const tolerance = Math.max(frame.width, frame.height) * 1e-9;
  if (bounds.minimumY < frame.y - tolerance) sides.push("top");
  if (bounds.maximumX > frame.x + frame.width + tolerance) sides.push("right");
  if (bounds.maximumY > frame.y + frame.height + tolerance) sides.push("bottom");
  if (bounds.minimumX < frame.x - tolerance) sides.push("left");
  return sides;
}

function toPixels(point: Point): Point {
  return {
    x: point.x * COMPOSITION_CANVAS.width,
    y: point.y * COMPOSITION_CANVAS.height,
  };
}

function inspectedPoint(point: Point, frame: CompositionFrame): Point {
  const relative = canvasPointToFrame(point, frame);
  return { x: round(relative.x), y: round(relative.y) };
}

function canonicalDraftJson(draft: CompositionDraft): string {
  return JSON.stringify({
    ...(draft.states ? {
      activeStateId: draft.activeStateId,
      states: draft.states.map(({ id, number, name, layout }) => ({ id, number, name, layout })),
    } : {}),
    ...(draft.layerOrder ? { layerOrder: draft.layerOrder } : {}),
    version: draft.version,
    kind: draft.kind,
    processingSemantic: draft.processingSemantic,
    frame: {
      width: draft.frame.width,
      height: draft.frame.height,
      bounds: {
        x: draft.frame.bounds.x,
        y: draft.frame.bounds.y,
        width: draft.frame.bounds.width,
        height: draft.frame.bounds.height,
      },
    },
    ...(draft.overallNote === "" ? {} : { overallNote: draft.overallNote }),
    focusPoints: draft.focusPoints.map(({ id, x, y, ...metadata }) => ({
      id,
      x,
      y,
      ...nonEmptyMetadata(metadata),
    })),
    ...(draft.directionLine
      ? {
          directionLine: {
            id: draft.directionLine.id,
            x: draft.directionLine.x,
            y: draft.directionLine.y,
            rotation: draft.directionLine.rotation,
            ...nonEmptyMetadata(draft.directionLine),
          },
        }
      : {}),
    areas: draft.areas.map((area) => ({
      id: area.id,
      primitive: area.primitive,
      x: area.x,
      y: area.y,
      area: area.area,
      aspect: area.aspect,
      ...nonEmptyMetadata(area),
      ...(area.visualWeight === "auto" ? {} : { visualWeight: area.visualWeight }),
      ...(area.displayText ? { displayText: area.displayText } : {}),
      ...(area.isLightSource ? { isLightSource: true } : {}),
      ...(area.rotation === undefined ? {} : { rotation: area.rotation }),
      ...(area.width === undefined ? {} : { width: area.width }),
      ...(area.height === undefined ? {} : { height: area.height }),
      ...(area.corners === undefined ? {} : { corners: area.corners }),
    })),
    images: draft.images.map((image) => ({
      id: image.id,
      x: image.x,
      y: image.y,
      width: image.width,
      height: image.height,
      rotation: image.rotation,
      assetId: image.assetId,
      ...(image.cameraReference ? { cameraReference: image.cameraReference } : {}),
      crop: image.crop,
      ...nonEmptyMetadata(image),
      ...(image.visualWeight === "auto" ? {} : { visualWeight: image.visualWeight }),
    })),
  });
}

function round(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

function nonEmptyMetadata(metadata: {
  note: string;
  annotation: string;
  semanticType: string;
  shotScale: CompositionArea["shotScale"];
}): Record<string, string> {
  return {
    ...(metadata.note === "" ? {} : { note: metadata.note }),
    ...(metadata.annotation === "" ? {} : { annotation: metadata.annotation }),
    ...(metadata.semanticType === "" ? {} : { semanticType: metadata.semanticType }),
    ...(metadata.shotScale === "auto" ? {} : { shotScale: metadata.shotScale }),
  };
}
