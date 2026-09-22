import { normalizeCompositionSymmetryRotation, validateDraft } from "./draft.ts";
import { compositionSymmetryRotations, frameBoundsInCanvas } from "./frame.ts";
import type { CompositionDraft, CompositionFrame, CompositionPlan, Point } from "./types.ts";

export const COMPOSITION_PLAN_TYPES = ["thirds", "golden-section", "symmetry", "golden-spiral", "triangle", "radial"] as const;

export function addCompositionPlan(input: CompositionDraft, type: CompositionPlan["type"]): { draft: CompositionDraft; id: string } {
  const draft = validateDraft(input);
  const plans = draft.plans ?? [];
  let number = 1;
  while (plans.some((plan) => plan.id === `plan-${number}`)) number += 1;
  const base = { id: `plan-${number}`, visible: true };
  const plan: CompositionPlan = type === "triangle"
    ? { ...base, type, x: 0.5, y: 0.5, rotation: 0, width: 0.6, height: 0.6 }
    : type === "symmetry" ? { ...base, type, x: 0.5, y: 0.5, rotation: 90 }
    : type === "golden-spiral" ? { ...base, type, x: 0.618, y: 0.382, rotation: 135, scale: 0.65, mirrored: false }
    : type === "radial" ? { ...base, type, mode: "uniform", x: 0.5, y: 0.5, rotation: 0, rayCount: 8, spread: 360 }
    : { ...base, type, axes: "both" };
  return { draft: validateDraft({ ...draft, plans: [...plans, plan] }), id: plan.id };
}

export function replaceCompositionPlan(input: CompositionDraft, plan: CompositionPlan): CompositionDraft {
  return validateDraft({ ...input, plans: (input.plans ?? []).map((current) => current.id === plan.id ? plan : current) });
}

export function removeCompositionPlan(input: CompositionDraft, id: string): CompositionDraft {
  return validateDraft({ ...input, plans: (input.plans ?? []).filter((plan) => plan.id !== id) });
}

export function moveCompositionPlans(input: CompositionDraft, ids: readonly string[], delta: Point): CompositionDraft {
  return validateDraft({ ...input, plans: (input.plans ?? []).map((plan) => ids.includes(plan.id)
    ? transformCompositionPlan(plan, input.frame, delta) : plan) });
}

type RadialPlan = Extract<CompositionPlan, { type: "radial" }>;

export function compositionRadialAngles(plan: RadialPlan): number[] {
  if (plan.mode === "free") return [...plan.angles];
  const step = plan.spread / (plan.spread === 360 ? plan.rayCount : plan.rayCount - 1);
  return Array.from({ length: plan.rayCount }, (_, index) => (plan.rotation + index * step) % 360);
}

export function setCompositionRadialMode(plan: RadialPlan, mode: RadialPlan["mode"]): RadialPlan {
  if (plan.mode === mode) return plan;
  const base = { id: plan.id, type: plan.type, visible: plan.visible, x: plan.x, y: plan.y };
  const angles = compositionRadialAngles(plan);
  return mode === "free" ? { ...base, mode, angles }
    : { ...base, mode, rotation: angles[0], rayCount: angles.length, spread: 360 };
}

export function setCompositionRadialRayCount(plan: RadialPlan, count: number): RadialPlan {
  if (plan.mode === "uniform") return { ...plan, rayCount: count };
  const angles = plan.angles.slice(0, count);
  while (angles.length < count) {
    const sorted = [...angles].sort((a, b) => a - b);
    const gaps = sorted.map((angle, index) => (sorted[index + 1] ?? sorted[0] + 360) - angle);
    const widest = gaps.indexOf(Math.max(...gaps));
    angles.push((sorted[widest] + gaps[widest] / 2) % 360);
  }
  return { ...plan, angles };
}

