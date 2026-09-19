import { Ajv2020, type ErrorObject } from "ajv/dist/2020.js";
import compositionRefinementPlanSchema from "../../../../schemas/composition-refinement-plan.schema.json" with {
  type: "json",
};
import { areaClippedSides, draftFingerprint } from "../analysis.ts";
import {
  moveItem,
  rotateArea,
  validateDraft,
  visibleAreaMetrics,
} from "../draft.ts";
import { areaGeometry, geometryBounds } from "../geometry.ts";
import {
  COMPOSITION_CANVAS,
  canvasPointToFrame,
  framePointToCanvas,
} from "../frame.ts";
import type { CompositionArea, CompositionDraft, Point } from "../types.ts";
import type {
  AnchorPointMap,
  AppliedRefinementOperation,
  CompositionRefinementAudit,
  CompositionRefinementOperation,
  CompositionRefinementPlan,
  CompositionRefinementResult,
  RefinementMethodDescription,
} from "./types.ts";

import {
  applyRelation, carryLinkedFocuses, checkRefinementRelation, refinementItem, validateRefinementLinks,
} from "./relations.ts";

const EPSILON = 1e-9;

export const FOCUS_ANCHORS: AnchorPointMap = Object.freeze({
  "optical-center": { x: 0.5, y: 0.55 },
  "geometric-center": { x: 0.5, y: 0.5 },
  "golden-right-upper": { x: 0.61803398875, y: 0.38196601125 },
  "golden-left-upper": { x: 0.38196601125, y: 0.38196601125 },
  "golden-right-lower": { x: 0.61803398875, y: 0.61803398875 },
  "golden-left-lower": { x: 0.38196601125, y: 0.61803398875 },
  "third-right-upper": { x: 2 / 3, y: 1 / 3 },
  "third-left-upper": { x: 1 / 3, y: 1 / 3 },
  "third-right-lower": { x: 2 / 3, y: 2 / 3 },
  "third-left-lower": { x: 1 / 3, y: 2 / 3 },
});

const REFINEMENT_METHODS: RefinementMethodDescription[] = [
  {
    id: "focus-anchor",
    version: 1,
    decisionOwner: "agent",
    processingSemantics: ["scene-composition", "editorial-layout"],
    description: "Move one Agent-selected focus to a named center, golden-section, or thirds anchor.",
  },
  {
    id: "axis-relation",
    version: 1,
    decisionOwner: "agent",
    processingSemantics: ["scene-composition", "editorial-layout"],
    description: "Strengthen an Agent-selected parallel, perpendicular, or mirrored relation between two focus and area axes.",
  },
  {
    id: "rotation-alignment",
    version: 1,
    decisionOwner: "agent",
    processingSemantics: ["scene-composition", "editorial-layout"],
    description: "Align Agent-selected non-circular areas to a named horizontal, vertical, or diagonal axis.",
  },
  {
    id: "block-alignment",
    version: 1,
    decisionOwner: "agent",
    processingSemantics: ["editorial-layout"],
    description: "Align Agent-selected area edges or centers to an Agent-selected anchor area.",
  },
  {
    id: "spacing-rhythm",
    version: 1,
    decisionOwner: "agent",
    processingSemantics: ["editorial-layout"],
    description: "Equalize horizontal or vertical edge spacing across Agent-selected areas.",
  },
  ...[
    { id: "frame-placement", description: "Place a subject center, edge, or focus on an Agent-selected frame division." },
    { id: "size-ratio", description: "Set an explicit physical length or area ratio between selected measurements." },
    { id: "mirror-symmetry", description: "Mirror a target area across a named frame axis, matching position or geometry." },
    { id: "focus-flow", description: "Aim an existing direction line or a subject's local axis at a selected focus." },
  ].map((method) => ({ ...method, id: method.id as RefinementMethodDescription["id"], version: 1 as const,
    decisionOwner: "agent" as const, processingSemantics: ["scene-composition", "editorial-layout"] as RefinementMethodDescription["processingSemantics"] })),
];

type MethodExecutor = (
  draft: CompositionDraft,
  operation: CompositionRefinementOperation,
) => { draft: CompositionDraft; applied: AppliedRefinementOperation };

const METHOD_EXECUTORS: Record<CompositionRefinementOperation["method"], MethodExecutor> = {
  "focus-anchor": applyFocusAnchor,
  "axis-relation": applyAxisRelation,
  "rotation-alignment": applyRotationAlignment,
  "block-alignment": applyBlockAlignment,
  "spacing-rhythm": applySpacingRhythm,
  "frame-placement": applyNamedRelation,
  "size-ratio": applyNamedRelation,
  "mirror-symmetry": applyNamedRelation,
  "focus-flow": applyNamedRelation,
};

