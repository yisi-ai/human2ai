import type { RestoreDraftVersionInput } from "../domain/session/index.ts";
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
import { DraftVersionStore } from "./draft-version-store.ts";
import type { CreateDraftVersionInput } from "../domain/session/index.ts";
import type { DatabaseConnection } from "./migrate.ts";
import {
  InvalidRecordError,
} from "./project-session-repository.ts";

export {
  DraftRevisionConflictError,
  DraftSessionTypeMismatchError as CompositionSessionRequiredError,
  DraftVersionNotFoundError,
} from "./draft-version-errors.ts";

interface RefinementRunRow {
  id: string;
  session_id: string;
  source_draft_version_id: string;
  source_draft_revision: number;
  source_draft_json: string;
  plan_json: string;
  result_json: string;
  created_at: string;
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
  private readonly draftVersions: DraftVersionStore<CompositionDraft>;

  constructor(private readonly database: DatabaseConnection) {
    this.draftVersions = new DraftVersionStore(database, {
      table: "composition_draft_versions",
      storesFingerprint: true,
      sessionType: "image-composition",
      sessionLabel: "composition session",
      validateDraft,
      fingerprint: draftFingerprint,
    });
  }

  listDraftVersions(sessionId: string): CompositionDraftVersion[] {
    return this.draftVersions.listDraftVersions(sessionId);
  }

  getDraftVersion(sessionId: string, revision: number): CompositionDraftVersion {
    return this.draftVersions.getDraftVersion(sessionId, revision);
  }

  getLatestDraftVersion(sessionId: string, knownRevision?: number): CompositionDraftVersion | null {
    return this.draftVersions.getLatestDraftVersion(sessionId, knownRevision);
  }

  createDraftVersion(
    sessionId: string,
    input: CreateDraftVersionInput,
  ): CompositionDraftVersion {
    return this.draftVersions.createDraftVersion(sessionId, input);
  }

  restoreDraftVersion(sessionId: string, input: RestoreDraftVersionInput) {
    return this.draftVersions.restoreDraftVersion(sessionId, input);
  }

  undoDraftVersion(
    sessionId: string,
    input: { changeRevision: number; expectedLatestRevision: number },
  ): CompositionDraftVersion {
    return this.draftVersions.undoDraftVersion(sessionId, input);
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

  private assertCompositionSession(sessionId: string): void {
    this.draftVersions.assertSessionType(sessionId);
  }
}

const REFINEMENT_RUN_SELECT = `
  SELECT
    runs.id,
    drafts.session_id,
    runs.source_draft_version_id,
    drafts.revision AS source_draft_revision,
    drafts.draft_json AS source_draft_json,
    runs.plan_json,
    runs.result_json,
    runs.created_at
  FROM composition_refinement_runs runs
  JOIN composition_draft_versions drafts
    ON drafts.id = runs.source_draft_version_id
`;

function mapRefinementRun(row: RefinementRunRow): CompositionRefinementRun {
  const sourceFingerprint = draftFingerprint(validateDraft(JSON.parse(row.source_draft_json)));
  const plan = JSON.parse(row.plan_json) as CompositionRefinementRun["plan"];
  plan.sourceFingerprint = sourceFingerprint;
  const result = JSON.parse(row.result_json) as CompositionRefinementRun["result"];
  result.sourceFingerprint = sourceFingerprint;
  result.plan.sourceFingerprint = sourceFingerprint;
  result.refinedDraft = validateDraft(result.refinedDraft);
  return {
    id: row.id,
    sessionId: row.session_id,
    sourceDraftVersionId: row.source_draft_version_id,
    sourceDraftRevision: row.source_draft_revision,
    sourceFingerprint,
    plan,
    result,
    createdAt: row.created_at,
  };
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
