import { draftFingerprint } from "./analysis.ts";
import type { CompositionRefinementResult } from "./refinement/types.ts";
import type { CompositionDraft } from "./types.ts";

export type CompositionWorkflowStatus =
  | "waiting"
  | "processing"
  | "ready"
  | "stale"
  | "error";

export interface CompositionWorkflowState {
  draft: CompositionDraft;
  status: CompositionWorkflowStatus;
  refinement: CompositionRefinementResult | null;
  requestedFingerprint: string | null;
  errorMessage: string | null;
}

export function createCompositionWorkflowState(
  draft: CompositionDraft,
): CompositionWorkflowState {
  return {
    draft,
    status: "waiting",
    refinement: null,
    requestedFingerprint: null,
    errorMessage: null,
  };
}

export function beginCompositionRefinement(
  state: CompositionWorkflowState,
): CompositionWorkflowState {
  return {
    ...state,
    status: "processing",
    refinement: null,
    requestedFingerprint: draftFingerprint(state.draft),
    errorMessage: null,
  };
}

export function updateCompositionWorkflowDraft(
  state: CompositionWorkflowState,
  draft: CompositionDraft,
): CompositionWorkflowState {
  const fingerprint = draftFingerprint(draft);

  if (state.refinement?.sourceFingerprint === fingerprint && state.refinement.audit.passed) {
    return { ...state, draft, status: "ready", errorMessage: null };
  }

  if (state.status === "processing" && state.requestedFingerprint === fingerprint) {
    return { ...state, draft };
  }

  const invalidated = Boolean(state.refinement) || state.status === "processing";
  return {
    ...state,
    draft,
    status: invalidated ? "stale" : "waiting",
    requestedFingerprint: null,
    errorMessage: null,
  };
}

export function receiveCompositionRefinement(
  state: CompositionWorkflowState,
  refinement: CompositionRefinementResult,
): CompositionWorkflowState {
  if (
    !refinement.audit.passed ||
    refinement.plan.sourceFingerprint !== refinement.sourceFingerprint
  ) {
    return {
      ...state,
      status: "error",
      refinement: null,
      requestedFingerprint: null,
      errorMessage: null,
    };
  }

  if (refinement.sourceFingerprint !== draftFingerprint(state.draft)) {
    return {
      ...state,
      status: "stale",
      refinement,
      requestedFingerprint: null,
      errorMessage: null,
    };
  }

  return {
    ...state,
    status: "ready",
    refinement,
    requestedFingerprint: null,
    errorMessage: null,
  };
}

export function failCompositionRefinement(
  state: CompositionWorkflowState,
  sourceFingerprint: string,
  errorMessage: string,
): CompositionWorkflowState {
  if (sourceFingerprint !== draftFingerprint(state.draft)) {
    return { ...state, status: "stale", requestedFingerprint: null };
  }

  return {
    ...state,
    status: "error",
    refinement: null,
    requestedFingerprint: null,
    errorMessage,
  };
}
