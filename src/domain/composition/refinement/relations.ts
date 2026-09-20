import { moveItem, resizeFreeArea, rotateArea, rotateDirectionLine } from "../draft.ts";
import { areaGeometry, geometryBounds } from "../geometry.ts";
import { COMPOSITION_CANVAS, canvasPointToFrame, framePointToCanvas } from "../frame.ts";
import type { CompositionArea, CompositionDraft, DirectionLine, FocusPoint, Point } from "../types.ts";
import type {
  CompositionRefinementOperation, DirectedRefinementPlan, FrameDivision, RefinementGuide,
  RefinementRelationCheck, RelationOperation,
} from "./types.ts";

export const FRAME_DIVISIONS: Record<FrameDivision, number> = {
  center: 0.5, "golden-start": (3 - Math.sqrt(5)) / 2, "golden-end": (Math.sqrt(5) - 1) / 2,
  "third-start": 1 / 3, "third-end": 2 / 3,
};

export function refinementItem(draft: CompositionDraft, id: string): CompositionArea | FocusPoint | DirectionLine {
  const item = [...draft.areas, ...draft.focusPoints, ...(draft.directionLine ? [draft.directionLine] : [])]
    .find((candidate) => candidate.id === id);
  if (!item) throw new Error(`Unknown refinement target: ${id}.`);
  return item;
}

export function refinementArea(draft: CompositionDraft, id: string): CompositionArea {
  const area = draft.areas.find((candidate) => candidate.id === id);
  if (!area) throw new Error(`Unknown refinement area: ${id}.`);
  return area;
}

/** Unrotated dimensions in the common physical coordinate system, not frame fractions. */
export function areaDimensions(area: CompositionArea) {
  const geometry = areaGeometry({ ...area, rotation: 0 }, COMPOSITION_CANVAS);
  const bounds = geometryBounds(geometry);
  return { width: bounds.maximumX - bounds.minimumX, height: bounds.maximumY - bounds.minimumY };
}

function pixels(point: Point): Point {
  return { x: point.x * COMPOSITION_CANVAS.width, y: point.y * COMPOSITION_CANVAS.height };
}
function world(point: Point): Point {
  return { x: point.x / COMPOSITION_CANVAS.width, y: point.y / COMPOSITION_CANVAS.height };
}
function turn(point: Point, degrees: number): Point {
  const angle = degrees * Math.PI / 180;
  return { x: point.x * Math.cos(angle) - point.y * Math.sin(angle),
    y: point.x * Math.sin(angle) + point.y * Math.cos(angle) };
}
export function angleError(first: number, second: number): number {
  return Math.abs(((first - second) % 360 + 540) % 360 - 180);
}
function size(draft: CompositionDraft, id: string, dimension: "width" | "height" | "area") {
  if (id === "frame") {
    const width = draft.frame.bounds.width * COMPOSITION_CANVAS.width;
    const height = draft.frame.bounds.height * COMPOSITION_CANVAS.height;
    return dimension === "area" ? width * height : dimension === "width" ? width : height;
  }
  const area = refinementArea(draft, id);
  return dimension === "area" ? area.area * COMPOSITION_CANVAS.width * COMPOSITION_CANVAS.height
    : areaDimensions(area)[dimension];
}
function coordinate(draft: CompositionDraft, operation: Extract<RelationOperation, { method: "frame-placement" }>) {
  const item = refinementItem(draft, operation.targetId);
  if (!("primitive" in item) || operation.alignment === "center") {
    return canvasPointToFrame(item, draft.frame)[operation.axis];
  }
  const geometry = areaGeometry(item, COMPOSITION_CANVAS);
  const bounds = geometryBounds(geometry);
  if (geometry.type === "ellipse") {
    const radians = (item.rotation ?? 0) * Math.PI / 180;
    const rx = Math.hypot(geometry.radiusX * Math.cos(radians), geometry.radiusY * Math.sin(radians));
    const ry = Math.hypot(geometry.radiusX * Math.sin(radians), geometry.radiusY * Math.cos(radians));
    Object.assign(bounds, { minimumX: geometry.cx - rx, maximumX: geometry.cx + rx,
      minimumY: geometry.cy - ry, maximumY: geometry.cy + ry });
  }
  const value = operation.axis === "x"
    ? operation.alignment === "start" ? bounds.minimumX : bounds.maximumX
    : operation.alignment === "start" ? bounds.minimumY : bounds.maximumY;
  return (value / COMPOSITION_CANVAS[operation.axis === "x" ? "width" : "height"] - draft.frame.bounds[operation.axis])
    / draft.frame.bounds[operation.axis === "x" ? "width" : "height"];
}
function frameGuide(draft: CompositionDraft, axis: "x" | "y", value: number): RefinementGuide {
  return { start: framePointToCanvas(axis === "x" ? { x: value, y: 0 } : { x: 0, y: value }, draft.frame),
    end: framePointToCanvas(axis === "x" ? { x: value, y: 1 } : { x: 1, y: value }, draft.frame) };
}
function divisionGuide(draft: CompositionDraft, axis: "x" | "y", division: FrameDivision) {
  return frameGuide(draft, axis, FRAME_DIVISIONS[division]);
}
function dimensionGuides(draft: CompositionDraft, id: string, dimension: "width" | "height" | "area"): RefinementGuide[] {
  const dimensions = dimension === "area" ? ["width", "height"] as const : [dimension];
  return dimensions.map((axis) => {
    if (id === "frame") return frameGuide(draft, axis === "width" ? "y" : "x", 0.5);
    const area = refinementArea(draft, id), length = areaDimensions(area)[axis];
    const half = world(turn(axis === "width" ? { x: length / 2, y: 0 } : { x: 0, y: length / 2 }, area.rotation ?? 0));
    return { start: { x: area.x - half.x, y: area.y - half.y }, end: { x: area.x + half.x, y: area.y + half.y } };
  });
}

