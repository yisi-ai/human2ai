import { validateDraft, visibleAreaMetrics } from "./draft.ts";
import { areaGeometry, geometryBounds } from "./geometry.ts";
import type { CompositionArea, CompositionDraft, Point } from "./types.ts";

export type ClippedSide = "top" | "right" | "bottom" | "left";

export interface CompositionAxisFact {
  ids: [string, string];
  angle: number;
  distance: number;
}

export interface CompositionInspection {
  version: 1;
  kind: "composition-inspection";
  sourceFingerprint: string;
  frame: CompositionDraft["frame"];
  focusPoints: CompositionDraft["focusPoints"];
  directionLine: CompositionDraft["directionLine"];
  areas: Array<{
    id: string;
    primitive: CompositionArea["primitive"];
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
  axes: {
    focus: CompositionAxisFact[];
    area: CompositionAxisFact[];
  };
  metrics: ReturnType<typeof visibleAreaMetrics>;
}

export function draftFingerprint(input: CompositionDraft): string {
  const draft = validateDraft(input);
  return fingerprintText(canonicalDraftJson(draft));
}

export function inspectComposition(input: CompositionDraft): CompositionInspection {
  const draft = validateDraft(input);
  const metrics = visibleAreaMetrics(draft);
  return {
    version: 1,
    kind: "composition-inspection",
    sourceFingerprint: draftFingerprint(draft),
    frame: structuredClone(draft.frame),
    focusPoints: structuredClone(draft.focusPoints),
    directionLine: structuredClone(draft.directionLine),
    areas: draft.areas.map((area, index) => {
      const bounds = geometryBounds(areaGeometry(area, draft.frame));
      return {
        id: area.id,
        primitive: area.primitive,
        center: { x: round(area.x), y: round(area.y) },
        areaShare: round(area.area),
        visibleAreaShare: round(metrics.visibleAreaShares[index]),
        rotation: round(area.rotation ?? 0),
        clippedSides: clippedSides(bounds, draft.frame),
        bounds: {
          minimumX: round(bounds.minimumX / draft.frame.width),
          maximumX: round(bounds.maximumX / draft.frame.width),
          minimumY: round(bounds.minimumY / draft.frame.height),
          maximumY: round(bounds.maximumY / draft.frame.height),
        },
      };
    }),
    axes: {
      focus: pairAxes(draft.focusPoints, draft),
      area: pairAxes(draft.areas, draft),
    },
    metrics,
  };
}

export function areaClippedSides(
  area: CompositionArea,
  draft: Pick<CompositionDraft, "frame">,
): ClippedSide[] {
  return clippedSides(geometryBounds(areaGeometry(area, draft.frame)), draft.frame);
}

function pairAxes(items: Array<{ id: string; x: number; y: number }>, draft: CompositionDraft) {
  const axes: CompositionAxisFact[] = [];
  const diagonal = Math.hypot(draft.frame.width, draft.frame.height);
  for (let first = 0; first < items.length; first += 1) {
    for (let second = first + 1; second < items.length; second += 1) {
      const start = toPixels(items[first], draft);
      const end = toPixels(items[second], draft);
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
  frame: CompositionDraft["frame"],
): ClippedSide[] {
  const sides: ClippedSide[] = [];
  const tolerance = Math.max(frame.width, frame.height) * 1e-9;
  if (bounds.minimumY < -tolerance) sides.push("top");
  if (bounds.maximumX > frame.width + tolerance) sides.push("right");
  if (bounds.maximumY > frame.height + tolerance) sides.push("bottom");
  if (bounds.minimumX < -tolerance) sides.push("left");
  return sides;
}

function toPixels(point: Point, draft: CompositionDraft): Point {
  return { x: point.x * draft.frame.width, y: point.y * draft.frame.height };
}

function fingerprintText(text: string): string {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `draft-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function canonicalDraftJson(draft: CompositionDraft): string {
  return JSON.stringify({
    version: draft.version,
    kind: draft.kind,
    frame: { width: draft.frame.width, height: draft.frame.height },
    focusPoints: draft.focusPoints.map(({ id, x, y }) => ({ id, x, y })),
    ...(draft.directionLine
      ? {
          directionLine: {
            id: draft.directionLine.id,
            x: draft.directionLine.x,
            y: draft.directionLine.y,
            rotation: draft.directionLine.rotation,
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
      ...(area.rotation === undefined ? {} : { rotation: area.rotation }),
      ...(area.width === undefined ? {} : { width: area.width }),
      ...(area.height === undefined ? {} : { height: area.height }),
    })),
  });
}

function round(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}
