import type { CompositionDraft, Point } from "../types.ts";

export type RefinementStrength = "subtle";
export type FocusAnchorName =
  | "optical-center"
  | "geometric-center"
  | "golden-right-upper"
  | "golden-left-upper"
  | "golden-right-lower"
  | "golden-left-lower"
  | "third-right-upper"
  | "third-left-upper"
  | "third-right-lower"
  | "third-left-lower";

export interface FocusAnchorOperation {
  method: "focus-anchor";
  methodVersion: 1;
  targetFocusId: string;
  anchor: FocusAnchorName;
  strength: RefinementStrength;
}

export interface AxisRelationOperation {
  method: "axis-relation";
  methodVersion: 1;
  focusIds: [string, string];
  areaIds: [string, string];
  relation: "parallel" | "perpendicular" | "mirrored-cross";
  strength: RefinementStrength;
}

export interface RotationAlignmentOperation {
  method: "rotation-alignment";
  methodVersion: 1;
  targetAreaIds: string[];
  axis: "horizontal" | "vertical" | "rising-diagonal" | "falling-diagonal";
  strength: RefinementStrength;
}

export type CompositionRefinementOperation =
  | FocusAnchorOperation
  | AxisRelationOperation
  | RotationAlignmentOperation;

export interface CompositionRefinementPlan {
  version: 1;
  kind: "composition-refinement-plan";
  sourceFingerprint: string;
  rationale: string;
  operations: CompositionRefinementOperation[];
}

export interface AppliedRefinementOperation {
  method: CompositionRefinementOperation["method"];
  methodVersion: 1;
  targetIds: string[];
  positionShifts: Record<string, number>;
  rotationShifts: Record<string, number>;
}

export interface RefinementProtectionLimits {
  maximumFocusShift: number;
  maximumAreaShift: number;
  maximumRotationShift: number;
  maximumVisibleAreaShareDelta: number;
  maximumMetricDelta: number;
  maximumVisualCenterShift: number;
}

export interface CompositionRefinementAudit {
  passed: boolean;
  limits: RefinementProtectionLimits;
  changes: {
    maximumFocusShift: number;
    maximumAreaShift: number;
    maximumRotationShift: number;
    maximumVisibleAreaShareDelta: number;
    occupiedAreaDelta: number;
    clippedAreaDelta: number;
    overlapAreaDelta: number;
    visualCenterShift: number;
  };
  preserved: {
    frame: boolean;
    focusIdentity: boolean;
    areaIdentity: boolean;
    areaGeometryInputs: boolean;
    areaOrder: boolean;
    directionLine: boolean;
    clippingSides: boolean;
  };
  failedChecks: string[];
}

export interface CompositionRefinementResult {
  version: 1;
  kind: "composition-refinement-result";
  sourceFingerprint: string;
  plan: CompositionRefinementPlan;
  refinedDraft: CompositionDraft;
  appliedOperations: AppliedRefinementOperation[];
  audit: CompositionRefinementAudit;
}

export interface RefinementMethodDescription {
  id: CompositionRefinementOperation["method"];
  version: 1;
  description: string;
  decisionOwner: "agent";
}

export type AnchorPointMap = Record<FocusAnchorName, Point>;