const ajv = new Ajv2020({ allErrors: true });
const validatePlanSchema = ajv.compile<CompositionRefinementPlan>(compositionRefinementPlanSchema);

export class RefinementConstraintError extends Error {
  constructor(public readonly audit: CompositionRefinementAudit) {
    super(`Refinement violates protection constraints: ${audit.failedChecks.join(", ")}.`);
    this.name = "RefinementConstraintError";
  }
}

export function refinementMethods(): RefinementMethodDescription[] {
  return structuredClone(REFINEMENT_METHODS);
}

export function refinementPlanSchema(): object {
  return structuredClone(compositionRefinementPlanSchema);
}

export function validateRefinementPlan(input: unknown): CompositionRefinementPlan {
  if (!validatePlanSchema(input)) {
    throw new Error(formatValidationErrors(validatePlanSchema.errors));
  }
  return structuredClone(input);
}

export function applyRefinementPlan(
  input: CompositionDraft,
  planInput: unknown,
): CompositionRefinementResult {
  const source = validateDraft(input);
  const processingSemantic = source.processingSemantic;
  if (processingSemantic === null) {
    throw new Error(
      "Composition mode is not selected. Ask the user to choose scene-composition or editorial-layout before refining.",
    );
  }
  const plan = validateRefinementPlan(planInput);
  const sourceFingerprint = draftFingerprint(source);
  if (plan.sourceFingerprint !== sourceFingerprint) {
    throw new Error(
      `Refinement plan is stale: expected ${sourceFingerprint}, received ${plan.sourceFingerprint}.`,
    );
  }

  if (plan.version === 2) validateRefinementLinks(source, plan);
  let refinedDraft = source;
  const appliedOperations: AppliedRefinementOperation[] = [];
  for (const operation of plan.operations) {
    const method = REFINEMENT_METHODS.find(({ id }) => id === operation.method)!;
    if (!method.processingSemantics.includes(processingSemantic)) {
      throw new Error(
        `${operation.method} does not support ${processingSemantic}.`,
      );
    }
    const result = METHOD_EXECUTORS[operation.method](refinedDraft, operation);
    const before = refinedDraft;
    refinedDraft = plan.version === 2 ? carryLinkedFocuses(before, result.draft, plan) : result.draft;
    appliedOperations.push(result.applied);
  }

  refinedDraft = validateDraft(refinedDraft);
  const audit = auditRefinement(source, refinedDraft, plan);
  if (plan.version === 2) {
    audit.relations = plan.operations.map((operation, index) => checkRefinementRelation(
      source, refinedDraft, operation, index, (draft, op) => METHOD_EXECUTORS[op.method](draft, op).draft,
    ));
    audit.failedChecks.push(...audit.relations.filter((check) => !check.passed)
      .map((check) => `relations.${check.operationIndex}.${check.method}`));
    audit.failedChecks.push(...plan.fixedIds.filter((id) =>
      !equal(refinementItem(source, id), refinementItem(refinedDraft, id))).map((id) => `fixed.${id}`));
    audit.passed = audit.failedChecks.length === 0;
  }
  if (!audit.passed) throw new RefinementConstraintError(audit);

  return {
    version: 1,
    kind: "composition-refinement-result",
    sourceFingerprint,
    plan,
    refinedDraft,
    appliedOperations,
    audit,
  };
}