function mirrorTarget(draft: CompositionDraft, operation: Extract<RelationOperation, { method: "mirror-symmetry" }>) {
  if (operation.anchorAreaId === operation.targetAreaId) throw new Error("Symmetry requires two distinct areas.");
  const anchor = refinementArea(draft, operation.anchorAreaId);
  const target = refinementArea(draft, operation.targetAreaId);
  if (operation.match === "geometry" && anchor.primitive !== target.primitive) {
    throw new Error("Geometric symmetry requires matching primitives; choose position symmetry for different shapes.");
  }
  const point = canvasPointToFrame(anchor, draft.frame);
  const axis = operation.axis === "vertical" ? "x" : "y";
  point[axis] = 2 * FRAME_DIVISIONS[operation.division] - point[axis];
  return { ...framePointToCanvas(point, draft.frame), ...areaDimensions(anchor),
    rotation: operation.axis === "vertical" ? -(anchor.rotation ?? 0) : 180 - (anchor.rotation ?? 0) };
}
function flowAngle(draft: CompositionDraft, operation: Extract<RelationOperation, { method: "focus-flow" }>) {
  const source = refinementItem(draft, operation.sourceId);
  const focus = draft.focusPoints.find((item) => item.id === operation.targetFocusId);
  if (!focus) throw new Error(`Unknown focus: ${operation.targetFocusId}.`);
  const a = pixels(source), b = pixels(focus);
  if (Math.hypot(a.x - b.x, a.y - b.y) < 1e-9) throw new Error("A focus at the source center has no guidance direction.");
  if ("primitive" in source && source.primitive === "circle") {
    const dimensions = areaDimensions(source);
    if (Math.abs(dimensions.width - dimensions.height) < 1e-9) {
      throw new Error("A circle has no directional axis; choose an elongated area or the direction line.");
    }
  }
  if (operation.sourceId === "direction-1" && operation.localAxis !== "x") {
    throw new Error("The direction line uses its x axis.");
  }
  return Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI - (operation.localAxis === "y" ? 90 : 0);
}

