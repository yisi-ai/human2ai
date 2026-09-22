import { frameBoundsInCanvas, framePointToCanvas } from "./frame.ts";
import { compositionPlanGeometry } from "./planning.ts";
import type { CompositionDraft, CompositionPlan, Point } from "./types.ts";

export interface CompositionPlanIntersectionSource {
  planId: string;
  type: CompositionPlan["type"];
  lineId: string;
  visible: boolean;
}

export interface CompositionPlanIntersection {
  id: string;
  framePoint: Point;
  canvasPoint: Point;
  sources: CompositionPlanIntersectionSource[];
  precision: {
    kind: "exact" | "approximate";
    /** Curve-to-polyline error in output pixels, not an intersection-position error bound. */
    maxCurveDeviationPx: number;
  };
}

type Segment = { start: Point; end: Point };
const EPSILON = 1e-7; // Physical canvas units, independent of editor zoom.

/** Derive isolated intersections from validated active-state plans, including hidden guides. */
export function compositionPlanningIntersections(draft: CompositionDraft): CompositionPlanIntersection[] {
  const frame = frameBoundsInCanvas(draft.frame);
  const lines = (draft.plans ?? []).flatMap((plan) => {
    const geometry = compositionPlanGeometry(plan, draft.frame);
    const paths = plan.type === "triangle"
      ? geometry.paths[0].slice(0, -1).map((start, index) => [start, geometry.paths[0][index + 1]])
      : geometry.paths;
    return paths.map((points, index) => ({
      source: { planId: plan.id, type: plan.type, lineId: planningLineId(plan, index), visible: plan.visible },
      segments: points.slice(0, -1).map((start, index) => ({ start, end: points[index + 1] })),
      maxCurveDeviationPx: (geometry.maxCurveDeviation ?? 0) * draft.frame.width / frame.width,
    }));
  });
  const intersections: Array<{ point: Point; sources: CompositionPlanIntersectionSource[]; maxCurveDeviationPx: number }> = [];
  for (let first = 0; first < lines.length; first += 1) {
    for (let second = first + 1; second < lines.length; second += 1) {
      const a = lines[first], b = lines[second];
      const points: Point[] = [], overlaps: Segment[] = [];
      for (const aSegment of a.segments) {
        for (const bSegment of b.segments) {
          const hit = intersectSegments(aSegment, bSegment);
          if (hit && "point" in hit) points.push(hit.point);
          else if (hit) overlaps.push(hit.overlap);
        }
      }
      for (const point of points) {
        if (point.x < frame.x - EPSILON || point.x > frame.x + frame.width + EPSILON
          || point.y < frame.y - EPSILON || point.y > frame.y + frame.height + EPSILON) continue;
        // Continuous overlaps have no unique intersection, including shared polyline vertices.
        if (overlaps.some((segment) => pointOnSegment(point, segment))) continue;
        let intersection = intersections.find((entry) => Math.hypot(entry.point.x - point.x, entry.point.y - point.y) <= EPSILON);
        if (!intersection) {
          intersection = { point, sources: [], maxCurveDeviationPx: 0 };
          intersections.push(intersection);
        }
        for (const source of [a.source, b.source]) {
          if (!intersection.sources.some((entry) => entry.planId === source.planId && entry.lineId === source.lineId)) {
            intersection.sources.push(source);
          }
        }
        intersection.maxCurveDeviationPx = Math.max(intersection.maxCurveDeviationPx, a.maxCurveDeviationPx, b.maxCurveDeviationPx);
      }
    }
  }
  return intersections.sort((a, b) => a.point.y - b.point.y || a.point.x - b.point.x).map<CompositionPlanIntersection>((entry, index) => {
    const framePoint = {
      x: Math.max(0, Math.min(1, (entry.point.x - frame.x) / frame.width)),
      y: Math.max(0, Math.min(1, (entry.point.y - frame.y) / frame.height)),
    };
    return {
      id: `intersection-${index + 1}`,
      framePoint,
      canvasPoint: framePointToCanvas(framePoint, draft.frame),
      sources: entry.sources,
      precision: {
        kind: entry.sources.some((source) => source.type === "golden-spiral") ? "approximate" : "exact",
        maxCurveDeviationPx: entry.maxCurveDeviationPx,
      },
    };
  });
}

function planningLineId(plan: CompositionPlan, index: number): string {
  if (plan.type === "thirds" || plan.type === "golden-section") {
    const axis = plan.axes === "both" ? index % 2 === 0 ? "vertical" : "horizontal" : plan.axes;
    return `${axis}-${plan.axes === "both" ? Math.floor(index / 2) + 1 : index + 1}`;
  }
  return plan.type === "triangle" ? `edge-${index + 1}` : plan.type === "radial" ? `ray-${index + 1}`
    : plan.type === "symmetry" ? "axis" : "spiral";
}

function intersectSegments(a: Segment, b: Segment): { point: Point } | { overlap: Segment } | null {
  if (Math.max(a.start.x, a.end.x) + EPSILON < Math.min(b.start.x, b.end.x)
    || Math.max(b.start.x, b.end.x) + EPSILON < Math.min(a.start.x, a.end.x)
    || Math.max(a.start.y, a.end.y) + EPSILON < Math.min(b.start.y, b.end.y)
    || Math.max(b.start.y, b.end.y) + EPSILON < Math.min(a.start.y, a.end.y)) return null;
  const r = subtract(a.end, a.start), s = subtract(b.end, b.start), offset = subtract(b.start, a.start);
  const rLength = Math.hypot(r.x, r.y), sLength = Math.hypot(s.x, s.y);
  if (rLength <= EPSILON || sLength <= EPSILON) return null;
  const denominator = cross(r, s);
  if (Math.abs(denominator) <= 1e-12 * rLength * sLength) {
    if (Math.abs(cross(offset, r)) > EPSILON * rLength) return null;
    const start = (offset.x * r.x + offset.y * r.y) / rLength ** 2;
    const end = start + (s.x * r.x + s.y * r.y) / rLength ** 2;
    const low = Math.max(0, Math.min(start, end)), high = Math.min(1, Math.max(start, end));
    if (high < low - EPSILON / rLength) return null;
    if (high - low <= EPSILON / rLength) return { point: along(a, Math.max(0, Math.min(1, (low + high) / 2))) };
    return { overlap: { start: along(a, low), end: along(a, high) } };
  }
  const t = cross(offset, s) / denominator, u = cross(offset, r) / denominator;
  if (t < -EPSILON / rLength || t > 1 + EPSILON / rLength
    || u < -EPSILON / sLength || u > 1 + EPSILON / sLength) return null;
  return { point: along(a, Math.max(0, Math.min(1, t))) };
}

function pointOnSegment(point: Point, segment: Segment): boolean {
  const delta = subtract(segment.end, segment.start), offset = subtract(point, segment.start);
  const t = (offset.x * delta.x + offset.y * delta.y) / (delta.x ** 2 + delta.y ** 2);
  const nearest = along(segment, Math.max(0, Math.min(1, t)));
  return Math.hypot(point.x - nearest.x, point.y - nearest.y) <= EPSILON;
}

function subtract(a: Point, b: Point): Point { return { x: a.x - b.x, y: a.y - b.y }; }
function cross(a: Point, b: Point): number { return a.x * b.y - a.y * b.x; }
function along(segment: Segment, t: number): Point {
  return { x: segment.start.x + (segment.end.x - segment.start.x) * t,
    y: segment.start.y + (segment.end.y - segment.start.y) * t };
}
