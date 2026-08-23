import { randomUUID } from "node:crypto";

import {
  RefinementConstraintError,
  applyRefinementPlan,
  draftFingerprint,
  validateDraft,
  validateRefinementPlan,
  type CompositionDraft,
  type CompositionDraftVersion,
  type CompositionRefinementPlan,
  type CompositionRefinementResult,
  type CompositionRefinementRun,
} from "../domain/composition/index.ts";
import type { SessionType } from "../domain/session/index.ts";
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
}

interface RefinementRunRow {
  id: string;
  session_id: string;
  source_draft_version_id: string;
  source_draft_revision: number;
  source_fingerprint: string;
  plan_json: string;
  result_json: string;
  created_at: string;
}

export class CompositionSessionRequiredError extends Error {
  readonly code = "SESSION_TYPE_MISMATCH";

  constructor(
    readonly sessionId: string,
    readonly actualType: SessionType,
  ) {
    super(`Session ${sessionId} has type ${actualType}; expected image-composition`);
  }
}

export class DraftRevisionConflictError extends Error {
  readonly code = "DRAFT_REVISION_CONFLICT";

  constructor(
    readonly expectedLatestRevision: number,
    readonly actualLatestRevision: number,
  ) {
    super(
      `Expected latest draft revision ${expectedLatestRevision}, received ${actualLatestRevision}`,
    );
  }
}

export class DraftVersionNotFoundError extends Error {
  readonly code = "DRAFT_VERSION_NOT_FOUND";

  constructor(
    readonly sessionId: string,
    readonly revision: number,
  ) {
    super(`Draft revision ${revision} not found in composition session ${sessionId}`);
  }
}

export class RefinementRunNotFoundError extends Error {
  readonly code = "REFINEMENT_RUN_NOT_FOUND";

  constructor(readonly refinementRunId: string) {
    super(`Composition refinement run not found: ${refinementRunId}`);
  }
}

export class RefinementPlanStaleError extends Error {
  readonly code = "REFINEMENT_PLAN_STALE";

  constructor(
    readonly expectedSourceFingerprint: string,
    readonly receivedSourceFingerprint: string,
  ) {
    super(
      `Expected source fingerprint ${expectedSourceFingerprint}, received ${receivedSourceFingerprint}`,
    );
  }
}

export class CompositionSessionRepository {
  constructor(private readonly database: DatabaseConnection) {}

  listDraftVersions(sessionId: string): CompositionDraftVersion[] {
    this.assertCompositionSession(sessionId);
    const rows = this.database
      .prepare<[string], DraftVersionRow>(
        `${DRAFT_VERSION_SELECT} WHERE session_id = ? ORDER BY revision`,
      )
      .all(sessionId);
    return rows.map(mapDraftVersion);
  }

  getDraftVersion(sessionId: string, revision: number): CompositionDraftVersion {
    this.assertCompositionSession(sessionId);
    const row = this.database
      .prepare<[string, number], DraftVersionRow>(
        `${DRAFT_VERSION_SELECT} WHERE session_id = ? AND revision = ?`,
      )
      .get(sessionId, revision);
    if (!row) throw new DraftVersionNotFoundError(sessionId, revision);
    return mapDraftVersion(row);
  }