export function auditRefinement(
  sourceInput: CompositionDraft,
  refinedInput: CompositionDraft,
  plan?: CompositionRefinementPlan,
): CompositionRefinementAudit {
  const source = validateDraft(sourceInput);
  const refined = validateDraft(refinedInput);
  const sourceMetrics = visibleAreaMetrics(source);
  const refinedMetrics = visibleAreaMetrics(refined);
  const focusShifts = source.focusPoints.map((focus, index) =>
    frameDistance(focus, refined.focusPoints[index] ?? focus, source),
  );
  const areaShifts = source.areas.map((area, index) =>
    frameDistance(area, refined.areas[index] ?? area, source),
  );
  const rotationShifts = source.areas.map((area, index) =>
    Math.abs(angleDifference(refined.areas[index]?.rotation ?? 0, area.rotation ?? 0)),
  );
  const visibleAreaDeltas = sourceMetrics.visibleAreaShares.map((value, index) =>
    Math.abs(value - (refinedMetrics.visibleAreaShares[index] ?? value)),
  );

  const changes = {
    maximumFocusShift: maximum(focusShifts),
    maximumAreaShift: maximum(areaShifts),
    maximumRotationShift: maximum(rotationShifts),
    maximumVisibleAreaShareDelta: maximum(visibleAreaDeltas),
    occupiedAreaDelta: Math.abs(sourceMetrics.occupiedArea - refinedMetrics.occupiedArea),
    clippedAreaDelta: Math.abs(sourceMetrics.clippedArea - refinedMetrics.clippedArea),
    overlapAreaDelta: Math.abs(sourceMetrics.overlapArea - refinedMetrics.overlapArea),
    visualCenterShift: distance(sourceMetrics.visualCenter, refinedMetrics.visualCenter),
  };
  const sourceAreaIds = source.areas.map(({ id }) => id);
  const refinedAreaIds = refined.areas.map(({ id }) => id);
  const resizeIds = new Set(plan?.version === 2 ? plan.operations.flatMap((operation) =>
    operation.method === "size-ratio" || operation.method === "mirror-symmetry" && operation.match === "geometry"
      ? [operation.targetAreaId] : []) : []);
  const geometryInputs = (area: CompositionArea) => resizeIds.has(area.id)
    ? { id: area.id, primitive: area.primitive } : areaGeometryInputs(area);
  const directionMayRotate = plan?.version === 2 && plan.operations.some((operation) =>
    operation.method === "focus-flow" && operation.sourceId === "direction-1");
  const directionContent = (draft: CompositionDraft) => draft.directionLine && directionMayRotate
    ? { ...draft.directionLine, rotation: 0 } : draft.directionLine;
  const preserved = {
    processingSemantic: source.processingSemantic === refined.processingSemantic,
    frame: equal(source.frame, refined.frame),
    focusIdentity: equal(
      source.focusPoints.map(({ id }) => id),
      refined.focusPoints.map(({ id }) => id),
    ),
    areaIdentity:
      sourceAreaIds.length === refinedAreaIds.length &&
      [...sourceAreaIds].sort().join("\u0000") === [...refinedAreaIds].sort().join("\u0000"),
    areaGeometryInputs: equal(
      source.areas.map(geometryInputs),
      refined.areas.map(geometryInputs),
    ),
    areaMetadata: equal(
      source.areas.map(areaMetadata),
      refined.areas.map(areaMetadata),
    ),
    areaOrder: equal(sourceAreaIds, refinedAreaIds),
    directionLine: equal(directionContent(source), directionContent(refined)),
    clippingSides: equal(
      source.areas.map((area) => areaClippedSides(area, source)),
      refined.areas.map((area) => areaClippedSides(area, refined)),
    ),
  };

  // Clipping is an observed result of the Agent's geometry choices, not an invariant.
  const failedChecks = Object.entries(preserved)
    .filter(([name, passed]) => name !== "clippingSides" && !passed)
    .map(([name]) => `preserved.${name}`);
  if (source.overallNote !== refined.overallNote) failedChecks.push("preserved.overallNote");
  if (!equal(source.images, refined.images)) failedChecks.push("preserved.images");
  const focusMetadata = (draft: CompositionDraft) => draft.focusPoints.map(({ x: _x, y: _y, ...metadata }) => metadata);
  if (!equal(focusMetadata(source), focusMetadata(refined))) failedChecks.push("preserved.focusMetadata");

  return {
    passed: failedChecks.length === 0,
    changes,
    preserved,
    failedChecks,
  };
}

function applyNamedRelation(draft: CompositionDraft, operation: CompositionRefinementOperation) {
  if (operation.method !== "frame-placement" && operation.method !== "size-ratio"
    && operation.method !== "mirror-symmetry" && operation.method !== "focus-flow") {
    throw new Error("Expected a named composition relation.");
  }
  const refined = applyRelation(draft, operation);
  const items: Array<ReturnType<typeof refinementItem>> = [...draft.areas, ...draft.focusPoints, ...(draft.directionLine ? [draft.directionLine] : [])];
  const changed = items.filter((item) => !equal(item, refinementItem(refined, item.id)));
  return { draft: refined, applied: {
    method: operation.method, methodVersion: 1 as const, targetIds: changed.map(({ id }) => id),
    positionShifts: Object.fromEntries(changed.map((item) => [item.id, frameDistance(item, refinementItem(refined, item.id), draft)])),
    rotationShifts: Object.fromEntries(changed.filter((item) => "rotation" in item).map((item) => {
      const next = refinementItem(refined, item.id);
      return [item.id, Math.abs(angleDifference("rotation" in next ? next.rotation ?? 0 : 0, "rotation" in item ? item.rotation ?? 0 : 0))];
    })),
  } };
}

