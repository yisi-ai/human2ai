import type { CompositionDraft, CompositionProcessingSemantic, Point } from "../types.ts";

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
  /** Legacy input; adjustment magnitude is determined by the named operation. */
  strength?: RefinementStrength;
}

export interface AxisRelationOperation {
  method: "axis-relation";
  methodVersion: 1;
  focusIds: [string, string];
  areaIds: [string, string];
  relation: "parallel" | "perpendicular" | "mirrored-cross";
  /** Legacy input; adjustment magnitude is determined by the named operation. */
  strength?: RefinementStrength;
}

export interface RotationAlignmentOperation {
  method: "rotation-alignment";
  methodVersion: 1;
  targetAreaIds: string[];
  axis: "horizontal" | "vertical" | "rising-diagonal" | "falling-diagonal";
  /** Legacy input; adjustment magnitude is determined by the named operation. */
  strength?: RefinementStrength;
}

export interface BlockAlignmentOperation {
  method: "block-alignment";
  methodVersion: 1;
  targetAreaIds: string[];
  anchorAreaId: string;
  alignment: "left" | "horizontal-center" | "right" | "top" | "vertical-center" | "bottom";
  /** Legacy input; adjustment magnitude is determined by the named operation. */
  strength?: RefinementStrength;
}

export interface SpacingRhythmOperation {
  method: "spacing-rhythm";
  methodVersion: 1;
  targetAreaIds: string[];
  axis: "horizontal" | "vertical";
  distribution: "equal";
  /** Legacy input; adjustment magnitude is determined by the named operation. */
  strength?: RefinementStrength;
}

export type LegacyRefinementOperation =
  | FocusAnchorOperation
  | AxisRelationOperation
  | RotationAlignmentOperation
  | BlockAlignmentOperation
  | SpacingRhythmOperation;

export interface LegacyRefinementPlan {
  version: 1;
  kind: "composition-refinement-plan";
  sourceFingerprint: string;
  rationale: string;
  operations: LegacyRefinementOperation[];
}

export type FrameDivision = "center" | "golden-start" | "golden-end" | "third-start" | "third-end";

export interface FramePlacementOperation {
  method: "frame-placement";
  methodVersion: 1;
  targetId: string;
  axis: "x" | "y";
  alignment: "start" | "center" | "end";
  division: FrameDivision;
}

export interface SizeRatioOperation {
  method: "size-ratio";
  methodVersion: 1;
  targetAreaId: string;
  dimension: "width" | "height" | "area";
  referenceId: string;
  referenceDimension: "width" | "height" | "area";
  ratio: number;
}

export interface MirrorSymmetryOperation {
  method: "mirror-symmetry";
  methodVersion: 1;
  anchorAreaId: string;
  targetAreaId: string;
  axis: "vertical" | "horizontal";
  division: FrameDivision;
  match: "position" | "geometry";
}

export interface FocusFlowOperation {
  method: "focus-flow";
  methodVersion: 1;
  sourceId: string;
  targetFocusId: string;
  localAxis: "x" | "y";
}

export type RelationOperation = FramePlacementOperation | SizeRatioOperation
  | MirrorSymmetryOperation | FocusFlowOperation;
export type CompositionRefinementOperation = LegacyRefinementOperation | RelationOperation;

export interface DirectedRefinementPlan {
  version: 2;
  kind: "composition-refinement-plan";
  sourceFingerprint: string;
  decision: "refine" | "retain";
  objective: string;
  assessment: { intent: string; observations: string[]; uncertainties: string[] };
  preserve: string[];
  tradeoffs: string[];
  rationale: string;
  fixedIds: string[];
  focusLinks: Array<{ focusId: string; areaId: string }>;
  operations: Array<CompositionRefinementOperation & { reason: string; expectedEffect: string }>;
}

export type CompositionRefinementPlan = LegacyRefinementPlan | DirectedRefinementPlan;

/** Coordinates are world units, shared with the editable draft. Guides never enter the draft. */
export interface RefinementGuide {
  start: Point;
  end: Point;
}

export interface RefinementRelationCheck {
  operationIndex: number;
  method: CompositionRefinementOperation["method"];
  before: number | null;
  after: number;
  target: number;
  error: number;
  unit: "frame-fraction" | "ratio" | "degrees" | "pixels";
  passed: boolean;
  guides: RefinementGuide[];
}

export interface AppliedRefinementOperation {
  method: CompositionRefinementOperation["method"];
  methodVersion: 1;
  targetIds: string[];
  positionShifts: Record<string, number>;
  rotationShifts: Record<string, number>;
}

export interface CompositionRefinementAudit {
  passed: boolean;
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
    processingSemantic: boolean;
    frame: boolean;
    focusIdentity: boolean;
    areaIdentity: boolean;
    areaGeometryInputs: boolean;
    areaMetadata: boolean;
    areaOrder: boolean;
    directionLine: boolean;
    clippingSides: boolean;
  };
  failedChecks: string[];
  relations?: RefinementRelationCheck[];
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
  processingSemantics: CompositionProcessingSemantic[];
}

export type AnchorPointMap = Record<FocusAnchorName, Point>;