export function applyRelation(draft: CompositionDraft, operation: RelationOperation): CompositionDraft {
  switch (operation.method) {
    case "frame-placement": {
      const item = refinementItem(draft, operation.targetId);
      const offset = (FRAME_DIVISIONS[operation.division] - coordinate(draft, operation))
        * draft.frame.bounds[operation.axis === "x" ? "width" : "height"];
      return moveItem(draft, item.id, { ...item, [operation.axis]: item[operation.axis] + offset });
    }
    case "size-ratio": {
      if ((operation.dimension === "area") !== (operation.referenceDimension === "area")) {
        throw new Error("An area ratio must compare areas; a length ratio must compare lengths.");
      }
      if (operation.targetAreaId === operation.referenceId && operation.dimension === operation.referenceDimension) {
        throw new Error("A size ratio cannot use the same measurement as both target and reference.");
      }
      const area = refinementArea(draft, operation.targetAreaId);
      const dimensions = areaDimensions(area);
      const desired = size(draft, operation.referenceId, operation.referenceDimension) * operation.ratio;
      if (operation.dimension === "area") {
        const scale = Math.sqrt(desired / size(draft, area.id, "area"));
        dimensions.width *= scale; dimensions.height *= scale;
      } else dimensions[operation.dimension] = desired;
      return resizeFreeArea(draft, area.id, dimensions.width / COMPOSITION_CANVAS.width,
        dimensions.height / COMPOSITION_CANVAS.height);
    }
    case "mirror-symmetry": {
      const target = mirrorTarget(draft, operation);
      let refined = moveItem(draft, operation.targetAreaId, target);
      if (operation.match === "geometry") {
        refined = resizeFreeArea(refined, operation.targetAreaId,
          target.width / COMPOSITION_CANVAS.width, target.height / COMPOSITION_CANVAS.height);
        refined = rotateArea(refined, operation.targetAreaId, target.rotation);
      }
      return refined;
    }
    case "focus-flow": {
      const rotation = flowAngle(draft, operation);
      return operation.sourceId === "direction-1" ? rotateDirectionLine(draft, operation.sourceId, rotation)
        : rotateArea(draft, operation.sourceId, rotation);
    }
  }
}

/** Linked focuses retain their local position when their subject is transformed. Moving a linked focus translates its subject. */
export function carryLinkedFocuses(before: CompositionDraft, after: CompositionDraft, plan: DirectedRefinementPlan) {
  let result = after;
  for (const areaId of new Set(plan.focusLinks.map((link) => link.areaId))) {
    const links = plan.focusLinks.filter((link) => link.areaId === areaId);
    const a = refinementArea(before, areaId);
    let b = refinementArea(result, areaId);
    const oldSize = areaDimensions(a), newSize = areaDimensions(b);
    if (a.x === b.x && a.y === b.y && a.rotation === b.rotation
      && oldSize.width === newSize.width && oldSize.height === newSize.height) {
      const moved = links.find(({ focusId }) => {
        const focus = refinementItem(before, focusId), next = refinementItem(after, focusId);
        return focus.x !== next.x || focus.y !== next.y;
      });
      if (!moved) continue;
      const focus = refinementItem(before, moved.focusId), next = refinementItem(after, moved.focusId);
      result = moveItem(result, areaId, { x: b.x + next.x - focus.x, y: b.y + next.y - focus.y });
      b = refinementArea(result, areaId);
    }
    for (const { focusId } of links) {
      const focus = refinementItem(before, focusId);
      const offset = turn(pixels({ x: focus.x - a.x, y: focus.y - a.y }), -(a.rotation ?? 0));
      const transformed = world(turn({ x: offset.x * newSize.width / oldSize.width,
        y: offset.y * newSize.height / oldSize.height }, b.rotation ?? 0));
      result = moveItem(result, focusId, { x: b.x + transformed.x, y: b.y + transformed.y });
    }
  }
  return result;
}

export function validateRefinementLinks(draft: CompositionDraft, plan: DirectedRefinementPlan) {
  const seen = new Set<string>();
  for (const { focusId, areaId } of plan.focusLinks) {
    if (!draft.focusPoints.some((focus) => focus.id === focusId)) throw new Error(`Unknown linked focus: ${focusId}.`);
    refinementArea(draft, areaId);
    if (seen.has(focusId)) throw new Error(`A focus may belong to only one area: ${focusId}.`);
    seen.add(focusId);
  }
  plan.fixedIds.forEach((id) => refinementItem(draft, id));
}

