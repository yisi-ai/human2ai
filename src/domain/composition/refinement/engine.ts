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
import type { CompositionArea, CompositionDraft, Point } from "../types.ts";
import type {
  AnchorPointMap,
  AppliedRefinementOperation,
  CompositionRefinementAudit,
  CompositionRefinementOperation,
  CompositionRefinementPlan,
  CompositionRefinementResult,
  RefinementMethodDescription,
  RefinementProtectionLimits,
} from "./types.ts";

const EPSILON = 1e-9;

export const REFINEMENT_LIMITS: RefinementProtectionLimits = Object.freeze({
  maximumFocusShift: 0.08,
  maximumAreaShift: 0.04,
  maximumRotationShift: 4,
  maximumVisibleAreaShareDelta: 0.04,
  maximumMetricDelta: 0.04,
  maximumVisualCenterShift: 0.04,
});

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
    description: "Move one Agent-selected focus to a named center, golden-section, or thirds anchor.",
  },
  {
    id: "axis-relation",
    version: 1,
    decisionOwner: "agent",
    description: "Strengthen an Agent-selected parallel, perpendicular, or mirrored relation between two focus and area axes.",
  },
  {
    id: "rotation-alignment",
    version: 1,
    decisionOwner: "agent",
    description: "Align Agent-selected non-circular areas to a named horizontal, vertical, or diagonal axis.",
  },
];

type MethodExecutor = (
  draft: CompositionDraft,
  operation: CompositionRefinementOperation,
) => { draft: CompositionDraft; applied: AppliedRefinementOperation };

