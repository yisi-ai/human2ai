import type { RestoreDraftVersionInput } from "../domain/session/index.ts";
import {
  uiSketchDraftFingerprint,
  validateUiSketchDraft,
  type UiSketchDraftVersion,
} from "../domain/ui-sketch/index.ts";
import type { UiSketchDraft } from "../domain/ui-sketch/index.ts";
import { DraftVersionStore } from "./draft-version-store.ts";
import type { CreateDraftVersionInput } from "../domain/session/index.ts";
import type { DatabaseConnection } from "./migrate.ts";

export {
  DraftRevisionConflictError as UiSketchDraftRevisionConflictError,
  DraftSessionTypeMismatchError as UiSketchSessionRequiredError,
  DraftVersionNotFoundError as UiSketchDraftVersionNotFoundError,
} from "./draft-version-errors.ts";

export class UiSketchSessionRepository {
  private readonly draftVersions: DraftVersionStore<UiSketchDraft>;

  constructor(database: DatabaseConnection) {
    this.draftVersions = new DraftVersionStore<UiSketchDraft>(database, {
      table: "ui_sketch_draft_versions",
      storesFingerprint: false,
      sessionType: "ui-layout",
      sessionLabel: "UI sketch session",
      validateDraft: validateUiSketchDraft,
      fingerprint: uiSketchDraftFingerprint,
    });
  }

  listDraftVersions(sessionId: string): UiSketchDraftVersion[] {
    return this.draftVersions.listDraftVersions(sessionId);
  }

  getDraftVersion(sessionId: string, revision: number): UiSketchDraftVersion {
    return this.draftVersions.getDraftVersion(sessionId, revision);
  }

  getLatestDraftVersion(sessionId: string, knownRevision?: number): UiSketchDraftVersion | null {
    return this.draftVersions.getLatestDraftVersion(sessionId, knownRevision);
  }

  createDraftVersion(
    sessionId: string,
    input: CreateDraftVersionInput,
  ): UiSketchDraftVersion {
    return this.draftVersions.createDraftVersion(sessionId, input);
  }

  restoreDraftVersion(sessionId: string, input: RestoreDraftVersionInput) {
    return this.draftVersions.restoreDraftVersion(sessionId, input);
  }

  undoDraftVersion(
    sessionId: string,
    input: { changeRevision: number; expectedLatestRevision: number },
  ): UiSketchDraftVersion {
    return this.draftVersions.undoDraftVersion(sessionId, input);
  }
}