function applyFocusAnchor(
  draft: CompositionDraft,
  operation: CompositionRefinementOperation,
): { draft: CompositionDraft; applied: AppliedRefinementOperation } {
  if (operation.method !== "focus-anchor") throw new Error("Invalid focus-anchor operation.");
  const focus = draft.focusPoints.find(({ id }) => id === operation.targetFocusId);
  if (!focus) throw new Error(`Unknown focus point: ${operation.targetFocusId}.`);
  const targetInFrame = FOCUS_ANCHORS[operation.anchor];
  const target = framePointToCanvas(targetInFrame, draft.frame);
  const shift = distance(canvasPointToFrame(focus, draft.frame), targetInFrame);
  const refined = moveItem(draft, focus.id, target);
  const refinedFocus = refined.focusPoints.find(({ id }) => id === focus.id)!;
  if (distance(canvasPointToFrame(refinedFocus, draft.frame), targetInFrame) > EPSILON) {
    throw new Error(`focus-anchor could not reach ${operation.anchor} within draft constraints.`);
  }
  return {
    draft: refined,
    applied: {
      method: operation.method,
      methodVersion: 1,
      targetIds: [focus.id],
      positionShifts: { [focus.id]: round(shift) },
      rotationShifts: {},
    },
  };
}

function applyAxisRelation(
  draft: CompositionDraft,
  operation: CompositionRefinementOperation,
): { draft: CompositionDraft; applied: AppliedRefinementOperation } {
  if (operation.method !== "axis-relation") throw new Error("Invalid axis-relation operation.");
  const focuses = operation.focusIds.map((id) => {
    const focus = draft.focusPoints.find((item) => item.id === id);
    if (!focus) throw new Error(`Unknown focus point: ${id}.`);
    return focus;
  });
  const areas = operation.areaIds.map((id) => {
    const area = draft.areas.find((item) => item.id === id);
    if (!area) throw new Error(`Unknown area: ${id}.`);
    return area;
  });
  if (distance(focuses[0], focuses[1]) < EPSILON || distance(areas[0], areas[1]) < EPSILON) {
    throw new Error("An axis relation requires distinct focus positions and distinct area centers.");
  }
  const focusAngle = axisAngle(focuses[0], focuses[1]);
  const sourceAngle = axisAngle(areas[0], areas[1]);
  const focusSlope = axisSlopeAngle(focusAngle);
  const candidates =
    operation.relation === "parallel"
      ? [focusAngle, focusAngle + 180]
      : operation.relation === "mirrored-cross"
        ? [-focusSlope, 180 - focusSlope]
        : [focusAngle + 90, focusAngle - 90];
  const targetAngle = candidates.sort(
    (first, second) =>
      Math.abs(angleDifference(first, sourceAngle)) - Math.abs(angleDifference(second, sourceAngle)),
  )[0];
  const first = toPixels(areas[0]);
  const second = toPixels(areas[1]);
  const center = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
  const halfDistance = distance(first, second) / 2;
  const radians = (targetAngle * Math.PI) / 180;
  const targets = [
    {
      x: (center.x - Math.cos(radians) * halfDistance) / COMPOSITION_CANVAS.width,
      y: (center.y - Math.sin(radians) * halfDistance) / COMPOSITION_CANVAS.height,
    },
    {
      x: (center.x + Math.cos(radians) * halfDistance) / COMPOSITION_CANVAS.width,
      y: (center.y + Math.sin(radians) * halfDistance) / COMPOSITION_CANVAS.height,
    },
  ];
  const shifts = areas.map((area, index) => frameDistance(area, targets[index], draft));

  let refined = draft;
  areas.forEach((area, index) => {
    refined = moveItem(refined, area.id, targets[index]);
  });
  const refinedAreas = operation.areaIds.map(
    (id) => refined.areas.find((area) => area.id === id)!,
  );
  const refinedAngle = axisAngle(refinedAreas[0], refinedAreas[1]);
  if (acuteAxisDifference(refinedAngle, targetAngle) > 1e-6) {
    throw new Error("axis-relation could not reach the requested relation within draft constraints.");
  }
  return {
    draft: refined,
    applied: {
      method: operation.method,
      methodVersion: 1,
      targetIds: [...operation.focusIds, ...operation.areaIds],
      positionShifts: Object.fromEntries(areas.map((area, index) => [area.id, round(shifts[index])])),
      rotationShifts: {},
    },
  };
}

