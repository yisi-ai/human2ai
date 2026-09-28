export {
  ASPECTS,
  COMPOSITION_PROCESSING_SEMANTICS,
  COMPOSITION_TEXT_REGION_SEMANTIC_TYPE,
  COMPOSITION_VISUAL_WEIGHTS,
  MAX_FOCUS_POINTS,
  PRIMITIVES,
  addCompositionImage,
  addArea,
  addDirectionLine,
  addFocus,
  addTextRegion,
  changeFrame,
  copyCompositionItems,
  createDraft,
  isCompositionTextRegion,
  moveFrame,
  moveItem,
  moveTextRegionCorner,
  moveTextRegionAreaCorner,
  pasteCompositionItems,
  removeItem,
  resizeArea,
  resizeFreeArea,
  resizeFrame,
  resizeFrameToBounds,
  resizeCompositionImage,
  rotateArea,
  rotateDirectionLine,
  rotateCompositionImage,
  setProcessingSemantic,
  setCompositionPreviewMode,
  setAreaAspect,
  updateAreaMetadata,
  updateCompositionImage,
  updateItemMetadata,
  validateDraft,
  visibleAreaMetrics,
  visibleCompositionDraft,
} from "./draft.ts";
export {
  COMPOSITION_CANVAS,
  DEFAULT_COMPOSITION_FRAME,
  canvasPointToFrame,
  compositionFrameSizeForRatio,
  compositionSymmetryRotations,
  compositionWorldBounds,
  compositionWorldSize,
  frameBoundsInCanvas,
  framePointToCanvas,
} from "./frame.ts";
export {
  areaGeometry,
  compositionDraftContentBounds,
  compositionDraftWorldBounds,
  compositionDraftWorldSize,
  compositionImageBounds,
  directionLineGeometry,
  textRegionLines,
} from "./geometry.ts";
export {
  areaClippedSides,
  draftFingerprint,
  inspectComposition,
} from "./analysis.ts";
export { compositionPlanningIntersections, type CompositionPlanIntersection, type CompositionPlanIntersectionSource } from "./planning-intersections.ts";
export { renderCompositionNodesSvg, renderCompositionLightSourceSvg, renderCompositionSoftAreaSvg, renderCompositionDisplayTextSvg, renderCompositionReferenceSvg, renderCompositionSvg } from "./render.ts";
export {
  beginCompositionRefinement,
  createCompositionWorkflowState,
  failCompositionRefinement,
  receiveCompositionRefinement,
  updateCompositionWorkflowDraft,
} from "./workflow.ts";
export {
  FOCUS_ANCHORS,
  RefinementConstraintError,
  applyRefinementPlan,
  auditRefinement,
  refinementMethods,
  refinementPlanSchema,
  validateRefinementPlan,
} from "./refinement/engine.ts";
export type * from "./refinement/types.ts";
export type * from "./records.ts";
export type * from "./workflow.ts";
export type * from "./types.ts";

export { compositionLayerOrder, reorderCompositionLayers } from "./layers.ts";
export { COMPOSITION_PLAN_TYPES, addCompositionPlan, replaceCompositionPlan, removeCompositionPlan, moveCompositionPlans, compositionPlanGeometry, transformCompositionPlan } from "./planning.ts";
export { compositionRadialAngles, setCompositionRadialMode, setCompositionRadialRayCount } from "./planning.ts";
export {
  compositionStates, createCompositionState, selectCompositionState,
  renameCompositionState, reorderCompositionStates, deleteCompositionState,
} from "./states.ts";
