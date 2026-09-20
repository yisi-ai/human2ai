import { randomUUID } from "node:crypto";

import type {
  CreateDraftVersionInput,
  DraftVersion,
  SessionType,
  UndoDraftVersionInput,
  RestoreDraftVersionInput,
  StyleProcessing,
} from "../domain/session/index.ts";
import {
  DraftRevisionConflictError,
  DraftSessionTypeMismatchError,
  DraftUndoUnavailableError,
  DraftVersionNotFoundError,
  StyleProcessingStaleError,
} from "./draft-version-errors.ts";
import type { DatabaseConnection } from "./migrate.ts";
import {
  InvalidRecordError,
  SessionNotFoundError,
} from "./project-session-repository.ts";

interface DraftVersionRow {
  id: string;
  session_id: string;
  revision: number;
  draft_json: string;
  created_at: string;
  style_processing_json: string | null;
}

type DraftVersionTable =
  | "composition_draft_versions"
  | "spatial_draft_versions"
  | "ui_sketch_draft_versions";

interface DraftVersionStoreOptions<TDraft> {
  table: DraftVersionTable;
  storesFingerprint: boolean;
  sessionType: SessionType;
  sessionLabel: string;
  validateDraft(input: unknown): TDraft;
  fingerprint(draft: TDraft): string;
  validateTransition?(before: TDraft, after: TDraft): void;
}

export class DraftVersionStore<TDraft> {
  constructor(
    private readonly database: DatabaseConnection,
    private readonly options: DraftVersionStoreOptions<TDraft>,
  ) {}

  listDraftVersions(sessionId: string): DraftVersion<TDraft>[] {
    this.assertSessionType(sessionId);
    const rows = this.database
      .prepare<[string], DraftVersionRow>(
        `${this.selectDraftVersions()} WHERE session_id = ? ORDER BY revision`,
      )
      .all(sessionId);
    return rows.map((row) => this.mapDraftVersion(row));
  }

  getLatestDraftVersion(sessionId: string, knownRevision?: number): DraftVersion<TDraft> | null {
    this.assertSessionType(sessionId);
    const revision = this.latestDraftRevision(sessionId);
    // An unchanged poll never reads, parses or validates historical draft JSON.
    return revision === 0 || revision === knownRevision ? null : this.getDraftVersion(sessionId, revision);
  }

  getDraftVersion(sessionId: string, revision: number): DraftVersion<TDraft> {
    this.assertSessionType(sessionId);
    const row = this.database
      .prepare<[string, number], DraftVersionRow>(
        `${this.selectDraftVersions()} WHERE session_id = ? AND revision = ?`,
      )
      .get(sessionId, revision);
    if (!row) {
      throw new DraftVersionNotFoundError(
        sessionId,
        revision,
        this.options.sessionLabel,
      );
    }
    return this.mapDraftVersion(row);
  }

  createDraftVersion(
    sessionId: string,
    input: CreateDraftVersionInput,
  ): DraftVersion<TDraft> {
    return this.appendDraftVersion(sessionId, input);
  }