function applyRotationAlignment(
  draft: CompositionDraft,
  operation: CompositionRefinementOperation,
): { draft: CompositionDraft; applied: AppliedRefinementOperation } {
  if (operation.method !== "rotation-alignment") {
    throw new Error("Invalid rotation-alignment operation.");
  }
  const baseAngle = {
    horizontal: 0,
    vertical: 90,
    "rising-diagonal": 315,
    "falling-diagonal": 45,
  }[operation.axis];
  const targets = operation.targetAreaIds.map((id) => {
    const area = draft.areas.find((item) => item.id === id);
    if (!area) throw new Error(`Unknown area: ${id}.`);
    if (area.primitive === "circle") {
      throw new Error(`rotation-alignment does not support circle area: ${id}.`);
    }
    const sourceRotation = area.rotation ?? 0;
    const candidates = [baseAngle, (baseAngle + 180) % 360];
    const targetRotation = candidates.sort(
      (first, second) =>
        Math.abs(angleDifference(first, sourceRotation)) -
        Math.abs(angleDifference(second, sourceRotation)),
    )[0];
    const shift = Math.abs(angleDifference(targetRotation, sourceRotation));
    return { area, targetRotation, shift };
  });

  let refined = draft;
  targets.forEach(({ area, targetRotation }) => {
    refined = rotateArea(refined, area.id, targetRotation);
  });
  return {
    draft: refined,
    applied: {
      method: operation.method,
      methodVersion: 1,
      targetIds: [...operation.targetAreaIds],
      positionShifts: {},
      rotationShifts: Object.fromEntries(targets.map(({ area, shift }) => [area.id, round(shift)])),
    },
  };
}

function applyBlockAlignment(
  draft: CompositionDraft,
  operation: CompositionRefinementOperation,
): { draft: CompositionDraft; applied: AppliedRefinementOperation } {
  if (operation.method !== "block-alignment") {
    throw new Error("Invalid block-alignment operation.");
  }
  if (!operation.targetAreaIds.includes(operation.anchorAreaId)) {
    throw new Error("block-alignment anchorAreaId must be included in targetAreaIds.");
  }
  const areas = operation.targetAreaIds.map((id) => {
    const area = draft.areas.find((candidate) => candidate.id === id);
    if (!area) throw new Error(`Unknown area: ${id}.`);
    return area;
  });
  const anchor = areas.find(({ id }) => id === operation.anchorAreaId)!;
  const anchorBounds = boundsForArea(anchor);
  const anchorCoordinate = alignmentCoordinate(anchorBounds, operation.alignment);
  const targets = areas.map((area) => {
    const bounds = boundsForArea(area);
    const coordinate = alignmentCoordinate(bounds, operation.alignment);
    const horizontal = ["left", "horizontal-center", "right"].includes(operation.alignment);
    const target = {
      x: area.x + (horizontal ? anchorCoordinate - coordinate : 0) / COMPOSITION_CANVAS.width,
      y: area.y + (horizontal ? 0 : anchorCoordinate - coordinate) / COMPOSITION_CANVAS.height,
    };
    return { area, target, shift: frameDistance(area, target, draft) };
  });

  let refined = draft;
  targets.forEach(({ area, target }) => {
    refined = moveItem(refined, area.id, target);
  });
  return {
    draft: refined,
    applied: {
      method: operation.method,
      methodVersion: 1,
      targetIds: [...operation.targetAreaIds],
      positionShifts: Object.fromEntries(
        targets.map(({ area, shift }) => [area.id, round(shift)]),
      ),
      rotationShifts: {},
    },
  };
}

