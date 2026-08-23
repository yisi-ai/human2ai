import type { CompositionRefinementPlan, CompositionRefinementResult } from "./refinement/types.ts";
import type { CompositionDraft } from "./types.ts";

export interface CompositionDraftVersion {
  id: string;
  sessionId: string;
  revision: number;
  fingerprint: string;
  draft: CompositionDraft;
  createdAt: string;
}

export interface CompositionRefinementRun {
  id: string;
  sessionId: string;
  sourceDraftVersionId: string;
  sourceDraftRevision: number;
  sourceFingerprint: string;
  plan: CompositionRefinementPlan;
  result: CompositionRefinementResult;
  createdAt: string;
}
