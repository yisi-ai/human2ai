import type { DraftVersion } from "../session/index.ts";
import type { CompositionRefinementPlan, CompositionRefinementResult } from "./refinement/types.ts";
import type { CompositionDraft } from "./types.ts";

export type CompositionDraftVersion = DraftVersion<CompositionDraft>;

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