const METHOD_EXECUTORS: Record<CompositionRefinementOperation["method"], MethodExecutor> = {
  "focus-anchor": applyFocusAnchor,
  "axis-relation": applyAxisRelation,
  "rotation-alignment": applyRotationAlignment,
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
  const plan = validateRefinementPlan(planInput);
  const sourceFingerprint = draftFingerprint(source);
  if (plan.sourceFingerprint !== sourceFingerprint) {
    throw new Error(
      `Refinement plan is stale: expected ${sourceFingerprint}, received ${plan.sourceFingerprint}.`,
    );
  }

  let refinedDraft = source;
  const appliedOperations: AppliedRefinementOperation[] = [];
  for (const operation of plan.operations) {
    const result = METHOD_EXECUTORS[operation.method](refinedDraft, operation);
    refinedDraft = result.draft;
    appliedOperations.push(result.applied);
  }

  refinedDraft = validateDraft(refinedDraft);
  const audit = auditRefinement(source, refinedDraft);
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
): CompositionRefinementAudit {
  const source = validateDraft(sourceInput);
  const refined = validateDraft(refinedInput);
  const sourceMetrics = visibleAreaMetrics(source);
  const refinedMetrics = visibleAreaMetrics(refined);
  const focusShifts = source.focusPoints.map((focus, index) =>
    distance(focus, refined.focusPoints[index] ?? focus),
  );
  const areaShifts = source.areas.map((area, index) =>
    distance(area, refined.areas[index] ?? area),
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
  const preserved = {
    frame: equal(source.frame, refined.frame),
    focusIdentity: equal(
      source.focusPoints.map(({ id }) => id),
      refined.focusPoints.map(({ id }) => id),
    ),
    areaIdentity:
      sourceAreaIds.length === refinedAreaIds.length &&
      [...sourceAreaIds].sort().join("\u0000") === [...refinedAreaIds].sort().join("\u0000"),
    areaGeometryInputs: equal(
      source.areas.map(areaGeometryInputs),
      refined.areas.map(areaGeometryInputs),
    ),
    areaOrder: equal(sourceAreaIds, refinedAreaIds),
    directionLine: equal(source.directionLine, refined.directionLine),
    clippingSides: equal(
      source.areas.map((area) => areaClippedSides(area, source)),
      refined.areas.map((area) => areaClippedSides(area, refined)),
    ),
  };

  const failedChecks = [
    ...Object.entries(preserved)
      .filter(([, passed]) => !passed)
      .map(([name]) => `preserved.${name}`),
    ...(changes.maximumFocusShift <= REFINEMENT_LIMITS.maximumFocusShift + EPSILON
      ? []
      : ["limits.maximumFocusShift"]),
    ...(changes.maximumAreaShift <= REFINEMENT_LIMITS.maximumAreaShift + EPSILON
      ? []
      : ["limits.maximumAreaShift"]),
    ...(changes.maximumRotationShift <= REFINEMENT_LIMITS.maximumRotationShift + EPSILON
      ? []
      : ["limits.maximumRotationShift"]),
    ...(changes.maximumVisibleAreaShareDelta <=
    REFINEMENT_LIMITS.maximumVisibleAreaShareDelta + EPSILON
      ? []
      : ["limits.maximumVisibleAreaShareDelta"]),
    ...(Math.max(
      changes.occupiedAreaDelta,
      changes.clippedAreaDelta,
      changes.overlapAreaDelta,
    ) <=
    REFINEMENT_LIMITS.maximumMetricDelta + EPSILON
      ? []
      : ["limits.maximumMetricDelta"]),
    ...(changes.visualCenterShift <= REFINEMENT_LIMITS.maximumVisualCenterShift + EPSILON
      ? []
      : ["limits.maximumVisualCenterShift"]),
  ];

  return {
    passed: failedChecks.length === 0,
    limits: { ...REFINEMENT_LIMITS },
    changes,
    preserved,
    failedChecks,
  };
}

function applyFocusAnchor(
  draft: CompositionDraft,
  operation: CompositionRefinementOperation,
): { draft: CompositionDraft; applied: AppliedRefinementOperation } {
  if (operation.method !== "focus-anchor") throw new Error("Invalid focus-anchor operation.");
  const focus = draft.focusPoints.find(({ id }) => id === operation.targetFocusId);
  if (!focus) throw new Error(`Unknown focus point: ${operation.targetFocusId}.`);
  const target = FOCUS_ANCHORS[operation.anchor];
  const shift = distance(focus, target);
  if (shift > REFINEMENT_LIMITS.maximumFocusShift + EPSILON) {
    throw new Error(
      `focus-anchor requires shift ${round(shift)}, exceeding subtle limit ${REFINEMENT_LIMITS.maximumFocusShift}.`,
    );
  }
  const refined = moveItem(draft, focus.id, target);
  const refinedFocus = refined.focusPoints.find(({ id }) => id === focus.id)!;
  if (distance(refinedFocus, target) > EPSILON) {
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
  const focusAngle = axisAngle(focuses[0], focuses[1], draft);
  const sourceAngle = axisAngle(areas[0], areas[1], draft);
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
  const first = toPixels(areas[0], draft);
  const second = toPixels(areas[1], draft);
  const center = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
  const halfDistance = distance(first, second) / 2;
  const radians = (targetAngle * Math.PI) / 180;
  const targets = [
    {
      x: (center.x - Math.cos(radians) * halfDistance) / draft.frame.width,
      y: (center.y - Math.sin(radians) * halfDistance) / draft.frame.height,
    },
    {
      x: (center.x + Math.cos(radians) * halfDistance) / draft.frame.width,
      y: (center.y + Math.sin(radians) * halfDistance) / draft.frame.height,
    },
  ];
  const shifts = areas.map((area, index) => distance(area, targets[index]));
  const maximumShift = maximum(shifts);
  if (maximumShift > REFINEMENT_LIMITS.maximumAreaShift + EPSILON) {
    throw new Error(
      `axis-relation requires shift ${round(maximumShift)}, exceeding subtle limit ${REFINEMENT_LIMITS.maximumAreaShift}.`,
    );
  }

  let refined = draft;
  areas.forEach((area, index) => {
    refined = moveItem(refined, area.id, targets[index]);
  });
  const refinedAreas = operation.areaIds.map(
    (id) => refined.areas.find((area) => area.id === id)!,
  );
  const refinedAngle = axisAngle(refinedAreas[0], refinedAreas[1], refined);
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
    if (shift > REFINEMENT_LIMITS.maximumRotationShift + EPSILON) {
      throw new Error(
        `rotation-alignment for ${id} requires ${round(shift)} degrees, exceeding subtle limit ${REFINEMENT_LIMITS.maximumRotationShift}.`,
      );
    }
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

function axisAngle(first: Point, second: Point, draft: CompositionDraft): number {
  const start = toPixels(first, draft);
  const end = toPixels(second, draft);
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

function toPixels(point: Point, draft: CompositionDraft): Point {
  return { x: point.x * draft.frame.width, y: point.y * draft.frame.height };
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