function applySpacingRhythm(
  draft: CompositionDraft,
  operation: CompositionRefinementOperation,
): { draft: CompositionDraft; applied: AppliedRefinementOperation } {
  if (operation.method !== "spacing-rhythm") {
    throw new Error("Invalid spacing-rhythm operation.");
  }
  const horizontal = operation.axis === "horizontal";
  const areas = operation.targetAreaIds.map((id) => {
    const area = draft.areas.find((candidate) => candidate.id === id);
    if (!area) throw new Error(`Unknown area: ${id}.`);
    const bounds = boundsForArea(area);
    return {
      area,
      minimum: horizontal ? bounds.minimumX : bounds.minimumY,
      maximum: horizontal ? bounds.maximumX : bounds.maximumY,
    };
  }).sort((first, second) => (
    (first.minimum + first.maximum) - (second.minimum + second.maximum)
  ));
  const first = areas[0];
  const last = areas.at(-1)!;
  const totalSize = areas.reduce(
    (sum, area) => sum + area.maximum - area.minimum,
    0,
  );
  const gap = (last.maximum - first.minimum - totalSize) / (areas.length - 1);
  let cursor = first.minimum;
  const targets = areas.map(({ area, minimum, maximum }) => {
    const size = maximum - minimum;
    const targetCenter = cursor + size / 2;
    const currentCenter = (minimum + maximum) / 2;
    const target = {
      x: area.x + (horizontal ? targetCenter - currentCenter : 0) / COMPOSITION_CANVAS.width,
      y: area.y + (horizontal ? 0 : targetCenter - currentCenter) / COMPOSITION_CANVAS.height,
    };
    cursor += size + gap;
    return { area, target, shift: frameDistance(area, target, draft) };
  });

  let refined = draft;
  targets.forEach(({ area, target }) => {
    refined = moveItem(refined, area.id, target);
  });
  return {
    draft: refined,
    applied: {
      method: operation.method,
      methodVersion: 1,
      targetIds: [...operation.targetAreaIds],
      positionShifts: Object.fromEntries(
        targets.map(({ area, shift }) => [area.id, round(shift)]),
      ),
      rotationShifts: {},
    },
  };
}

function boundsForArea(area: CompositionArea) {
  return geometryBounds(areaGeometry(area, COMPOSITION_CANVAS));
}

function alignmentCoordinate(
  bounds: ReturnType<typeof geometryBounds>,
  alignment: "left" | "horizontal-center" | "right" | "top" | "vertical-center" | "bottom",
): number {
  if (alignment === "left") return bounds.minimumX;
  if (alignment === "horizontal-center") return (bounds.minimumX + bounds.maximumX) / 2;
  if (alignment === "right") return bounds.maximumX;
  if (alignment === "top") return bounds.minimumY;
  if (alignment === "vertical-center") return (bounds.minimumY + bounds.maximumY) / 2;
  return bounds.maximumY;
}

function areaGeometryInputs(area: CompositionArea) {
  return {
    id: area.id,
    primitive: area.primitive,
    area: area.area,
    aspect: area.aspect,
    width: area.width,
    height: area.height,
  };
}

function areaMetadata(area: CompositionArea) {
  return {
    id: area.id,
    origin: area.origin,
    note: area.note,
    annotation: area.annotation,
    semanticType: area.semanticType,
    shotScale: area.shotScale,
    visualWeight: area.visualWeight,
    displayText: area.displayText,
    corners: area.corners,
    isLightSource: area.isLightSource ?? false,
  };
}

function axisAngle(first: Point, second: Point): number {
  const start = toPixels(first);
  const end = toPixels(second);
  return (Math.atan2(end.y - start.y, end.x - start.x) * 180) / Math.PI;
}

function axisSlopeAngle(angle: number): number {
  return ((angle + 270) % 180) - 90;
}

function angleDifference(first: number, second: number): number {
  return ((first - second + 540) % 360) - 180;
}

function acuteAxisDifference(first: number, second: number): number {
  const difference = Math.abs(angleDifference(first, second));
  return Math.min(difference, 180 - difference);
}

function toPixels(point: Point): Point {
  return {
    x: point.x * COMPOSITION_CANVAS.width,
    y: point.y * COMPOSITION_CANVAS.height,
  };
}

function frameDistance(first: Point, second: Point, draft: CompositionDraft): number {
  return distance(
    canvasPointToFrame(first, draft.frame),
    canvasPointToFrame(second, draft.frame),
  );
}

function distance(first: Point, second: Point): number {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

function maximum(values: number[]): number {
  return Math.max(0, ...values);
}

function equal(first: unknown, second: unknown): boolean {
  return JSON.stringify(first) === JSON.stringify(second);
}

function round(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

function formatValidationErrors(errors: ErrorObject[] | null | undefined): string {
  return (errors ?? [])
    .map((error) => {
      if (error.keyword === "additionalProperties") {
        return `${error.instancePath || "plan"} contains unknown field: ${String(error.params.additionalProperty)}`;
      }
      return `${error.instancePath || "plan"} ${error.message ?? "is invalid"}`;
    })
    .join("; ");
}