  createDraftVersion(
    sessionId: string,
    input: { expectedLatestRevision: number; draft: unknown },
  ): CompositionDraftVersion {
    const draft = validateCompositionDraft(input.draft);
    const fingerprint = draftFingerprint(draft);

    return this.database.transaction(() => {
      this.assertCompositionSession(sessionId);
      const actualLatestRevision = this.latestDraftRevision(sessionId);
      if (input.expectedLatestRevision !== actualLatestRevision) {
        throw new DraftRevisionConflictError(
          input.expectedLatestRevision,
          actualLatestRevision,
        );
      }

      const id = randomUUID();
      const revision = actualLatestRevision + 1;
      const createdAt = new Date().toISOString();
      this.database
        .prepare(
          `INSERT INTO composition_draft_versions
            (id, session_id, revision, fingerprint, draft_json, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(id, sessionId, revision, fingerprint, JSON.stringify(draft), createdAt);
      return this.getDraftVersion(sessionId, revision);
    })();
  }

  listRefinementRuns(sessionId: string): CompositionRefinementRun[] {
    this.assertCompositionSession(sessionId);
    const rows = this.database
      .prepare<[string], RefinementRunRow>(
        `${REFINEMENT_RUN_SELECT}
         WHERE drafts.session_id = ?
         ORDER BY runs.created_at DESC, runs.id`,
      )
      .all(sessionId);
    return rows.map(mapRefinementRun);
  }

  getRefinementRun(
    sessionId: string,
    refinementRunId: string,
  ): CompositionRefinementRun {
    this.assertCompositionSession(sessionId);
    const row = this.database
      .prepare<[string, string], RefinementRunRow>(
        `${REFINEMENT_RUN_SELECT}
         WHERE drafts.session_id = ? AND runs.id = ?`,
      )
      .get(sessionId, refinementRunId);
    if (!row) throw new RefinementRunNotFoundError(refinementRunId);
    return mapRefinementRun(row);
  }

  createRefinementRun(
    sessionId: string,
    input: { sourceDraftRevision: number; plan: unknown },
  ): CompositionRefinementRun {
    const source = this.getDraftVersion(sessionId, input.sourceDraftRevision);
    const plan = validateCompositionPlan(input.plan);
    if (plan.sourceFingerprint !== source.fingerprint) {
      throw new RefinementPlanStaleError(source.fingerprint, plan.sourceFingerprint);
    }
    let result: CompositionRefinementResult;
    try {
      result = applyRefinementPlan(source.draft, plan);
    } catch (error) {
      if (error instanceof RefinementConstraintError) throw error;
      throw new InvalidRecordError(errorMessage(error));
    }

    const id = randomUUID();
    const createdAt = new Date().toISOString();
    this.database
      .prepare(
        `INSERT INTO composition_refinement_runs
          (id, source_draft_version_id, plan_json, result_json, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        source.id,
        JSON.stringify(plan),
        JSON.stringify(result),
        createdAt,
      );
    return this.getRefinementRun(sessionId, id);
  }

  private latestDraftRevision(sessionId: string): number {
    const row = this.database
      .prepare<[string], { revision: number }>(
        `SELECT coalesce(max(revision), 0) AS revision
         FROM composition_draft_versions
         WHERE session_id = ?`,
      )
      .get(sessionId);
    return row?.revision ?? 0;
  }

  private assertCompositionSession(sessionId: string): void {
    const row = this.database
      .prepare<[string], { session_type: SessionType }>(
        "SELECT session_type FROM sessions WHERE id = ?",
      )
      .get(sessionId);
    if (!row) throw new SessionNotFoundError(sessionId);
    if (row.session_type !== "image-composition") {
      throw new CompositionSessionRequiredError(sessionId, row.session_type);
    }
  }
}

const DRAFT_VERSION_SELECT = `
  SELECT id, session_id, revision, draft_json, created_at
  FROM composition_draft_versions
`;

const REFINEMENT_RUN_SELECT = `
  SELECT
    runs.id,
    drafts.session_id,
    runs.source_draft_version_id,
    drafts.revision AS source_draft_revision,
    json_extract(runs.result_json, '$.sourceFingerprint') AS source_fingerprint,
    runs.plan_json,
    runs.result_json,
    runs.created_at
  FROM composition_refinement_runs runs
  JOIN composition_draft_versions drafts
    ON drafts.id = runs.source_draft_version_id
`;

function mapDraftVersion(row: DraftVersionRow): CompositionDraftVersion {
  const draft = JSON.parse(row.draft_json) as CompositionDraft;
  return {
    id: row.id,
    sessionId: row.session_id,
    revision: row.revision,
    fingerprint: draftFingerprint(draft),
    draft,
    createdAt: row.created_at,
  };
}

function mapRefinementRun(row: RefinementRunRow): CompositionRefinementRun {
  return {
    id: row.id,
    sessionId: row.session_id,
    sourceDraftVersionId: row.source_draft_version_id,
    sourceDraftRevision: row.source_draft_revision,
    sourceFingerprint: row.source_fingerprint,
    plan: JSON.parse(row.plan_json) as CompositionRefinementRun["plan"],
    result: JSON.parse(row.result_json) as CompositionRefinementRun["result"],
    createdAt: row.created_at,
  };
}

function validateCompositionDraft(input: unknown): CompositionDraft {
  try {
    return validateDraft(input);
  } catch (error) {
    throw new InvalidRecordError(errorMessage(error));
  }
}

function validateCompositionPlan(input: unknown): CompositionRefinementPlan {
  try {
    return validateRefinementPlan(input);
  } catch (error) {
    throw new InvalidRecordError(errorMessage(error));
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
