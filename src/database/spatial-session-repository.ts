import type { RestoreDraftVersionInput } from "../domain/session/index.ts";
import { DraftVersionStore } from "./draft-version-store.ts";
import type { DatabaseConnection } from "./migrate.ts";
import type { CreateDraftVersionInput, UndoDraftVersionInput } from "../domain/session/index.ts";
import { applySpatialOperations, createSpatialDraft, spatialDraftFingerprint, validateSpatialDraft, validateSpatialTransition, type SpatialDraft, type SpatialOperation } from "../domain/spatial/index.ts";

export class SpatialSessionRepository {
  private readonly draftVersions: DraftVersionStore<SpatialDraft>;
  private applyingOperations = false;
  constructor(private readonly database: DatabaseConnection) {
    this.draftVersions = new DraftVersionStore(database, {
      table: "spatial_draft_versions", storesFingerprint: false,
      sessionType: "spatial", sessionLabel: "3D space",
      validateDraft: validateSpatialDraft, fingerprint: spatialDraftFingerprint,
      validateTransition: (before, after) => { if (!this.applyingOperations) validateSpatialTransition(before, after); },
    });
  }
  listDraftVersions(sessionId: string) { return this.draftVersions.listDraftVersions(sessionId); }
  getLatestDraftVersion(sessionId: string, knownRevision?: number) { return this.draftVersions.getLatestDraftVersion(sessionId, knownRevision); }
  getDraftVersion(sessionId: string, revision: number) { return this.draftVersions.getDraftVersion(sessionId, revision); }
  createDraftVersion(sessionId: string, input: CreateDraftVersionInput) { return this.draftVersions.createDraftVersion(sessionId, input); }
  restoreDraftVersion(sessionId: string, input: RestoreDraftVersionInput) {
    return this.draftVersions.restoreDraftVersion(sessionId, input);
  }

  undoDraftVersion(sessionId: string, input: UndoDraftVersionInput) { return this.draftVersions.undoDraftVersion(sessionId, input); }
  apply(sessionId: string, expectedLatestRevision: number, operations: SpatialOperation[]) {
    return this.database.transaction(() => {
      const current = expectedLatestRevision > 0 ? this.getDraftVersion(sessionId, expectedLatestRevision).draft : createSpatialDraft();
      const result = applySpatialOperations(current, operations);
      if (expectedLatestRevision === 0) this.createDraftVersion(sessionId, { expectedLatestRevision: 0, draft: current });
      // Each operation has already checked its own transition, including explicit
      // unlock/move/relock sequences that a final-state comparison cannot express.
      this.applyingOperations = true;
      try {
        const version = this.createDraftVersion(sessionId, { expectedLatestRevision: expectedLatestRevision || 1, draft: result.draft });
        return { ...version, constrained: result.constrained };
      } finally { this.applyingOperations = false; }
    })();
  }
}