export function checkRefinementRelation(
  source: CompositionDraft, final: CompositionDraft, operation: CompositionRefinementOperation, operationIndex: number,
  execute: (draft: CompositionDraft, operation: CompositionRefinementOperation) => CompositionDraft,
): RefinementRelationCheck {
  const outputScale = source.frame.width / (source.frame.bounds.width * COMPOSITION_CANVAS.width);
  let target = 0;
  let unit: RefinementRelationCheck["unit"] = "pixels";
  let guides: RefinementGuide[] = [];
  let measure: (draft: CompositionDraft) => number;
  switch (operation.method) {
    case "frame-placement":
      target = FRAME_DIVISIONS[operation.division]; unit = "frame-fraction";
      measure = (draft) => coordinate(draft, operation);
      guides = [divisionGuide(final, operation.axis, operation.division)];
      break;
    case "size-ratio":
      target = operation.ratio; unit = "ratio";
      measure = (draft) => size(draft, operation.targetAreaId, operation.dimension)
        / size(draft, operation.referenceId, operation.referenceDimension);
      guides = [...dimensionGuides(final, operation.targetAreaId, operation.dimension),
        ...dimensionGuides(final, operation.referenceId, operation.referenceDimension)];
      break;
    case "mirror-symmetry":
      measure = (draft) => {
        const desired = mirrorTarget(draft, operation), area = refinementArea(draft, operation.targetAreaId);
        const a = pixels(area), b = pixels(desired), dimensions = areaDimensions(area);
        const positionError = Math.hypot(a.x - b.x, a.y - b.y);
        return Math.max(positionError, ...(operation.match === "geometry" ? [
          Math.abs(dimensions.width - desired.width), Math.abs(dimensions.height - desired.height),
          angleError(area.rotation ?? 0, desired.rotation) * Math.PI / 180 * Math.max(desired.width, desired.height),
        ] : [])) * outputScale;
      };
      guides = [divisionGuide(final, operation.axis === "vertical" ? "x" : "y", operation.division)];
      break;
    case "focus-flow":
      unit = "degrees";
      measure = (draft) => {
        const item = refinementItem(draft, operation.sourceId);
        return angleError("rotation" in item ? item.rotation ?? 0 : 0, flowAngle(draft, operation));
      };
      guides = [{ start: refinementItem(final, operation.sourceId), end: refinementItem(final, operation.targetFocusId) }];
      break;
    default:
      if (operation.method === "focus-anchor") {
        const point = canvasPointToFrame(refinementItem(execute(final, operation), operation.targetFocusId), final.frame);
        guides = [frameGuide(final, "x", point.x), frameGuide(final, "y", point.y)];
      } else if (operation.method === "axis-relation") {
        guides = [operation.focusIds, operation.areaIds].map(([first, second]) => ({
          start: refinementItem(final, first), end: refinementItem(final, second),
        }));
      } else if (operation.method === "rotation-alignment") {
        guides = operation.targetAreaIds.flatMap((id) => dimensionGuides(final, id, "width"));
      }
      unit = operation.method === "rotation-alignment" || operation.method === "axis-relation" ? "degrees" : "pixels";
      measure = (draft) => {
        const corrected = execute(draft, operation);
        if (operation.method === "rotation-alignment") {
          return Math.max(0, ...operation.targetAreaIds.map((id) => angleError(
            refinementArea(draft, id).rotation ?? 0, refinementArea(corrected, id).rotation ?? 0)));
        }
        if (operation.method === "axis-relation") {
          const angle = (d: CompositionDraft) => {
            const [a, b] = operation.areaIds.map((id) => pixels(refinementArea(d, id)));
            return Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
          };
          return angleError(angle(draft), angle(corrected));
        }
        return Math.max(0, ...[...draft.areas, ...draft.focusPoints].map((item) => {
          const next = refinementItem(corrected, item.id), a = pixels(item), b = pixels(next);
          return Math.hypot(a.x - b.x, a.y - b.y) * outputScale;
        }));
      };
  }
  // A relationship may become measurable only after an earlier operation (for example elongating a circle).
  let before: number | null;
  try { before = measure(source); } catch { before = null; }
  const after = measure(final), error = Math.abs(after - target);
  return { operationIndex, method: operation.method, before, after, target, error, unit,
    passed: Number.isFinite(error) && error <= 1e-6, guides: guides.map(({ start, end }) => ({
      start: { x: start.x, y: start.y }, end: { x: end.x, y: end.y },
    })) };
}