/** Shared editor/CLI geometry in physical canvas units; generation references omit this layer. */
export function compositionPlanGeometry(plan: CompositionPlan, frame: CompositionFrame): { paths: Point[][]; handles: Point[]; snapPoints?: Point[]; maxCurveDeviation?: number } {
  const bounds = frameBoundsInCanvas(frame);
  const point = (p: Point): Point => ({ x: bounds.x + p.x * bounds.width, y: bounds.y + p.y * bounds.height });
  if (plan.type === "thirds" || plan.type === "golden-section") {
    const start = plan.type === "thirds" ? 1 / 3 : (3 - Math.sqrt(5)) / 2;
    const paths: Point[][] = [];
    for (const division of [start, 1 - start]) {
      if (plan.axes !== "horizontal") paths.push([point({ x: division, y: 0 }), point({ x: division, y: 1 })]);
      if (plan.axes !== "vertical") paths.push([point({ x: 0, y: division }), point({ x: 1, y: division })]);
    }
    return { paths, handles: [] };
  }
  if (plan.type === "triangle") {
    const center = point(plan);
    const angle = plan.rotation * Math.PI / 180;
    const width = plan.width * bounds.width, height = plan.height * bounds.height;
    const vertices = [{ x: 0, y: -height / 2 }, { x: -width / 2, y: height / 2 }, { x: width / 2, y: height / 2 }]
      .map(({ x, y }) => ({ x: center.x + x * Math.cos(angle) - y * Math.sin(angle), y: center.y + x * Math.sin(angle) + y * Math.cos(angle) }));
    return { paths: [[...vertices, vertices[0]]], handles: vertices };
  }
  const center = point(plan.type === "symmetry" ? { x: 0.5, y: 0.5 } : plan);
  const angle = (plan.type === "symmetry" ? normalizeCompositionSymmetryRotation(plan.rotation, frame)
    : plan.type === "radial" ? 0 : plan.rotation) * Math.PI / 180;
  const at = (radius: number, theta = 0): Point => ({
    x: center.x + radius * Math.cos(angle + theta),
    y: center.y + radius * Math.sin(angle + theta),
  });
  const edge = Math.min(bounds.width, bounds.height);
  if (plan.type === "symmetry") {
    const length = Math.hypot(bounds.width, bounds.height) + Math.hypot(center.x - bounds.x, center.y - bounds.y);
    const snapPoints = compositionSymmetryRotations(frame).map((rotation) => at(edge * 0.3, rotation * Math.PI / 180 - angle));
    return { paths: [[at(-length), at(length)]], handles: [center, at(edge * 0.3)], snapPoints };
  }
  if (plan.type === "radial") {
    const length = Math.hypot(bounds.width, bounds.height) + Math.hypot(center.x - bounds.x, center.y - bounds.y);
    const angles = compositionRadialAngles(plan).map((rotation) => rotation * Math.PI / 180);
    const paths = angles.map((rotation) => [center, at(length, rotation)]);
    const controls = plan.mode === "free" ? angles : angles.slice(0, 1);
    return { paths, handles: [center, ...controls.map((rotation) => at(edge * 0.3, rotation))] };
  }
  const radius = edge * plan.scale;
  const phi = (1 + Math.sqrt(5)) / 2;
  const segments = 240, sweep = Math.PI * 6;
  // A true logarithmic golden spiral: every quarter-turn increases radius by phi.
  const curve = Array.from({ length: segments + 1 }, (_, index) => {
    const theta = (index / segments - 1) * sweep;
    return at(radius * phi ** (theta / (Math.PI / 2)), plan.mirrored ? -theta : theta);
  });
  // Linear interpolation error <= max |curve''| * step² / 8, in physical canvas units.
  const growth = Math.log(phi) / (Math.PI / 2);
  const maxCurveDeviation = radius * (1 + growth ** 2) * (sweep / segments) ** 2 / 8;
  return { paths: [curve], handles: [center, at(radius)], maxCurveDeviation };
}

/** Move a guide or one of its controls by a physical canvas delta. */
export function transformCompositionPlan(plan: CompositionPlan, frame: CompositionFrame, delta: Point, handle?: number): CompositionPlan {
  if (plan.type === "thirds" || plan.type === "golden-section") return plan;
  const bounds = frameBoundsInCanvas(frame);
  if (plan.type === "symmetry") {
    const fixed = { ...plan, x: 0.5, y: 0.5, rotation: normalizeCompositionSymmetryRotation(plan.rotation, frame) };
    if (handle !== 1) return fixed;
    const { handles: [center, end] } = compositionPlanGeometry(fixed, frame);
    const dx = end.x + delta.x - center.x, dy = end.y + delta.y - center.y;
    return Math.hypot(dx, dy) < 1 ? fixed
      : { ...fixed, rotation: normalizeCompositionSymmetryRotation(Math.atan2(dy, dx) * 180 / Math.PI, frame) };
  }
  if (handle === undefined || (plan.type !== "triangle" && handle === 0)) {
    return { ...plan, x: plan.x + delta.x / bounds.width, y: plan.y + delta.y / bounds.height };
  }
  const { handles } = compositionPlanGeometry(plan, frame);
  const center = { x: bounds.x + plan.x * bounds.width, y: bounds.y + plan.y * bounds.height };
  const dx = handles[handle].x + delta.x - center.x, dy = handles[handle].y + delta.y - center.y;
  if (plan.type === "triangle") {
    if (handle === 0) {
      if (Math.hypot(dx, dy) < 1) return plan;
      return { ...plan, rotation: Math.atan2(dy, dx) * 180 / Math.PI + 90, height: 2 * Math.hypot(dx, dy) / bounds.height };
    }
    const angle = plan.rotation * Math.PI / 180;
    return { ...plan,
      width: Math.max(0.01, 2 * Math.abs(dx * Math.cos(angle) + dy * Math.sin(angle)) / bounds.width),
      height: Math.max(0.01, 2 * (-dx * Math.sin(angle) + dy * Math.cos(angle)) / bounds.height),
    };
  }
  if (Math.hypot(dx, dy) < 1) return plan;
  const rotation = Math.atan2(dy, dx) * 180 / Math.PI;
  if (plan.type === "radial") return plan.mode === "free"
    ? { ...plan, angles: plan.angles.map((angle, index) => index === handle - 1 ? rotation : angle) }
    : { ...plan, rotation };
  return { ...plan, rotation, scale: Math.max(0.01, Math.hypot(dx, dy) / Math.min(bounds.width, bounds.height)) };
}