  private appendDraftVersion(
    sessionId: string,
    input: CreateDraftVersionInput,
    restoredProcessing?: { value: StyleProcessing | undefined },
  ): DraftVersion<TDraft> {
    const draft = this.validateInput(input.draft);
    const fingerprint = this.options.fingerprint(draft);

    return this.database.transaction(() => {
      this.assertSessionType(sessionId);
      const actualLatestRevision = this.latestDraftRevision(sessionId);
      if (input.expectedLatestRevision !== actualLatestRevision) {
        throw new DraftRevisionConflictError(
          input.expectedLatestRevision,
          actualLatestRevision,
        );
      }

      if (!restoredProcessing && actualLatestRevision > 0 && this.options.validateTransition) {
        try {
          this.options.validateTransition(this.getDraftVersion(sessionId, actualLatestRevision).draft, draft);
        } catch (error) {
          throw new InvalidRecordError(error instanceof Error ? error.message : String(error));
        }
      }

      const id = randomUUID();
      const revision = actualLatestRevision + 1;
      let styleProcessing = restoredProcessing
        ? restoredProcessing.value
        : actualLatestRevision > 0
          ? this.getDraftVersion(sessionId, actualLatestRevision).styleProcessing
          : undefined;
      if (input.styleProcessing) {
        const expected = input.styleProcessing;
        const current = this.database.prepare<[string], {
          style_id: string | null; style_revision: number | null; revision: number;
        }>(`SELECT s.style_id, s.revision, style.revision AS style_revision
            FROM sessions s LEFT JOIN style_entries style ON style.id = s.style_id
            WHERE s.id = ?`).get(sessionId);
        if (!current || current.style_id !== expected.styleId
          || current.style_revision !== expected.styleRevision
          || current.revision !== expected.sessionRevision) {
          throw new StyleProcessingStaleError();
        }
        styleProcessing = {
          styleId: expected.styleId, styleRevision: expected.styleRevision,
          sourceRevision: actualLatestRevision, resultRevision: revision,
        };
      }
      const processingJson = styleProcessing ? JSON.stringify(styleProcessing) : null;
      const createdAt = new Date().toISOString();
      const draftJson = JSON.stringify(draft);
      if (this.options.storesFingerprint) {
        this.database
          .prepare(
            `INSERT INTO ${this.options.table}
              (id, session_id, revision, fingerprint, draft_json, created_at, style_processing_json)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(id, sessionId, revision, fingerprint, draftJson, createdAt, processingJson);
      } else {
        this.database
          .prepare(
            `INSERT INTO ${this.options.table}
              (id, session_id, revision, draft_json, created_at, style_processing_json)
             VALUES (?, ?, ?, ?, ?, ?)`,
          )
          .run(id, sessionId, revision, draftJson, createdAt, processingJson);
      }
      return this.getDraftVersion(sessionId, revision);
    })();
  }

  undoDraftVersion(
    sessionId: string,
    input: UndoDraftVersionInput,
  ): DraftVersion<TDraft> {
    if (input.changeRevision !== input.expectedLatestRevision) {
      throw new InvalidRecordError(
        "Draft undo requires changeRevision to equal expectedLatestRevision",
      );
    }
    this.assertSessionType(sessionId);
    const actualLatestRevision = this.latestDraftRevision(sessionId);
    if (input.expectedLatestRevision !== actualLatestRevision) {
      throw new DraftRevisionConflictError(
        input.expectedLatestRevision,
        actualLatestRevision,
      );
    }
    if (input.changeRevision <= 1) {
      throw new DraftUndoUnavailableError(input.changeRevision);
    }
    return this.restoreDraftVersion(sessionId, {
      targetRevision: input.changeRevision - 1,
      expectedLatestRevision: input.expectedLatestRevision,
    });
  }

  restoreDraftVersion(sessionId: string, input: RestoreDraftVersionInput): DraftVersion<TDraft> {
    this.assertSessionType(sessionId);
    const actualLatestRevision = this.latestDraftRevision(sessionId);
    if (input.expectedLatestRevision !== actualLatestRevision) {
      throw new DraftRevisionConflictError(input.expectedLatestRevision, actualLatestRevision);
    }
    const restored = this.getDraftVersion(sessionId, input.targetRevision);
    return this.appendDraftVersion(sessionId, {
      expectedLatestRevision: input.expectedLatestRevision,
      draft: restored.draft,
    }, { value: restored.styleProcessing });
  }

  assertSessionType(sessionId: string): void {
    const row = this.database
      .prepare<[string], { session_type: SessionType }>(
        "SELECT session_type FROM sessions WHERE id = ?",
      )
      .get(sessionId);
    if (!row) throw new SessionNotFoundError(sessionId);
    if (row.session_type !== this.options.sessionType) {
      throw new DraftSessionTypeMismatchError(
        sessionId,
        row.session_type,
        this.options.sessionType,
      );
    }
  }

  private latestDraftRevision(sessionId: string): number {
    const row = this.database
      .prepare<[string], { revision: number }>(
        `SELECT coalesce(max(revision), 0) AS revision
         FROM ${this.options.table}
         WHERE session_id = ?`,
      )
      .get(sessionId);
    return row?.revision ?? 0;
  }

  private selectDraftVersions(): string {
    return `SELECT id, session_id, revision, draft_json, created_at, style_processing_json
            FROM ${this.options.table}`;
  }

  private mapDraftVersion(row: DraftVersionRow): DraftVersion<TDraft> {
    const draft = this.options.validateDraft(JSON.parse(row.draft_json));
    return {
      id: row.id,
      sessionId: row.session_id,
      revision: row.revision,
      fingerprint: this.options.fingerprint(draft),
      draft,
      createdAt: row.created_at,
      ...(row.style_processing_json ? { styleProcessing: JSON.parse(row.style_processing_json) as StyleProcessing } : {}),
    };
  }

  private validateInput(input: unknown): TDraft {
    try {
      return this.options.validateDraft(input);
    } catch (error) {
      throw new InvalidRecordError(
        error instanceof Error ? error.message : String(error),
      );
    }
  }
}
